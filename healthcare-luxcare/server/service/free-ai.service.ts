import { withAiSharingPermission } from "./ai-sharing.service";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { FreeAiGuardModel, FreeAiRequestModel } from "../model/ai-access.model";
import { UserModel } from "../model/user.model";
import { AsyncLocalStorage } from "node:async_hooks";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const VN_OFFSET = 7 * HOUR;
const MONTH_RETENTION = 45 * DAY;
const positiveInt = (raw: string | undefined, fallback: number) => {
  const number = Number(raw);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
};
const positiveNumber = (raw: string | undefined) => {
  const number = Number(raw);
  return Number.isFinite(number) && number > 0 ? number : 0;
};
export const freeAiEnabled = () => process.env.AI_FREE_ENABLED === "true" ||
  (process.env.AI_FREE_ENABLED !== "false" && process.env.AI_PERSONAL_FREE_ENABLED === "true");
// Retained only for the dormant wallet implementation.
export const companyWalletEnabled = () => process.env.AI_COMPANY_WALLET_ENABLED === "true";
const limits = () => ({
  hour: positiveInt(process.env.AI_PERSONAL_HOURLY_LIMIT, 6),
  day: positiveInt(process.env.AI_PERSONAL_DAILY_LIMIT, 30),
  month: positiveInt(process.env.AI_PERSONAL_MONTHLY_LIMIT, 900),
});
const budget = () => positiveNumber(process.env.AI_PERSONAL_MONTHLY_BUDGET_USD);
const reserveCost = () => positiveNumber(process.env.AI_PERSONAL_REQUEST_RESERVE_USD) || 0.05;
function periods(now: Date) {
  const local = new Date(now.getTime() + VN_OFFSET);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const day = local.getUTCDate();
  return {
    hour: new Date(now.getTime() - HOUR),
    day: new Date(Date.UTC(year, month, day) - VN_OFFSET),
    month: new Date(Date.UTC(year, month, 1) - VN_OFFSET),
    nextDay: new Date(Date.UTC(year, month, day + 1) - VN_OFFSET),
    nextMonth: new Date(Date.UTC(year, month + 1, 1) - VN_OFFSET),
    monthKey: `${year}-${String(month + 1).padStart(2, "0")}`,
  };
}
export class FreeAiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public resetAt?: Date,
  ) {
    super(message);
  }
}
function checkConfig() {
  if (!freeAiEnabled()) throw new FreeAiError("Trợ lý AI chưa được bật.", 503, "AI_PERSONAL_DISABLED");
  if (!process.env.OPENROUTER_API_KEY || !budget() || reserveCost() > budget())
    throw new FreeAiError("Trợ lý AI đang tạm ngừng. Vui lòng thử lại sau.", 503, "AI_PERSONAL_UNAVAILABLE");
}
export async function prepareFreeAi() {
  if (!freeAiEnabled()) return;
  checkConfig();
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid")
    throw new Error("AI access requires MongoDB replica set or sharded cluster for transaction safety.");
  await Promise.all([FreeAiGuardModel.init(), FreeAiRequestModel.init()]);
}
const activeAiAccount = (userId: string) => ({
  _id: userId,
  disabledAt: null,
  $or: [
    { companyCode: { $type: "string" as const, $ne: "" } },
    { emailVerifiedAt: { $exists: true, $ne: null } },
  ],
});
async function ensureAiAccount(userId: string) {
  const user = await UserModel.findOne(activeAiAccount(userId)).select("_id").lean();
  if (!user) throw new FreeAiError("Tài khoản chưa được xác minh hoặc không còn khả dụng.", 403, "AI_ACCOUNT_UNAVAILABLE");
}
async function counts(userId: string, now: Date, session?: mongoose.ClientSession) {
  const p = periods(now);
  const base = { userId, status: { $ne: "cancelled" as const } };
  const query = (start: Date) =>
    FreeAiRequestModel.countDocuments({ ...base, createdAt: { $gte: start } }).session(session || null);
  const [hour, day, month] = session
    ? [await query(p.hour), await query(p.day), await query(p.month)]
    : await Promise.all([query(p.hour), query(p.day), query(p.month)]);
  return { hour, day, month, p };
}
export async function freeAiStatus(userId: string) {
  checkConfig();
  await ensureAiAccount(userId);
  const now = new Date();
  const { hour, day, month, p } = await counts(userId, now);
  const setting = limits();
  const oldestHour =
    hour >= setting.hour
      ? await FreeAiRequestModel.findOne({ userId, createdAt: { $gte: p.hour } })
          .sort({ createdAt: 1 })
          .select("createdAt")
          .lean()
      : null;
  const resetAt = [
    hour >= setting.hour && oldestHour ? new Date(oldestHour.createdAt.getTime() + HOUR) : null,
    day >= setting.day ? p.nextDay : null,
    month >= setting.month ? p.nextMonth : null,
  ]
    .filter((v): v is Date => Boolean(v))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return {
    mode: "personal-free" as const,
    limits: setting,
    used: { hour, day, month },
    remaining: {
      hour: Math.max(0, setting.hour - hour),
      day: Math.max(0, setting.day - day),
      month: Math.max(0, setting.month - month),
    },
    resetAt: resetAt?.toISOString() || null,
    dayResetAt: p.nextDay.toISOString(),
    monthResetAt: p.nextMonth.toISOString(),
  };
}
async function reserve(userId: string, question: string, idempotencyKey: string) {
  const requestKey = `${userId}:${idempotencyKey}`;
  const existing = await FreeAiRequestModel.findOne({ requestKey }).lean();
  if (existing) return { existing, requestKey, created: false };
  for (let attempt = 0; attempt < 4; attempt++) {
    const session = await mongoose.startSession();
    let inserted = false;
    try {
      await session.withTransaction(async () => {
        inserted = false;
        const now = new Date();
        const p = periods(now);
        await FreeAiGuardModel.updateOne(
          { key: `global:${p.monthKey}` },
          { $inc: { version: 1 } },
          { session, upsert: true },
        );
        await FreeAiGuardModel.updateOne(
          { key: `user:${userId}` },
          { $inc: { version: 1 } },
          { session, upsert: true },
        );
        const duplicate = await FreeAiRequestModel.findOne({ requestKey }).session(session);
        if (duplicate) return;
        const membership = await UserModel.findOne(activeAiAccount(userId)).session(session);
        if (!membership)
          throw new FreeAiError("Tài khoản đã đổi trạng thái. Vui lòng tải lại.", 403, "AI_PERSONAL_FORBIDDEN");
        const { hour, day, month } = await counts(userId, now, session);
        const setting = limits();
        if (hour >= setting.hour || day >= setting.day || month >= setting.month) {
          const oldest =
            hour >= setting.hour
              ? await FreeAiRequestModel.findOne({ userId, createdAt: { $gte: p.hour } })
                  .sort({ createdAt: 1 })
                  .session(session)
              : null;
          const reset = [
            hour >= setting.hour && oldest ? new Date(oldest.createdAt.getTime() + HOUR) : null,
            day >= setting.day ? p.nextDay : null,
            month >= setting.month ? p.nextMonth : null,
          ]
            .filter((v): v is Date => Boolean(v))
            .sort((a, b) => b.getTime() - a.getTime())[0];
          throw new FreeAiError(
            "Bạn đã đạt hạn mức sử dụng AI." + (reset ? " Có thể dùng lại lúc " +
              reset.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) + "." : " Vui lòng thử lại sau."),
            429,
            "AI_QUOTA_EXCEEDED",
            reset,
          );
        }
        const total = await FreeAiRequestModel.aggregate([
          { $match: { createdAt: { $gte: p.month } } },
          { $group: { _id: null, amount: { $sum: { $ifNull: ["$costUSD", "$budgetUSD"] } } } },
        ]).session(session);
        if ((total[0]?.amount || 0) + reserveCost() > budget())
          throw new FreeAiError(
            "Trợ lý AI đang tạm ngừng. Vui lòng thử lại sau.",
            503,
            "AI_PERSONAL_BUDGET_EXCEEDED",
            p.nextMonth,
          );
        await FreeAiRequestModel.create(
          [
            {
              requestKey,
              userId,
              question,
              status: "reserved",
              budgetUSD: reserveCost(),
              createdAt: now,
              expiresAt: new Date(now.getTime() + MONTH_RETENTION),
            },
          ],
          { session },
        );
        inserted = true;
      });
      const created = await FreeAiRequestModel.findOne({ requestKey }).lean();
      if (!created) throw new FreeAiError("Không thể ghi nhận lượt sử dụng AI.", 503, "AI_PERSONAL_UNAVAILABLE");
      return { existing: created, requestKey, created: inserted };
    } catch (error: unknown) {
      // Concurrent creation of a guard's unique key may surface as E11000 instead of
      // a retryable transaction conflict. A committed request key always wins.
      const committed = await FreeAiRequestModel.findOne({ requestKey }).lean();
      if (committed) return { existing: committed, requestKey, created: false };
      const databaseError = error as { code?: number; hasErrorLabel?: (label: string) => boolean } | null;
      if (databaseError?.code !== 11000 && !databaseError?.hasErrorLabel?.("TransientTransactionError")) throw error;
      if (attempt === 3) throw new FreeAiError("Trợ lý đang bận. Vui lòng thử lại.", 503, "AI_PERSONAL_UNAVAILABLE");
    } finally {
      await session.endSession();
    }
  }
  throw new FreeAiError("Trợ lý đang bận. Vui lòng thử lại.", 503, "AI_PERSONAL_UNAVAILABLE");
}
const medical =
  /(?:chẩn đoán|triệu chứng|kê đơn|liều thuốc|điều trị|bệnh|thuốc|cấp cứu|sức khỏe|huyết áp|đau bụng|đau ngực)/i;
export async function askFreeAi(userId: string, question: string, idempotencyKey: string = randomUUID()) {
  checkConfig();
  await ensureAiAccount(userId);
  return withAiSharingPermission(userId, "personal", () => askFreeAiAfterConsent(userId, question, idempotencyKey));
}
async function askFreeAiAfterConsent(userId: string, question: string, idempotencyKey: string) {
  checkConfig();
  await ensureAiAccount(userId);
  if (medical.test(question))
    return {
      answer:
        "Tôi không thể chẩn đoán, kê đơn hoặc hướng dẫn điều trị. Hãy trao đổi với bác sĩ hoặc cơ sở y tế phù hợp.",
      status: await freeAiStatus(userId),
    };
  const { existing, requestKey } = await reserve(userId, question, idempotencyKey);
  if (existing.question !== question)
    throw new FreeAiError("Khóa yêu cầu đã được dùng cho câu hỏi khác.", 409, "AI_REQUEST_CONFLICT");
  if (existing.status === "completed") return { answer: existing.answer || "", status: await freeAiStatus(userId) };
  if (existing.status !== "reserved")
    throw new FreeAiError("Yêu cầu AI này đã được xử lý. Vui lòng gửi yêu cầu mới.", 409, "AI_REQUEST_CONFLICT");
  // Only the first process that created the reservation is allowed to invoke the provider.
  const claimed = await FreeAiRequestModel.updateOne(
    { requestKey, status: "reserved" },
    { $set: { status: "running" } },
  );
  if (claimed.modifiedCount !== 1) throw new FreeAiError("Yêu cầu AI đang được xử lý.", 409, "AI_REQUEST_IN_PROGRESS");
  try {
    const { openrouterChat } = await import("./openrouter.service");
    const result = await openrouterChat({
      model: process.env.CHATBOT_MODEL?.trim() || process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Bạn là trợ lý kiến thức chung và công việc bằng tiếng Việt. Không có quyền truy cập dữ liệu doanh nghiệp. Không suy đoán dữ liệu cá nhân. Không chẩn đoán, kê đơn hoặc đưa lời khuyên điều trị; hướng người dùng đến bác sĩ khi cần. Trả lời ngắn gọn, tối đa 1000 ký tự.",
        },
        { role: "user", content: question },
      ],
      maxRetries: 1,
      allowFallback: false,
      timeoutMs: 20_000,
      maxTokens: 512,
    });
    const answer = result.text.trim().slice(0, 2000);
    if (!answer) throw new FreeAiError("Trợ lý chưa có câu trả lời. Vui lòng thử lại.", 503, "AI_PERSONAL_EMPTY");
    await FreeAiRequestModel.updateOne(
      { requestKey, status: "running" },
      {
        $set: {
          status: "completed",
          answer,
          ...(result.usage?.costUSD === undefined ? {} : { costUSD: result.usage.costUSD }),
        },
      },
    );
    return { answer, status: await freeAiStatus(userId) };
  } catch (error) {
    await FreeAiRequestModel.updateOne({ requestKey, status: "running" }, { $set: { status: "failed" } }).catch(
      () => {},
    );
    throw error;
  }
}
export async function freeAiHistory(userId: string) {
  checkConfig();
  await ensureAiAccount(userId);
  const rows = await FreeAiRequestModel.find({ userId, status: "completed", answer: { $type: "string" } })
    .sort({ createdAt: -1 })
    .limit(30)
    .select("question answer createdAt")
    .lean();
  return rows.map((row) => ({
    id: String(row._id),
    question: row.question,
    answer: row.answer || "",
    createdAt: row.createdAt,
  }));
}

// Every client and organization uses the same account quota and platform budget.
// Provider costs are internal operating costs; no user balance is read or debited.
type QuotaContext = { userId: string; requestKey: string; costUSD: number; unknownCost: boolean; failure?: Error };
const quotaContext = new AsyncLocalStorage<QuotaContext>();
export const isAiQuotaActive = () => Boolean(quotaContext.getStore());
export const isAiQuotaError = (error: unknown) => error instanceof FreeAiError;
export async function beforeAiProviderCall() {
  const context = quotaContext.getStore();
  if (!context) return;
  if (context.failure) throw context.failure;
}
export async function recordAiProviderUsage(data: unknown) {
  const context = quotaContext.getStore();
  if (!context) return;
  const usage = typeof data === "object" && data !== null && "usage" in data ? data.usage : undefined;
  const cost = typeof usage === "object" && usage !== null && "cost" in usage ? usage.cost : undefined;
  if (typeof cost === "number" && Number.isFinite(cost) && cost >= 0) context.costUSD += cost;
  else context.unknownCost = true;
  try {
    // Keep the reservation until the whole request finishes, including tool rounds.
    await FreeAiRequestModel.updateOne({ requestKey: context.requestKey, status: "running" },
      { $set: { costUSD: Math.max(reserveCost(), context.costUSD) } });
  } catch {
    context.failure = new FreeAiError("Không thể ghi nhận lượt sử dụng AI. Vui lòng thử lại sau.", 503, "AI_PERSONAL_UNAVAILABLE");
    throw context.failure;
  }
}
export async function withAiQuota<T>(userId: string, task: string, work: () => Promise<T>): Promise<T> {
  const nested = quotaContext.getStore();
  if (nested) {
    if (nested.userId !== userId) throw new FreeAiError("Tài khoản AI đã thay đổi.", 403, "AI_ACCOUNT_UNAVAILABLE");
    return work();
  }
  checkConfig();
  await ensureAiAccount(userId);
  const { requestKey } = await reserve(userId, task, randomUUID());
  const claimed = await FreeAiRequestModel.updateOne({ requestKey, status: "reserved" }, { $set: { status: "running" } });
  if (claimed.modifiedCount !== 1) throw new FreeAiError("Yêu cầu AI đang được xử lý.", 409, "AI_REQUEST_IN_PROGRESS");
  const context: QuotaContext = { userId, requestKey, costUSD: 0, unknownCost: false };
  return quotaContext.run(context, async () => {
    try {
      const result = await work();
      if (context.failure) throw context.failure;
      await FreeAiRequestModel.updateOne({ requestKey, status: "running" }, { $set: {
        status: "completed",
        costUSD: context.unknownCost ? Math.max(reserveCost(), context.costUSD) : context.costUSD,
      } });
      return result;
    } catch (error) {
      // A failed request remains counted. Never refund a possibly completed provider call.
      await FreeAiRequestModel.updateOne({ requestKey, status: "running" }, { $set: {
        status: "failed", costUSD: Math.max(reserveCost(), context.costUSD),
      } }).catch(() => {});
      throw error;
    }
  });
}

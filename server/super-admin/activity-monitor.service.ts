import { Types, type PipelineStage } from "mongoose";
import { USER_ACTIVITY_CATEGORIES, UserActivityEventModel } from "../model/user-activity-event.model";
import { UserModel } from "../model/user.model";

type Query = Record<string, unknown>;
const text = (value: unknown, name: string, max = 100) => {
  if (value == null || value === "") return "";
  if (typeof value !== "string" || value.length > max) throw new Error(`${name} không hợp lệ.`);
  return value.trim();
};
const literal = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function day(value: unknown, name: string, end: boolean, fallback: Date) {
  const input = text(value, name, 10);
  if (!input) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) throw new Error(`${name} không hợp lệ.`);
  const date = new Date(`${input}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) throw new Error(`${name} không hợp lệ.`);
  return date;
}
function integer(value: unknown, fallback: number, max: number) {
  if (value == null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) throw new Error("Phân trang không hợp lệ.");
  return number;
}

export function buildActivityMonitorQuery(input: Query, now = new Date()) {
  const companyCode = text(input.companyCode, "Doanh nghiệp").toUpperCase();
  const userId = text(input.userId, "Tài khoản", 24);
  if (userId && !/^[a-f\d]{24}$/i.test(userId)) throw new Error("Tài khoản không hợp lệ.");
  const category = text(input.category, "Loại hoạt động", 30);
  if (category && !(USER_ACTIVITY_CATEGORIES as readonly string[]).includes(category)) throw new Error("Loại hoạt động không hợp lệ.");
  const result = text(input.result, "Kết quả", 10);
  if (result && !["success", "failure"].includes(result)) throw new Error("Kết quả không hợp lệ.");
  const from = day(input.from, "Từ ngày", false, new Date(now.getTime() - 7 * 86_400_000));
  const to = day(input.to, "Đến ngày", true, now);
  if (from > to) throw new Error("Từ ngày phải trước hoặc bằng đến ngày.");
  if (to.getTime() - from.getTime() > 90 * 86_400_000) throw new Error("Chỉ được tra cứu tối đa 90 ngày mỗi lần.");
  const search = text(input.search, "Tìm kiếm");
  const page = integer(input.page, 1, 10_000);
  const limit = integer(input.limit, 30, 100);
  const filter = {
    occurredAt: { $gte: from, $lte: to },
    ...(companyCode ? { companyCode } : {}), ...(userId ? { userId: new Types.ObjectId(userId) } : {}),
    ...(category ? { category } : {}), ...(result ? { result } : {}),
    ...(search ? { description: { $regex: literal(search), $options: "i" } } : {}),
  };
  return { filter, page, limit };
}

export function createActivityMonitorService(deps: {
  aggregate: (pipeline: PipelineStage[]) => Promise<any[]>;
  accounts: (filter: Query) => Promise<any[]>;
  now?: () => Date;
}) {
  return {
    async list(input: Query) {
      const now = deps.now?.() || new Date();
      const { filter, page, limit } = buildActivityMonitorQuery(input, now);
      const [snapshot] = await deps.aggregate([
        { $match: filter },
        { $facet: {
          data: [
            { $sort: { occurredAt: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit },
            { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "actor", pipeline: [{ $project: { displayName: 1, email: 1, role: 1 } }] } },
            { $project: {
              _id: 0, eventId: 1, userId: 1, companyCode: 1, branchId: 1, actionType: 1, category: 1,
              result: 1, description: 1, occurredAt: 1, method: 1, route: 1, sourceIp: 1,
              deviceSummary: 1, correlationId: 1, durationMs: 1, statusCode: 1, entityId: 1,
              actorName: { $arrayElemAt: ["$actor.displayName", 0] },
              actorEmail: { $arrayElemAt: ["$actor.email", 0] },
              actorRole: { $arrayElemAt: ["$actor.role", 0] },
            } },
          ],
          totals: [{ $group: { _id: null, total: { $sum: 1 }, failures: { $sum: { $cond: [{ $eq: ["$result", "failure"] }, 1, 0] } } } }],
          companies: [{ $group: { _id: "$companyCode" } }, { $count: "count" }],
          activeUsers: [{ $match: { occurredAt: { $gte: new Date(now.getTime() - 5 * 60_000) } } }, { $group: { _id: "$userId" } }, { $count: "count" }],
        } },
      ]);
      return {
        data: snapshot?.data || [], total: snapshot?.totals[0]?.total || 0, page, limit,
        summary: { failures: snapshot?.totals[0]?.failures || 0, companies: snapshot?.companies[0]?.count || 0, activeUsers: snapshot?.activeUsers[0]?.count || 0 },
        generatedAt: now.toISOString(), retentionDays: 90,
      };
    },
    async accounts(input: Query) {
      const companyCode = text(input.companyCode, "Doanh nghiệp").toUpperCase();
      const search = text(input.search, "Tìm tài khoản");
      return deps.accounts({ ...(companyCode ? { companyCode } : {}), ...(search ? { $or: [{ email: { $regex: literal(search), $options: "i" } }, { displayName: { $regex: literal(search), $options: "i" } }] } : {}) });
    },
  };
}

export const activityMonitorService = createActivityMonitorService({
  aggregate: (pipeline) => UserActivityEventModel.aggregate(pipeline),
  accounts: (filter) => UserModel.find(filter).select("_id displayName email companyCode role").sort({ displayName: 1, _id: 1 }).limit(100).lean().exec(),
});

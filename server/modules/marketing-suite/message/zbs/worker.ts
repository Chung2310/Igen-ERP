import { randomUUID } from "node:crypto";
import type { ZbsRow } from "../../../../../shared/marketing-suite/zbs";
import { getEffectivePermissions } from "../../../../middleware/auth";
import { UserModel } from "../../../../model/user.model";
import { assertAccountUsable } from "../../../../security/account-access";
import { companyModuleEnabled } from "../../shared/access";
import { ZbsBatchModel, ZbsOaLockModel, ZbsReceiptModel } from "./model";
import { fetchZbsTemplate, sendZbsRow } from "./provider";
import { templateHash, zbsError } from "./core";

const LEASE = 120_000;
export async function applyZbsReceipts(batchId: string) {
  const batch = await ZbsBatchModel.findById(batchId).lean();
  if (!batch) return;
  for (const row of batch.rows.filter(r => ["sending", "unknown", "accepted", "delivered"].includes(r.status))) {
    const keys: object[] = [{ trackingId: row.trackingId }];
    if (row.messageId) keys.push({ messageId: row.messageId });
    const receipts = await ZbsReceiptModel.find({ appId: batch.appId, oaId: batch.oaId, method: row.method, recipient: row.recipient, $or: keys }).sort({ status: 1 }).lean();
    for (const receipt of receipts) {
      const read = receipt.status === "read";
      await ZbsBatchModel.updateOne({ _id: batchId, rows: { $elemMatch: { id: row.id, status: { $in: read ? ["sending", "unknown", "accepted", "delivered"] : ["sending", "unknown", "accepted"] } } } }, {
        $set: { "rows.$.status": read ? "read" : "delivered", "rows.$.reason": "", "rows.$.messageId": receipt.messageId,
          [read ? "rows.$.readAt" : "rows.$.deliveredAt"]: receipt.at?.toISOString() },
      });
    }
  }
}
export async function processNextZbsMessage() {
  const now = new Date();
  await ZbsBatchModel.updateMany({ status: { $in: ["paused", "cancelled"] }, $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: { $exists: false } }], "rows.status": "sending" }, {
    $set: { "rows.$[row].status": "unknown", "rows.$[row].reason": "Worker gián đoạn khi gửi; cần đối soát trước khi gửi lại." },
  }, { arrayFilters: [{ "row.status": "sending" }] });
  const leaseToken = randomUUID();
  const batch = await ZbsBatchModel.findOneAndUpdate({ status: { $in: ["queued", "running"] },
    $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }] },
    { $set: { leaseUntil: new Date(+now + LEASE), leaseToken } }, { returnDocument: "after", sort: { updatedAt: 1 } }).lean();
  if (!batch) return false;
  const scope = { _id: batch._id, leaseToken };
  const lockId = `${batch.appId}:${batch.oaId}`;
  let locked = false;
  try {
    try { await ZbsOaLockModel.updateOne({ _id: lockId }, { $setOnInsert: { until: new Date(0), nextAt: new Date(0) } }, { upsert: true }); }
    catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
    locked = Boolean(await ZbsOaLockModel.findOneAndUpdate({ _id: lockId, until: { $lte: now }, nextAt: { $lte: now } }, { $set: { owner: leaseToken, until: new Date(+now + LEASE) } }));
    if (!locked) return false;
    // A previous process died after recording a send intent. Never replay that intent.
    await ZbsBatchModel.updateOne(scope, { $set: { "rows.$[row].status": "unknown", "rows.$[row].reason": "Worker gián đoạn khi gửi; cần đối soát trước khi gửi lại." } }, { arrayFilters: [{ "row.status": "sending" }] });
    await applyZbsReceipts(String(batch._id));
    const current = await ZbsBatchModel.findOne(scope).lean();
    if (!current || !["queued", "running"].includes(current.status)) return false;
    const row = current.rows.find(r => r.status === "pending");
    if (!row) { await ZbsBatchModel.updateOne({ ...scope, status: { $in: ["queued", "running"] } }, { $set: { status: "completed" } }); return true; }
    try {
      const user = await UserModel.findOne({ _id: batch.confirmedBy, companyCode: batch.companyCode }).lean();
      if (!user) throw zbsError("Người xác nhận không còn quyền gửi.", 403);
      await assertAccountUsable(user);
      const permissions = await getEffectivePermissions(String(user._id), user.role, batch.companyCode);
      if ((!permissions.has("*") && !permissions.has("omni-inbox:manage")) || !await companyModuleEnabled(batch.companyCode, "omni-inbox")) throw zbsError("Quyền gửi hoặc phân hệ đã bị thu hồi.", 403);
      const template = await fetchZbsTemplate(batch.companyCode, batch.oaId, batch.templateId, batch.appId);
      if (template.status !== "ENABLE" || templateHash(template) !== batch.templateHash) throw zbsError("Mẫu đã thay đổi; cần tạo bản xem trước mới.", 409);
    } catch (error) {
      await ZbsBatchModel.updateOne({ ...scope, status: { $in: ["queued", "running"] } }, { $set: { status: "paused", "rows.$[row].reason": error instanceof Error ? error.message : "Không thể kiểm tra quyền gửi." } }, { arrayFilters: [{ "row.status": "pending" }] });
      return true;
    }
    // Atomic claim also observes pause/cancel, which may arrive during provider validation.
    const claimed = await ZbsBatchModel.updateOne({ ...scope, leaseUntil: { $gt: new Date() }, status: { $in: ["queued", "running"] }, rows: { $elemMatch: { id: row.id, status: "pending" } } },
      { $set: { status: "running", "rows.$.status": "sending", "rows.$.reason": "" } });
    if (!claimed.modifiedCount) return false;
    let result: Partial<ZbsRow>;
    let pauseReason = "";
    try {
      const response = await sendZbsRow(batch.companyCode, batch.oaId, batch.templateId, row, batch.development, batch.appId);
      const messageId = response.data?.message_id || response.data?.msg_id;
      result = messageId ? { status: "accepted", messageId: String(messageId), sentAt: new Date().toISOString(), reason: "" }
        : { status: "unknown", reason: "Zalo tiếp nhận nhưng chưa trả mã tin. Cần đối soát." };
    } catch (error) {
      const known = typeof (error as { providerCode?: number }).providerCode === "number";
      result = { status: known ? "failed" : "unknown", reason: known && error instanceof Error ? error.message : "Chưa xác định kết quả. Cần đối soát trước khi gửi lại." };
      if ([-117, -131, -135, -136, -137, -138, -144, -147, -1471, -249].includes((error as { providerCode?: number }).providerCode || 0)) pauseReason = result.reason || "Cần kiểm tra cấu hình hoặc hạn mức OA.";
    }
    await ZbsBatchModel.updateOne({ ...scope, rows: { $elemMatch: { id: row.id, status: "sending" } } }, {
      $set: Object.fromEntries(Object.entries(result).map(([key, value]) => [`rows.$.${key}`, value])),
    });
    await applyZbsReceipts(String(batch._id));
    if (pauseReason) await ZbsBatchModel.updateOne({ ...scope, status: "running", "rows.status": "pending" }, {
      $set: { status: "paused", "rows.$[row].reason": pauseReason },
    }, { arrayFilters: [{ "row.status": "pending" }] });
    const remaining = await ZbsBatchModel.exists({ _id: batch._id, "rows.status": "pending" });
    if (!remaining) await ZbsBatchModel.updateOne({ ...scope, status: "running" }, { $set: { status: "completed" } });
    return true;
  } finally {
    if (locked) await ZbsOaLockModel.updateOne({ _id: lockId, owner: leaseToken }, { $set: { until: new Date(), nextAt: new Date(Date.now() + 1000) } });
    await ZbsBatchModel.updateOne(scope, { $unset: { leaseUntil: 1, leaseToken: 1 } });
  }
}
let stopWorker: (() => Promise<void>) | undefined;
export function startZbsWorker() {
  if (stopWorker) return stopWorker;
  let active: Promise<unknown> | undefined;
  let stopped = false;
  const tick = () => {
    if (active || stopped) return;
    active = processNextZbsMessage().catch(() => { console.error("[ZBS worker] Không thể xử lý hàng đợi."); }).finally(() => { active = undefined; });
  };
  const timer = setInterval(tick, 1000); timer.unref(); tick();
  stopWorker = async () => { stopped = true; clearInterval(timer); await active; stopWorker = undefined; };
  return stopWorker;
}

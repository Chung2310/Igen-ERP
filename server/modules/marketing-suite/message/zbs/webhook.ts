import { ZbsReceiptModel } from "./model";
import { applyZbsReceipts } from "./worker";
import { ZbsBatchModel } from "./model";

// Caller verifies the raw-body signature before entering this function.
export async function receiveZbsReceipt(body: any, serverHeader?: string) {
  if (!["user_received_message", "user_seen_message"].includes(body?.event_name)) return false;
  const phone = serverHeader?.toUpperCase() === "ZNS";
  if (phone && body.event_name !== "user_received_message") return true;
  const appId = String(body.app_id || "");
  const oaId = String(body.sender?.id || "");
  const recipient = String(body.recipient?.id || "");
  const message = body.message || {};
  const entries = Array.isArray(message.msg_ids) ? message.msg_ids.map((msg_id: string) => ({ msg_id })) : Array.isArray(message) ? message : [message];
  for (const item of entries) {
    const messageId = String(item.msg_id || item.message_id || "");
    const at = new Date(Number(item.delivery_time || body.timestamp));
    if (!appId || !oaId || !recipient || !messageId || !Number.isFinite(+at)) continue;
    const key = { appId, oaId, method: phone ? "phone" : "uid", messageId, status: body.event_name === "user_seen_message" ? "read" : "delivered" };
    try { await ZbsReceiptModel.updateOne(key, { $setOnInsert: { ...key, trackingId: String(item.tracking_id || ""), recipient, at, receivedAt: new Date() } }, { upsert: true }); }
    catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
    const batches = await ZbsBatchModel.find({ appId, oaId, rows: { $elemMatch: { method: key.method, recipient, $or: [{ messageId }, ...(item.tracking_id ? [{ trackingId: String(item.tracking_id) }] : [])] } } }).select("_id").lean();
    for (const batch of batches) await applyZbsReceipts(String(batch._id));
  }
  return phone;
}

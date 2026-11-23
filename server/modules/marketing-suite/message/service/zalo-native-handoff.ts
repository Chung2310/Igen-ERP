import { ZaloConversationModel, ZaloMessageModel } from "../model/zalo-messenger.model";
import { recordZaloHumanReply } from "./zalo-human-reply";

export class ZaloHistoryUnavailableError extends Error {
  readonly code = "ZALO_HISTORY_UNAVAILABLE";
  constructor() { super("Không kiểm tra được lịch sử Zalo. Kiểm tra quyền quản lý tin nhắn và kết nối OA; AI chưa gửi để tránh trả lời cùng nhân viên."); }
}

/** Check the actual OA conversation immediately before an AI send, including
 * when the admin webhook is missing or delayed. Never import old
 * customer history, and never mistake an already recorded ERP send for staff. */
export async function syncZaloNativeHandoff(oaId: string, conversationId: string, token: string, options?: { forceRead?: boolean }): Promise<boolean> {
  const conversation = await ZaloConversationModel.findOne({ _id: conversationId, oaId }).lean();
  if (!conversation) throw new ZaloHistoryUnavailableError();
  if (!options?.forceRead && conversation.aiPausedUntil && conversation.aiPausedUntil > new Date()) return true;
  const query = encodeURIComponent(JSON.stringify({ user_id: conversation.recipientId, offset: 0, count: 10 }));
  let data: unknown;
  try {
    const response = await fetch(`https://openapi.zalo.me/v2.0/oa/conversation?data=${query}`, {
      headers: { access_token: token }, signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new ZaloHistoryUnavailableError();
    data = await response.json();
  } catch {
    throw new ZaloHistoryUnavailableError();
  }
  if (!data || typeof data !== "object" || !("error" in data) || data.error !== 0
    || !("data" in data) || !Array.isArray(data.data)) throw new ZaloHistoryUnavailableError();
  const now = Date.now();
  const candidates = data.data.flatMap((row: unknown) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    if (item.src !== 0 && item.src !== "0") return [];
    if ((item.from_id !== undefined && String(item.from_id) !== oaId)
      || (item.to_id !== undefined && String(item.to_id) !== conversation.recipientId)) return [];
    const messageId = typeof item.message_id === "string" ? item.message_id.trim() : "";
    const rawTime = Number(item.time);
    const time = rawTime > 100_000_000_000 ? rawTime : rawTime * 1000;
    if (!messageId || !Number.isFinite(time) || time <= now - 30 * 60_000 || time > now) return [];
    const url = typeof item.url === "string" ? item.url : "";
    return [{ messageId, timestamp: new Date(time), text: typeof item.message === "string" ? item.message : "",
      attachments: url ? [{ type: item.type === "photo" ? "image" : String(item.type || "file"), url }] : [],
    }];
  }).sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime());
  for (const candidate of candidates) {
    const known = await ZaloMessageModel.exists({ conversationId, senderId: oaId,
      recipientId: conversation.recipientId, messageId: candidate.messageId, direction: "outbound" });
    if (known) continue;
    await recordZaloHumanReply({ oaId, recipientId: conversation.recipientId, ...candidate });
    console.info("[Zalo handoff] Native OA reply detected before AI delivery", {
      oaId, conversationId, messageId: candidate.messageId,
    });
  }
  return Boolean(await ZaloConversationModel.exists({ _id: conversationId, oaId, aiPausedUntil: { $gt: new Date() } }));
}

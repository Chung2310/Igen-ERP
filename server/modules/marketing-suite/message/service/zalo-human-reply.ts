import { ZaloConversationModel, ZaloMessageModel } from "../model/zalo-messenger.model";
import { FacebookAutoReplyJobModel } from "../model/facebook-auto-reply-job.model";
import { emitToMessengerAccount } from "../../shared/socket";

export const ZALO_OA_MESSAGE_EVENTS = ["oa_send_text", "oa_send_image", "oa_send_gif", "oa_send_list", "oa_send_file", "oa_send_sticker"];

export function isZaloHumanReply(body: { event_name?: string; sender?: { admin_id?: string } }) {
  return ZALO_OA_MESSAGE_EVENTS.includes(body.event_name || "") && typeof body.sender?.admin_id === "string" && Boolean(body.sender.admin_id.trim());
}

// OA Admin supplies admin_id; API echoes must never pause the bot.
export async function handleZaloHumanReply(body: any, oaId: string) {
  const recipientId = String(body.recipient?.id || "");
  const messageId = String(body.message?.msg_id || "");
  const time = Number(body.timestamp);
  if (!recipientId || !messageId || !Number.isFinite(time) || time <= 0) return;
  const timestamp = new Date(Math.min(time > 100_000_000_000 ? time : time * 1000, Date.now()));
  await recordZaloHumanReply({ oaId, recipientId, messageId, timestamp,
    text: typeof body.message?.text === "string" ? body.message.text : "",
    attachments: (Array.isArray(body.message?.attachments) ? body.message.attachments : []).map((item: any) => ({
      type: String(item.type || "file"), url: String(item.payload?.url || ""),
    })),
  });
}

/** Shared by verified OA Admin webhooks and the authenticated OA history API. */
export async function recordZaloHumanReply(input: {
  oaId: string; recipientId: string; messageId: string; timestamp: Date; text: string;
  attachments: Array<{ type: string; url: string }>;
}) {
  const { oaId, recipientId, messageId, timestamp, text, attachments } = input;
  if (await ZaloMessageModel.exists({ messageId, senderId: oaId, recipientId, direction: "outbound" })) return;
  const pauseUntil = new Date(timestamp.getTime() + 30 * 60 * 1000);
  const conversation = await ZaloConversationModel.findOneAndUpdate({ oaId, recipientId }, {
    $setOnInsert: { oaId, recipientId, lastMessageAt: timestamp },
  }, { upsert: true, returnDocument: "after" });
  if (!conversation) return;
  const conversationId = String(conversation._id);
  const paused = await ZaloConversationModel.updateOne({
    _id: conversation._id, oaId,
    $or: [{ lastHumanReplyAt: null }, { lastHumanReplyAt: { $lt: timestamp } }],
  }, { $set: { lastHumanReplyAt: timestamp }, $max: { aiPausedUntil: pauseUntil } });
  if (paused.modifiedCount && pauseUntil > new Date()) {
    const { aiAutoReplyService } = await import("./ai-auto-reply.service");
    aiAutoReplyService.cancelPendingReply(conversationId, "human_reply", "zalo");
    await FacebookAutoReplyJobModel.updateOne({ channel: "zalo", conversationId, status: { $in: ["pending", "processing"] } }, {
      $set: { status: "cancelled", lastError: "Cancelled after an OA administrator replied." },
      $unset: { leaseToken: 1, leaseUntil: 1 },
    });
  }
  await ZaloMessageModel.updateOne({ messageId }, { $setOnInsert: {
    conversationId: conversation._id, senderId: oaId, recipientId, direction: "outbound", text,
    attachments, timestamp, status: "sent",
  } }, { upsert: true });
  await ZaloConversationModel.updateOne({ _id: conversation._id, lastMessageAt: { $lte: timestamp } }, {
    $set: { lastMessageText: text, lastMessageAt: timestamp, followUpStatus: "responded" },
  });
  await ZaloConversationModel.updateOne({ _id: conversation._id,
    $or: [{ lastAssistantMessageAt: null }, { lastAssistantMessageAt: { $lte: timestamp } }],
  }, {
    $set: { followUpStatus: "responded" },
  });
  const current = await ZaloConversationModel.findById(conversation._id);
  const message = await ZaloMessageModel.findOne({ messageId });
  emitToMessengerAccount("zalo", oaId, "new_message", { message, conversation: current });
  emitToMessengerAccount("zalo", oaId, "conversation_updated", current);
}

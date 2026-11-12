import { ZaloConversationModel, ZaloMessageModel, type IZaloConversation } from "../model/zalo-messenger.model";
import { MessengerBackgroundJobModel } from "../model/messenger-background-job.model";

export const zaloMessageOrder = { timestamp: -1, _id: -1 } as const;

export class ZaloReplyCancelledError extends Error {}

export function readZaloFollowUpMessages(conversationId: string) {
  return ZaloMessageModel.find({ conversationId }).sort(zaloMessageOrder).limit(10).lean()
    .then(messages => messages.reverse());
}

type ZaloFollowUpTurn = Pick<IZaloConversation, "_id" | "oaId" | "recipientId" | "lastAssistantMessageAt" | "lastAssistantMessageId">;

export function zaloFollowUpTurn(conversation: ZaloFollowUpTurn) {
  return {
    _id: conversation._id, oaId: conversation.oaId, recipientId: conversation.recipientId, status: "open" as const,
    lastSender: "assistant" as const, lastAssistantMessageAt: conversation.lastAssistantMessageAt,
    ...(conversation.lastAssistantMessageId ? { lastAssistantMessageId: conversation.lastAssistantMessageId } : {}),
    followUpStatus: "pending" as const, followUpCount: { $lt: 1 },
  };
}

export async function assertZaloDeliveryCurrent(
  conversationId: string,
  oaId: string,
  expectedMessageId: string,
  followUp?: ZaloFollowUpTurn,
) {
  // Read the webhook queue first so an inbound moving from the queue to the inbox is still checked below.
  if (followUp && await MessengerBackgroundJobModel.exists({
    kind: "zalo-webhook", status: { $in: ["pending", "processing"] },
    "payload.oa_id": oaId, "payload.sender.id": followUp.recipientId,
  })) throw new ZaloReplyCancelledError();

  const [conversation, latest] = await Promise.all([
    ZaloConversationModel.exists({
      ...(followUp ? zaloFollowUpTurn(followUp) : { _id: conversationId, oaId, status: "open" }),
      "pendingInboundMessageIds.0": { $exists: false },
      $or: [{ aiPausedUntil: null }, { aiPausedUntil: { $lte: new Date() } }],
    }),
    ZaloMessageModel.findOne({ conversationId }).sort(zaloMessageOrder).select("messageId").lean(),
  ]);
  if (!conversation || latest?.messageId !== expectedMessageId) throw new ZaloReplyCancelledError();
}

import { randomUUID } from "node:crypto";
import { FBConversationModel, FBMessageModel } from "../model/fb-messenger.model.ts";
import { FacebookFollowUpJobModel } from "../model/facebook-follow-up-job.model.ts";

const LEASE_MS = 300_000;
const MAX_ATTEMPTS = 3;

export type FacebookFollowUpLease = {
  companyCode: string;
  pageId: string;
  conversationId: string;
  sourceMessageId: string;
  leaseToken: string;
  attempts: number;
};

export class FacebookFollowUpCancelledError extends Error {
  constructor() { super("Facebook follow-up is no longer current."); }
}

function key(turn: Omit<FacebookFollowUpLease, "leaseToken" | "attempts">) {
  return { companyCode: turn.companyCode, pageId: turn.pageId,
    conversationId: turn.conversationId, sourceMessageId: turn.sourceMessageId };
}

function leaseFilter(turn: FacebookFollowUpLease) {
  return { ...key(turn), status: "processing" as const, leaseToken: turn.leaseToken,
    leaseUntil: { $gt: new Date() } };
}

async function stopFacebookFollowUp(turn: Omit<FacebookFollowUpLease, "leaseToken" | "attempts">) {
  await FBConversationModel.updateOne({ _id: turn.conversationId, pageId: turn.pageId,
    lastAssistantMessageId: turn.sourceMessageId, followUpStatus: "pending",
  }, { $set: { followUpStatus: "idle" } });
}

export async function claimFacebookFollowUp(input: Omit<FacebookFollowUpLease, "leaseToken" | "attempts">) {
  await FacebookFollowUpJobModel.init();
  const now = new Date();
  const interrupted = await FacebookFollowUpJobModel.findOneAndUpdate({
    companyCode: input.companyCode, pageId: input.pageId, conversationId: input.conversationId,
    status: "processing", leaseUntil: { $lte: now }, deliveryStartedAt: { $exists: true },
  }, {
    $set: { status: "failed", lastError: "Delivery was interrupted; check the conversation before sending again." },
    $unset: { leaseToken: 1, leaseUntil: 1 },
  }, { new: true });
  if (interrupted) {
    await stopFacebookFollowUp({ ...input, sourceMessageId: interrupted.sourceMessageId });
    throw new Error("Facebook follow-up delivery was interrupted; staff must check the conversation.");
  }
  const conversation = await FBConversationModel.findOne({ _id: input.conversationId, pageId: input.pageId }).lean();
  if (!conversation) return null;
  if (conversation.lastAssistantMessageId && conversation.lastAssistantMessageId !== input.sourceMessageId) {
    const previous = { ...input, sourceMessageId: conversation.lastAssistantMessageId };
    if (await FacebookFollowUpJobModel.exists({ ...key(previous), status: { $in: ["completed", "failed"] } })) {
      await stopFacebookFollowUp(previous);
    }
    return null;
  }
  // Bind legacy conversations once; a follow-up must never become the source of another follow-up.
  const bound = await FBConversationModel.updateOne({ _id: input.conversationId, pageId: input.pageId,
    lastMessageAt: conversation.lastMessageAt, lastAssistantMessageAt: conversation.lastAssistantMessageAt,
    lastAssistantMessageId: conversation.lastAssistantMessageId ?? null,
    lastSender: "assistant", followUpStatus: "pending", followUpCount: { $lt: 1 }, status: "open",
    $or: [{ aiPausedUntil: null }, { aiPausedUntil: { $lte: new Date() } }],
  }, { $set: { lastAssistantMessageId: input.sourceMessageId } });
  if (!bound.matchedCount) return null;
  if (await FacebookFollowUpJobModel.exists({ ...key(input), status: { $in: ["completed", "cancelled", "failed"] } })) {
    await stopFacebookFollowUp(input);
    return null;
  }
  try {
    await FacebookFollowUpJobModel.updateOne(key(input), {
      $setOnInsert: { ...input, status: "pending", attempts: 0 },
    }, { upsert: true });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  const exhausted = await FacebookFollowUpJobModel.updateOne({ ...key(input), attempts: { $gte: MAX_ATTEMPTS },
    $or: [{ status: "pending" }, { status: "processing", leaseUntil: { $lte: now } }],
  }, { $set: { status: "failed", lastError: "Maximum Facebook follow-up retry count reached." },
    $unset: { leaseToken: 1, leaseUntil: 1 } });
  if (exhausted.matchedCount) {
    await stopFacebookFollowUp(input);
    return null;
  }
  const leaseToken = randomUUID();
  const job = await FacebookFollowUpJobModel.findOneAndUpdate({ ...key(input),
    attempts: { $lt: MAX_ATTEMPTS }, deliveryStartedAt: { $exists: false },
    $or: [{ status: "pending" }, { status: "processing", leaseUntil: { $lte: now } }],
  }, { $set: { status: "processing", leaseToken, leaseUntil: new Date(now.getTime() + LEASE_MS) },
    $inc: { attempts: 1 } }, { new: true });
  return job ? { ...input, leaseToken, attempts: job.attempts } : null;
}

export async function renewFacebookFollowUp(turn: FacebookFollowUpLease) {
  await FacebookFollowUpJobModel.updateOne(leaseFilter(turn), {
    $set: { leaseUntil: new Date(Date.now() + LEASE_MS) },
  });
}

export async function isFacebookFollowUpCurrent(turn: FacebookFollowUpLease) {
  if (!await FacebookFollowUpJobModel.exists(leaseFilter(turn))) return false;
  const conversation = await FBConversationModel.findOne({ _id: turn.conversationId, pageId: turn.pageId,
    lastAssistantMessageId: turn.sourceMessageId,
    lastSender: "assistant", followUpStatus: "pending", followUpCount: { $lt: 1 }, status: "open",
    $or: [{ aiPausedUntil: null }, { aiPausedUntil: { $lte: new Date() } }],
  }).lean();
  if (!conversation) return false;
  const latest = await FBMessageModel.findOne({ conversationId: turn.conversationId })
    .sort({ timestamp: -1, createdAt: -1, _id: -1 }).lean();
  return latest?.direction === "outbound" && latest.messageId === turn.sourceMessageId;
}

export async function beginFacebookFollowUpDelivery(turn: FacebookFollowUpLease) {
  if (!await isFacebookFollowUpCurrent(turn)) throw new FacebookFollowUpCancelledError();
  const result = await FacebookFollowUpJobModel.updateOne({ ...leaseFilter(turn),
    deliveryStartedAt: { $exists: false } }, { $set: { deliveryStartedAt: new Date() } });
  if (!result.matchedCount) throw new FacebookFollowUpCancelledError();
}

export async function settleFacebookFollowUp(turn: FacebookFollowUpLease, outcome: "completed" | "cancelled" | "error", error?: unknown) {
  const filter = { ...key(turn), status: "processing" as const, leaseToken: turn.leaseToken };
  const job = await FacebookFollowUpJobModel.findOne(filter).lean();
  if (!job) return;
  const status = outcome === "error"
    ? job.deliveryStartedAt || turn.attempts >= MAX_ATTEMPTS ? "failed" : "pending"
    : outcome;
  await FacebookFollowUpJobModel.updateOne(filter, { $set: { status,
    lastError: error ? String((error as Error)?.message || error).slice(0, 1000) : "",
    ...(status === "completed" || status === "cancelled" ? { completedAt: new Date() } : {}),
  }, $unset: { leaseToken: 1, leaseUntil: 1 } });
  if (status === "failed") await stopFacebookFollowUp(turn);
}

/** Do not overwrite a customer/human turn that arrived while an AI reply was being sent. */
export async function recordFacebookAssistantTurn(conversationId: string, pageId: string, messageId: string, followUp = false) {
  const conversation = await FBConversationModel.findOne({ _id: conversationId, pageId }).lean();
  if (!conversation) return;
  const latest = await FBMessageModel.findOne({ conversationId })
    .sort({ timestamp: -1, createdAt: -1, _id: -1 }).lean();
  if (latest?.direction !== "outbound" || latest.messageId !== messageId) return;
  await FBConversationModel.updateOne({ _id: conversationId, pageId,
    lastMessageAt: conversation.lastMessageAt,
    $or: [{ aiPausedUntil: null }, { aiPausedUntil: { $lte: new Date() } }],
  }, { $set: { lastSender: "assistant", lastAssistantMessageAt: latest.timestamp,
    lastAssistantMessageId: messageId,
    followUpStatus: followUp ? "sent" : "pending", followUpCount: followUp ? 1 : 0 } });
}

import { randomUUID } from "node:crypto";
import { FacebookAutoReplyJobModel, type MessengerAutoReplyChannel } from "../model/facebook-auto-reply-job.model.ts";

export const MESSENGER_REPLY_MAX_ATTEMPTS = 8;
export const MESSENGER_REPLY_LEASE_MS = 300_000;
export const MESSENGER_REPLY_RETRY_BASE_MS = 30_000;
export const FACEBOOK_INBOUND_DISPATCH_LEASE_MS = 5 * 60_000;

export function requireFacebookReplyText(text: unknown) {
  if (typeof text !== "string" || !text.trim()) throw new Error("AI returned an empty Facebook reply.");
}

export function messengerReplyOutcome(attempts: number, sendingStarted: boolean, error?: unknown) {
  const failed = error !== undefined;
  return {
    status: failed ? (sendingStarted || attempts >= MESSENGER_REPLY_MAX_ATTEMPTS ? "failed" as const : "pending" as const) : "completed" as const,
    backoffMs: Math.min(3_600_000, MESSENGER_REPLY_RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1)),
  };
}

type IncomingJob = {
  conversationId: string; pageId: string; companyCode: string; messageId: string;
  messageTimestamp: Date; messageCreatedAt: Date; text: string; nextAttemptAt: Date;
  messageObjectId?: string;
};

/** Duplicate triggers never rewrite a lease, delivery marker, attempt count or due time. */
export async function enqueueMessengerReply(input: IncomingJob, channel: MessengerAutoReplyChannel = "facebook") {
  await FacebookAutoReplyJobModel.init();
  const key = { channel, conversationId: input.conversationId };
  // Insert only. A concurrent insert cannot reset the winner's state.
  try {
    await FacebookAutoReplyJobModel.updateOne(key, {
      $setOnInsert: { ...input, channel, status: "pending", attempts: 0 },
    }, { upsert: true });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  await FacebookAutoReplyJobModel.updateOne({
    ...key, messageId: { $ne: input.messageId },
    $and: [
      { $or: [
        { messageTimestamp: { $lt: input.messageTimestamp } },
        { messageTimestamp: input.messageTimestamp, messageCreatedAt: { $lt: input.messageCreatedAt } },
        ...(input.messageObjectId ? [{ messageTimestamp: input.messageTimestamp,
          messageCreatedAt: input.messageCreatedAt, messageObjectId: { $lt: input.messageObjectId } }] : []),
        { messageTimestamp: { $exists: false } },
      ] },
      // Preserve a failed turn until its staff handoff has been persisted.
      ...(channel === "facebook" ? [{ $or: [{ status: { $ne: "failed" as const } }, { failureNotifiedAt: { $exists: true } }] }] : []),
    ],
  }, {
    $set: { ...input, status: "pending", attempts: 0, lastError: "" },
    $unset: { leaseToken: 1, leaseUntil: 1, completedAt: 1, deliveryStartedAt: 1, failureNotifiedAt: 1 },
  });
  const job = await FacebookAutoReplyJobModel.findOne(key).lean();
  if (!job || job.messageId !== input.messageId || job.attempts >= MESSENGER_REPLY_MAX_ATTEMPTS) return null;
  if (job.status === "pending") return job.nextAttemptAt;
  if (job.status === "processing" && !job.deliveryStartedAt && job.leaseUntil && job.leaseUntil <= new Date()) {
    return new Date();
  }
  return null;
}

export async function claimMessengerReply(conversationId: string, messageId: string, channel: MessengerAutoReplyChannel = "facebook") {
  const now = new Date();
  const leaseToken = randomUUID();
  const job = await FacebookAutoReplyJobModel.findOneAndUpdate({
    channel, conversationId, messageId, attempts: { $lt: MESSENGER_REPLY_MAX_ATTEMPTS },
    deliveryStartedAt: { $exists: false },
    $or: [
      { status: "pending", nextAttemptAt: { $lte: now } },
      { status: "processing", leaseUntil: { $lte: now } },
    ],
  }, { $set: { status: "processing", leaseToken, leaseUntil: new Date(now.getTime() + MESSENGER_REPLY_LEASE_MS) },
    $inc: { attempts: 1 } }, { new: true });
  return job ? { job, leaseToken } : null;
}

export function messengerReplyLease(conversationId: string, messageId: string, leaseToken: string, channel: MessengerAutoReplyChannel = "facebook") {
  return { channel, conversationId, messageId, status: "processing" as const, leaseToken,
    leaseUntil: { $gt: new Date() } };
}

export async function markMessengerReplySending(conversationId: string, messageId: string, leaseToken: string, channel: MessengerAutoReplyChannel = "facebook") {
  const result = await FacebookAutoReplyJobModel.updateOne(messengerReplyLease(conversationId, messageId, leaseToken, channel),
    { $set: { deliveryStartedAt: new Date() } });
  return result.matchedCount > 0;
}

export async function expireMessengerReplyJobs(now = new Date(), channel: MessengerAutoReplyChannel = "facebook") {
  await FacebookAutoReplyJobModel.updateMany({
    channel, status: "processing", deliveryStartedAt: { $exists: true }, leaseUntil: { $lte: now },
  }, { $set: { status: "failed", lastError: `Delivery was interrupted after a ${channel} send began; staff must check the conversation before replying.` },
    $unset: { leaseToken: 1, leaseUntil: 1 } });
  await FacebookAutoReplyJobModel.updateMany({
    channel, attempts: { $gte: MESSENGER_REPLY_MAX_ATTEMPTS },
    $or: [
      { status: "pending", nextAttemptAt: { $lte: now } },
      { status: "processing", leaseUntil: { $lte: now } },
    ],
  }, { $set: { status: "failed", lastError: "Maximum retry count reached or worker stopped before completion." },
    $unset: { leaseToken: 1, leaseUntil: 1 } });
}

import { createHash, randomUUID } from "node:crypto";
import { MessengerBackgroundJobModel, type MessengerBackgroundJobKind } from "../model/messenger-background-job.model";
import { ZaloConversationModel, ZaloMessageModel } from "../model/zalo-messenger.model";
import { enabledLeadContractAccount, TelecomInvoiceSettingsModel } from "../model/telecom-invoice.model";
import { startQueueRecovery } from "../../shared/queue-recovery";
import { withAiUsage } from "../../shared/service/ai-subscription.service";
import type { ChatOrderFlowInput } from "./chat-ordering/core/types";
import type { LeadContractMessageJob } from "./lead-contract-ocr";

const ZALO_MESSAGE_EVENTS = new Set(["user_send_text", "user_send_image", "user_send_link", "user_send_sticker"]);
const LEASE_MS = 120_000;
const MAX_ATTEMPTS = 8;

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

async function enqueue(kind: MessengerBackgroundJobKind, key: string[], payload: object) {
  const _id = `${kind}:${hash(JSON.stringify(key))}`;
  try {
    await MessengerBackgroundJobModel.updateOne({ _id }, {
      $setOnInsert: { kind, payload, status: "pending", attempts: 0, dueAt: new Date() },
    }, { upsert: true, maxTimeMS: 3_000, writeConcern: { w: "majority", j: true, wtimeout: 3_000 } });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
}

type ZaloWebhookPayload = {
  event_name?: string;
  oa_id?: string;
  recipient?: { id?: string };
  sender?: { id?: string };
  message?: { msg_id?: string };
};

export async function enqueueZaloWebhook(body: ZaloWebhookPayload, rawBody?: string) {
  if (!body.event_name || !ZALO_MESSAGE_EVENTS.has(body.event_name)) return;
  const oaId = String(body.oa_id || body.recipient?.id || "");
  const senderId = String(body.sender?.id || "");
  if (!oaId || !senderId) return;
  const messageId = String(body.message?.msg_id || `zalo_in_${hash(rawBody ?? JSON.stringify(body))}`);
  await enqueue("zalo-webhook", [oaId, senderId, messageId], {
    ...body, oa_id: oaId, sender: { ...body.sender, id: senderId }, message: { ...body.message, msg_id: messageId },
  });
}

export function enqueueLeadIntakeRetry(input: ChatOrderFlowInput) {
  const { companyCode, platform = "facebook", pageId, conversationId, messageId, messageAt, message, history } = input;
  return enqueue("lead-intake", [companyCode, platform, pageId, conversationId, messageId], {
    companyCode, platform, pageId, conversationId, messageId, message,
    ...(messageAt ? { messageAt } : {}),
    ...(history?.length ? { history } : {}),
  });
}

export async function enqueueLeadContractOcr(input: Omit<LeadContractMessageJob, "companyCode">, attachments: Array<{ type?: string }> = []) {
  if (!attachments.length) return;
  try {
    const { isLeadContractImage } = await import("./lead-contract-ocr");
    if (!attachments.some(isLeadContractImage)) return;
    const settings = await TelecomInvoiceSettingsModel.find(enabledLeadContractAccount(input)).select("companyCode").lean();
    if (!settings.length) return;
    const { canProcessMessengerWebhook } = await import("../webhook-access");
    for (const { companyCode } of settings) {
      if (!await canProcessMessengerWebhook(input.platform === "zalo" ? "Zalo" : "Facebook", input.pageId, companyCode)) continue;
      await enqueue("lead-contract-ocr", [companyCode, input.platform, input.pageId, input.conversationId, input.messageId], { ...input, companyCode });
      return;
    }
  } catch (error) {
    console.error("[Messenger jobs] Không xếp được tác vụ OCR hợp đồng", {
      platform: input.platform, messageId: input.messageId, error: error instanceof Error ? error.name : typeof error,
    });
  }
}

async function processJob(kind: MessengerBackgroundJobKind, payload: unknown) {
  if (kind === "zalo-webhook") {
    const { zaloMessengerService } = await import("./zalo-messenger.service");
    await zaloMessengerService.handleWebhookEvent(payload, { resumeDispatch: true });
    return;
  }
  if (kind === "lead-contract-ocr") {
    const { processLeadContractMessage } = await import("./lead-contract-ocr");
    await processLeadContractMessage(payload as LeadContractMessageJob);
    return;
  }
  const { canProcessMessengerWebhook } = await import("../webhook-access");
  const { chatOrderFlowRegistry } = await import("./chat-ordering/registry");
  const input = payload as ChatOrderFlowInput;
  if (!await canProcessMessengerWebhook(input.platform === "zalo" ? "Zalo" : "Facebook", input.pageId, input.companyCode)) return;
  const flow = await chatOrderFlowRegistry.resolveForCompanyPage(input.companyCode, input.pageId, input.platform);
  if (flow?.key !== "page-intake") return;
  await withAiUsage({ companyCode: input.companyCode }, async () => {
    await flow.process({ ...input, imageUrls: [], retryIntake: true });
  });
}

async function clearFailedZaloInbound(payload: ZaloWebhookPayload) {
  const { oa_id: oaId, sender, message } = payload;
  if (!oaId || !sender?.id || !message?.msg_id) return;
  const pendingId = message.msg_id;
  const conversations = await ZaloConversationModel.find({
    recipientId: sender.id, pendingInboundMessageIds: pendingId,
    // The Zalo developer console uses a placeholder OA which the webhook resolves later.
    ...(oaId === "579745863508352884" ? {} : { oaId }),
  }).select("_id").lean();
  for (const conversation of conversations) {
    const persisted = await ZaloMessageModel.exists({ conversationId: conversation._id, messageId: pendingId, direction: "inbound" });
    const filter = { _id: conversation._id, pendingInboundMessageIds: pendingId };
    if (persisted) {
      await ZaloConversationModel.updateOne(filter, { $pull: { pendingInboundMessageIds: pendingId } });
    } else {
      await ZaloConversationModel.updateOne(filter, [{ $set: {
        pendingInboundMessageIds: { $filter: {
          input: "$pendingInboundMessageIds", cond: { $ne: ["$$this", { $literal: pendingId }] },
        } },
        unreadCount: { $max: [0, { $subtract: [{ $ifNull: ["$unreadCount", 0] }, 1] }] },
      } }], { updatePipeline: true });
    }
  }
}

async function recoverFailedZaloInboundMarkers() {
  const jobs = await MessengerBackgroundJobModel.find({
    kind: "zalo-webhook", status: "failed", inboundCleanupAt: { $exists: false }, payload: { $exists: true },
  }).limit(20).lean();
  for (const job of jobs) {
    await clearFailedZaloInbound(job.payload as ZaloWebhookPayload);
    await MessengerBackgroundJobModel.updateOne({ _id: job._id, status: "failed" }, {
      $set: { inboundCleanupAt: new Date() },
    });
  }
}

async function runJobs(kind: MessengerBackgroundJobKind) {
  for (let index = 0; index < 20; index++) {
    const now = new Date();
    const leaseToken = randomUUID();
    const nextLease = () => new Date(Date.now() + LEASE_MS);
    const job = await MessengerBackgroundJobModel.findOneAndUpdate({
      kind,
      $or: [{ status: "pending", dueAt: { $lte: now } }, { status: "processing", leaseUntil: { $lte: now } }],
    }, {
      $set: { status: "processing", leaseToken, leaseUntil: nextLease() },
      $inc: { attempts: 1 },
    }, { returnDocument: "after", sort: { dueAt: 1, _id: 1 } }).lean();
    if (!job) return;

    const lease = { _id: job._id, leaseToken, status: "processing" as const };
    const heartbeat = setInterval(() => {
      void MessengerBackgroundJobModel.updateOne(lease, { $set: { leaseUntil: nextLease() } })
        .catch(error => console.error("[Messenger jobs] Lease renewal failed", kind, job._id, error?.name));
    }, LEASE_MS / 4);
    heartbeat.unref();
    try {
      if (job.attempts > MAX_ATTEMPTS) throw new Error("Retry limit exceeded");
      await processJob(kind, job.payload);
      await MessengerBackgroundJobModel.updateOne(lease, {
        $set: { status: "completed", completedAt: new Date() },
        $unset: { leaseToken: 1, leaseUntil: 1, payload: 1 },
      });
    } catch (error) {
      const failed = job.attempts >= MAX_ATTEMPTS;
      const dueAt = new Date(Date.now() + Math.min(5_000 * 2 ** (job.attempts - 1), 300_000));
      console.error("[Messenger jobs] Processing failed", { kind, jobId: job._id, attempt: job.attempts, failed,
        error: error instanceof Error ? error.name : typeof error });
      if (failed && kind === "zalo-webhook" && job.payload) {
        // Keep the job recoverable if MongoDB also fails during marker cleanup.
        await clearFailedZaloInbound(job.payload as ZaloWebhookPayload);
      }
      await MessengerBackgroundJobModel.updateOne(lease, {
        $set: failed ? { status: "failed", completedAt: new Date(),
          ...(kind === "zalo-webhook" ? { inboundCleanupAt: new Date() } : {}),
        } : { status: "pending", dueAt },
        $unset: { leaseToken: 1, leaseUntil: 1 },
      });
    } finally {
      clearInterval(heartbeat);
    }
  }
}

export function startMessengerBackgroundWorkers() {
  const timers = [
    startQueueRecovery(() => runJobs("zalo-webhook"), 1_000),
    startQueueRecovery(async () => {
      const { recoverZaloAutoReplyJobs } = await import("./ai-auto-reply.service");
      await recoverZaloAutoReplyJobs();
    }, 5_000),
    startQueueRecovery(recoverFailedZaloInboundMarkers, 10_000),
    startQueueRecovery(() => runJobs("lead-intake"), 3_000),
    startQueueRecovery(() => runJobs("lead-contract-ocr"), 3_000),
  ];
  return () => timers.forEach(clearInterval);
}

import { createHash, randomUUID } from "node:crypto";
import { MessengerBackgroundJobModel, type MessengerBackgroundJobKind } from "../model/messenger-background-job.model";
import { startQueueRecovery } from "../../shared/queue-recovery";
import { withAiUsage } from "../../shared/service/ai-subscription.service";
import type { ChatOrderFlowInput } from "./chat-ordering/core/types";

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

async function processJob(kind: MessengerBackgroundJobKind, payload: unknown) {
  if (kind === "zalo-webhook") {
    const { zaloMessengerService } = await import("./zalo-messenger.service");
    await zaloMessengerService.handleWebhookEvent(payload, { resumeDispatch: true });
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
      await MessengerBackgroundJobModel.updateOne(lease, {
        $set: failed ? { status: "failed", completedAt: new Date() } : { status: "pending", dueAt },
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
    startQueueRecovery(() => runJobs("lead-intake"), 3_000),
  ];
  return () => timers.forEach(clearInterval);
}

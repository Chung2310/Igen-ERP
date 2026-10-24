import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../../config/database";
import { stopMarketingQueueWorkers } from "./shared/queue-runtime";
import { stopMarketingEventRelay } from "./shared/event-relay";

async function main() {
  if (process.env.MARKETING_WORKERS_ENABLED !== "true") throw new Error("Set MARKETING_WORKERS_ENABLED=true to start the ERP marketing workers.");
  if (!process.env.MARKETING_QUEUE_PREFIX) throw new Error("MARKETING_QUEUE_PREFIX is required and must be unique per application/environment.");
  process.env.MARKETING_WORKER_PROCESS = "true";
  const role = process.env.MARKETING_WORKER_ROLE || "all";
  if (!["all", "campaign", "inbox", "media"].includes(role)) throw new Error("Invalid MARKETING_WORKER_ROLE.");
  await connectDB();
  if (role === "all" || role === "campaign") {
    const campaign = await import("./campaign/queue/campaign-workers");
    const scheduler = await import("./campaign/service/campaign-scheduler.service");
    const sheet = await import("./campaign/queue/campaign-content-sheet-queue");
    const orders = await import("./campaign/queue/campaign-asset-order-ai-queue");
    campaign.initCampaignWorkers(); scheduler.initCampaignScheduler();
    sheet.initCampaignContentSheetAIWorker(); orders.initCampaignAssetOrderAIWorker();
  }
  if (role === "all" || role === "inbox") {
    const inbox = await import("./message/service/ai-auto-reply.service");
    const deposits = await import("./message/service/cake-deposit-worker");
    await inbox.startFacebookAutoReplyQueueWorker(); deposits.startCakeDepositWorker();
    inbox.startAutoFollowUpWorker();
    if (process.env.MARKETING_TELEGRAM_POLLING_ENABLED === "true") {
      const { telegramService } = await import("./shared/service/telegram.service");
      await telegramService.startPolling();
    }
  }
  if (role === "all" || role === "media") {
    const bulk = await import("./shared/queue/bulk-create-queue");
    const caption = await import("./shared/queue/video-caption-queue");
    bulk.initBulkCreateWorker(); caption.initVideoCaptionWorker();
  }
}
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true;
  const timeout = setTimeout(() => process.exit(1), 25_000); timeout.unref();
  await stopMarketingQueueWorkers(); await stopMarketingEventRelay(); await mongoose.disconnect();
  process.exit(0);
}
process.once("SIGTERM", () => { void stop(); });
process.once("SIGINT", () => { void stop(); });
void main().catch((error: unknown) => { console.error("[ERP Marketing worker]", error instanceof Error ? error.message : "Startup failed"); process.exit(1); });

import type { Types } from "mongoose";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { canProcessMessengerWebhook } from "../webhook-access";
import { fbMessengerService } from "./fb-messenger.service";

const INTERVAL_MS = 30_000;
const PAGE_BATCH_SIZE = 25;
let cursor: Types.ObjectId | undefined;
let running = false;
let timer: ReturnType<typeof setInterval> | undefined;

/** Reconcile missed webhook messages through the existing durable reply queue. */
export async function reconcileFacebookInboxes() {
  if (running) return;
  running = true;
  try {
    const pages = await SocialIntegrationModel.find({
      platform: "Facebook", isConnected: true, "aiAutoReplyConfig.enabled": true,
      ...(cursor ? { _id: { $gt: cursor } } : {}),
    }).select("_id username companyCode createdBy").sort({ _id: 1 }).limit(PAGE_BATCH_SIZE).lean();
    cursor = pages.length === PAGE_BATCH_SIZE ? pages.at(-1)?._id : undefined;
    let next = 0;
    const consume = async () => {
      while (next < pages.length) {
        const page = pages[next++];
        if (!page.companyCode || !/^\d+$/.test(page.username || "")) continue;
        try {
          if (!await canProcessMessengerWebhook("Facebook", page.username)) continue;
          await fbMessengerService.syncConversationsFromFacebook(page.username!, {
            companyCode: page.companyCode, source: "company",
            userId: page.createdBy ? String(page.createdBy) : undefined,
          }, { reconcileMessages: true });
        } catch (error) {
          console.error(`[Facebook inbox sync] Page ${page.username} failed:`, error instanceof Error ? error.message : "Sync failed");
        }
      }
    };
    await Promise.allSettled([consume(), consume()]);
  } catch (error) {
    console.error("[Facebook inbox sync] Could not scan connected Pages:", error);
  } finally {
    running = false;
  }
}

export function startFacebookInboxSyncWorker() {
  if (process.env.MARKETING_WORKER_PROCESS !== "true" || timer) return;
  void reconcileFacebookInboxes();
  timer = setInterval(() => { void reconcileFacebookInboxes(); }, INTERVAL_MS);
  timer.unref();
}

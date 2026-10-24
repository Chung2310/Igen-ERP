/* eslint-disable @typescript-eslint/no-explicit-any */
import { Queue } from "bullmq";
import net from "net";
import { randomUUID } from "crypto";
import { MarketingCampaignSlotModel } from "../model/marketing-campaign-slot.model.ts";
import { MarketingCampaignModel } from "../model/marketing-campaign.model.ts";
import { CampaignOrchestratorService } from "../service/agents/campaign-orchestrator.service.ts";

const redisConfig = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

const QUEUE_NAME = "campaign-task-queue";
const DIRECT_FALLBACK_CONCURRENCY = 2;
const REDIS_RECHECK_MS = 30_000;

type CampaignQueueJobType = "prepare" | "media" | "verify" | "publish";

export function buildCampaignQueueJobId(type: CampaignQueueJobType, slotId: string) {
  // BullMQ reserves ':' in custom job IDs because it uses that separator in Redis keys.
  return `campaign-${type}-${slotId}`;
}

let campaignQueue: Queue | null = null;
let isRedisAvailable: boolean | null = null;
let redisCheckedAt = 0;
const directFallbackPending: Array<{
  slotId: string;
  type: "prepare" | "media" | "verify" | "publish";
}> = [];
let directFallbackActive = 0;
const directFallbackKeys = new Set<string>();

function checkRedisConnection(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1500);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
    socket.once("error", () => { socket.destroy(); resolve(false); });
    socket.connect(port, host);
  });
}

async function ensureRedisConnection(): Promise<boolean> {
  if (
    isRedisAvailable !== null &&
    (isRedisAvailable || Date.now() - redisCheckedAt < REDIS_RECHECK_MS)
  ) {
    return isRedisAvailable;
  }
  const { host, port } = redisConfig;
  const connected = await checkRedisConnection(host, port);
  redisCheckedAt = Date.now();
  if (connected) {
    console.log(`[Campaign Queue] Connected to Redis successfully.`);
    isRedisAvailable = true;
    try {
      campaignQueue = new Queue(QUEUE_NAME, { prefix: process.env.MARKETING_QUEUE_PREFIX || "igen-erp-marketing", connection: redisConfig });
      campaignQueue.on("error", (error) => {
        isRedisAvailable = false;
        redisCheckedAt = Date.now();
        campaignQueue = null;
        console.error("[Campaign Queue] Redis queue error:", error.message);
      });
    } catch (e: any) {
      console.error("[Campaign Queue] Error creating Queue:", e.message);
      isRedisAvailable = false;
    }
  } else {
    console.warn(`[Campaign Queue] Redis not found at ${host}:${port}. Falling back to direct database worker execution.`);
    isRedisAvailable = false;
  }
  return isRedisAvailable;
}

/**
 * Fallback direct execution in the background when Redis is offline.
 * Utilizes atomic locking and transitions to respect processing boundaries.
 */
async function runDirectFallback(slotId: string, type: 'prepare' | 'media' | 'verify' | 'publish') {
  const lockId = randomUUID();
  const now = new Date();
  const leaseExpires = new Date(now.getTime() + 20 * 60000); // 20 mins lease

  let nextStatus: string;
  let fromStatuses: string[];
  let orchestratorFn: (slotId: string, lockId: string) => Promise<any>;

  if (type === "prepare") {
    nextStatus = "generating";
    fromStatuses = ["queued", "planned", "retrying", "generating", "researching", "writing", "scoring"];
    orchestratorFn = CampaignOrchestratorService.orchestratePrepare;
  } else if (type === "media") {
    nextStatus = "generating_media";
    fromStatuses = ["generating_media"];
    orchestratorFn = CampaignOrchestratorService.orchestrateMedia;
  } else if (type === "verify") {
    nextStatus = "verifying";
    fromStatuses = ["verifying"];
    orchestratorFn = CampaignOrchestratorService.orchestrateVerify;
  } else {
    nextStatus = "publishing";
    fromStatuses = ["ready_to_publish", "publishing"];
    orchestratorFn = CampaignOrchestratorService.orchestratePublish;
  }

  try {
    {
      const slotScope = await MarketingCampaignSlotModel.findById(slotId)
        .select("campaignId companyCode")
        .lean();
      const campaignIsActive = slotScope && await MarketingCampaignModel.exists({
        _id: slotScope.campaignId,
        companyCode: slotScope.companyCode,
        status: "active",
      });
      if (!campaignIsActive) return;
    }

    const claimed = await MarketingCampaignSlotModel.findOneAndUpdate(
      {
        _id: slotId,
        status: { $in: fromStatuses },
        $or: [
          { lockExpiresAt: { $exists: false } },
          { lockExpiresAt: null },
          { lockExpiresAt: { $lte: now } }
        ]
      } as any,
      {
        $set: {
          status: nextStatus,
          lockId,
          lockedAt: now,
          lockExpiresAt: leaseExpires
        },
        $push: {
          transitions: {
            from: fromStatuses[0],
            to: nextStatus,
            reason: `Queue fallback direct execution for ${type}`,
            at: now
          }
        }
      } as any,
      { new: true }
    );

    if (!claimed) {
      console.warn(`[Campaign Queue Direct Fallback] Slot ${slotId} for ${type} was already claimed or in invalid status.`);
      return;
    }

    console.log(`[Campaign Queue Direct Fallback] Starting direct ${type} task for slot ${slotId}`);
    await orchestratorFn.call(CampaignOrchestratorService, slotId, lockId);

    const campaignIsActive = await MarketingCampaignModel.exists({ _id: claimed.campaignId, companyCode: claimed.companyCode, status: "active" });
    if (campaignIsActive && (type === "prepare" || type === "media")) {
      const updatedSlot = await MarketingCampaignSlotModel.findById(slotId)
        .select("status")
        .lean();
      if (updatedSlot?.status === "generating_media") {
        await campaignQueueService.addMediaJob(slotId);
      } else if (updatedSlot?.status === "verifying") {
        await campaignQueueService.addVerifyJob(slotId);
      }
    }
  } catch (error) {
    console.error(`[Campaign Queue Direct Fallback Error] Failed to execute direct ${type} on slot ${slotId}:`, error);
  }
}

function drainDirectFallbackQueue() {
  while (
    directFallbackActive < DIRECT_FALLBACK_CONCURRENCY
    && directFallbackPending.length > 0
  ) {
    const task = directFallbackPending.shift();
    if (!task) return;
    directFallbackActive += 1;
    void runDirectFallback(task.slotId, task.type).finally(() => {
      directFallbackKeys.delete(buildCampaignQueueJobId(task.type, task.slotId));
      directFallbackActive -= 1;
      drainDirectFallbackQueue();
    });
  }
}

function scheduleDirectFallback(
  slotId: string,
  type: "prepare" | "media" | "verify" | "publish"
) {
  const key = buildCampaignQueueJobId(type, slotId);
  if (directFallbackKeys.has(key)) return;
  directFallbackKeys.add(key);
  directFallbackPending.push({ slotId, type });
  drainDirectFallbackQueue();
}

async function enqueueCampaignJob(type: CampaignQueueJobType, slotId: string) {
  const hasRedis = await ensureRedisConnection();
  if (!hasRedis || !campaignQueue) {
    scheduleDirectFallback(slotId, type);
    return { id: `direct-${type}` };
  }
  const jobId = buildCampaignQueueJobId(type, slotId);
  const existing = await campaignQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state === "failed") {
      try { await existing.retry("failed"); }
      catch (error) { if (await existing.getState() === "failed") throw error; }
    }
    if (state !== "completed") return existing;
    await existing.remove();
  }
  return campaignQueue.add(type, { slotId }, { jobId, removeOnComplete: true, removeOnFail: false });
}

export const campaignQueueService = {
  async checkRedis(): Promise<boolean> {
    return ensureRedisConnection();
  },

  async addPrepareJob(slotId: string) {
    return enqueueCampaignJob("prepare", slotId);
  },

  async addMediaJob(slotId: string) {
    return enqueueCampaignJob("media", slotId);
  },

  async addVerifyJob(slotId: string) {
    return enqueueCampaignJob("verify", slotId);
  },

  async addPublishJob(slotId: string) {
    return enqueueCampaignJob("publish", slotId);
  }
};

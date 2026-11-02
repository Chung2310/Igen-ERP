/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Model } from "mongoose";
import { withAiUsage } from "../../shared/service/ai-subscription.service";

export async function runLeasedCampaignAIJob<T>(model: Model<any>, job: any, lockId: string, task: () => Promise<T>) {
  const scope = { _id: job._id, companyCode: job.companyCode, lockId, status: "processing" };
  const heartbeat = setInterval(() => {
    void model.updateOne(scope, { $set: { lockExpiresAt: new Date(Date.now() + 20 * 60_000) } })
      .catch(error => console.error("[Campaign AI lease]", error));
  }, 30_000);
  heartbeat.unref();
  try {
    return await withAiUsage({ companyCode: job.companyCode, userId: String(job.createdBy), campaignId: String(job.campaignId) }, task);
  } catch (error) {
    const terminal = [400, 401, 402, 403, 404].includes(Number((error as { statusCode?: number })?.statusCode));
    await model.updateOne(scope, [{ $set: {
      status: { $cond: [{ $ifNull: ["$cancelRequestedAt", false] }, "cancelled", terminal ? "failed" : "queued"] },
      errorMessage: { $literal: error instanceof Error ? error.message.slice(0, 1000) : "AI job bị gián đoạn." },
      completedAt: { $cond: [{ $ifNull: ["$cancelRequestedAt", terminal] }, "$$NOW", "$$REMOVE"] },
      lockId: "$$REMOVE", lockedAt: "$$REMOVE", lockExpiresAt: "$$REMOVE",
    } }], { updatePipeline: true }).catch(recoveryError => console.error("[Campaign AI release]", recoveryError));
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}

export async function completeCampaignAIJob(model: Model<any>, job: any, lockId: string, status: string) {
  return model.findOneAndUpdate(
    { _id: job._id, companyCode: job.companyCode, lockId, status: "processing" },
    [{ $set: {
      status: { $cond: [{ $ifNull: ["$cancelRequestedAt", false] }, "cancelled", status] },
      progress: { $cond: [{ $ifNull: ["$cancelRequestedAt", false] }, "$progress", 100] },
      completedAt: "$$NOW", lockId: "$$REMOVE", lockedAt: "$$REMOVE", lockExpiresAt: "$$REMOVE",
    } }],
    { returnDocument: "after", updatePipeline: true },
  ).lean();
}

export async function recoverCampaignAIJobs(model: Model<any>) {
  const now = new Date();
  await model.updateMany(
    { status: "processing", $or: [{ lockExpiresAt: null }, { lockExpiresAt: { $lte: now } }] },
    [{ $set: {
      status: { $cond: [{ $ifNull: ["$cancelRequestedAt", false] }, "cancelled", { $cond: [{ $gte: ["$attemptCount", 3] }, "failed", "queued"] }] },
      errorMessage: { $cond: [{ $gte: ["$attemptCount", 3] }, "AI job đã hết số lần thử tự động.", "$errorMessage"] },
      completedAt: { $cond: [{ $ifNull: ["$cancelRequestedAt", false] }, "$$NOW", { $cond: [{ $gte: ["$attemptCount", 3] }, "$$NOW", "$$REMOVE"] }] },
      lockId: "$$REMOVE", lockedAt: "$$REMOVE", lockExpiresAt: "$$REMOVE",
    } }],
    { updatePipeline: true },
  );
  await model.updateMany(
    { status: "queued", attemptCount: { $gte: 3 } },
    { $set: { status: "failed", completedAt: now, errorMessage: "AI job đã hết số lần thử tự động." } },
  );
  const jobs = await model.find({ status: "queued" }).sort({ createdAt: 1 }).limit(500).select("_id").lean();
  return jobs.map(job => String(job._id));
}

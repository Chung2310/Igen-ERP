import { createHash } from "node:crypto";
import { geminiService } from "../../shared/service/gemini.service";
import { walletService, API_COSTS } from "../../shared/service/wallet.service";
import { MarketingCandidateModel } from "../model/marketing-candidate.model";
import { MarketingCampaignModel } from "../model/marketing-campaign.model";
import { MarketingCampaignSlotModel } from "../model/marketing-campaign-slot.model";
import { MarketingContentModel } from "../model/marketing-content.model";
import type { IMarketingCampaign } from "../interface/marketing-campaign.interface";
import type { IMarketingCampaignSlot } from "../interface/marketing-campaign-slot.interface";
import { candidateCount, normalizeScores, validateCandidate } from "./candidate-policy";
import { ensureKnowledgeContactFooter } from "./agents/campaign-contact-footer";

const ANGLES = ["insight", "story", "education", "social-proof", "objection-handling"];
async function bounded<T, R>(items: T[], fn: (item: T, index: number) => Promise<R>) {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(2, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = { status: "fulfilled", value: await fn(items[index], index) }; }
      catch (reason) { results[index] = { status: "rejected", reason }; }
    }
  }));
  return results;
}
export class CandidateSelectionService {
  static async write(slot: IMarketingCampaignSlot, campaign: IMarketingCampaign, context: string) {
    const inputHash = createHash("sha256").update(JSON.stringify({ brief: campaign.sourceBrief, rules: campaign.rules, topic: slot.topicBrief, objective: slot.objective, mediaType: slot.mediaType, platform: slot.platform, context })).digest("hex");
    const scope = { companyCode: slot.companyCode, slotId: slot._id, inputHash };
    const existing = await MarketingCandidateModel.findOne({ ...scope, selected: true });
    if (existing && existing.score >= campaign.minimumScore && !existing.rejectionReasons.length) return existing;
    const recent = await MarketingContentModel.find({ companyCode: slot.companyCode, campaignId: String(campaign._id), campaignSlotId: { $ne: slot._id } }).sort({ generatedAt: -1 }).limit(50).select("title bodyText").lean();
    const price = campaign.qualityMode === "budget" ? API_COSTS.CAMPAIGN_CONTENT_BUDGET : API_COSTS.CAMPAIGN_CONTENT_PREMIUM;
    let providerErrors = 0;
    async function billed<T>(variant: string, operation: string, task: (completed: () => void) => Promise<T>): Promise<T> {
      const key = `erp-candidate:${slot.companyCode}:${slot._id}:${inputHash}:${variant}:${operation}`;
      const reservation = await walletService.reserveBalance(campaign.createdBy, price, `Campaign ${operation} ${slot._id} ${variant}`, key);
      if (!reservation.reserved) throw new Error("Tác vụ AI đã có bút toán; cần đối soát kết quả trước khi chạy lại.");
      let completed = false;
      try {
        const result = await task(() => { completed = true; });
        const settlement = await walletService.settleReservation(campaign.createdBy, key);
        if (settlement.settled) await MarketingCampaignModel.updateOne({ _id: campaign._id, companyCode: slot.companyCode }, { $inc: { "statistics.actualCost": price } });
        return result;
      } catch (error) {
        if (completed) {
          const settlement = await walletService.settleReservation(campaign.createdBy, key);
          if (settlement.settled) await MarketingCampaignModel.updateOne({ _id: campaign._id, companyCode: slot.companyCode }, { $inc: { "statistics.actualCost": price } });
        }
        else await walletService.releaseReservation(campaign.createdBy, key);
        throw error;
      }
    }
    for (let round = 0; round < 2; round++) {
      const variants = ANGLES.slice(0, candidateCount(campaign.candidateCount)).map((angle) => `${angle}-${inputHash.slice(0, 10)}-r${round}`);
      const generated = await bounded(variants, async (variant, index) => {
        const cached = await MarketingCandidateModel.findOne({ ...scope, variant });
        if (cached) return cached;
        return billed(variant, "generate", async (completed) => {
          const draft = await geminiService.generateCampaignCandidate({
            sourceBrief: `${campaign.sourceBrief}\n\nNGỮ CẢNH ĐÃ XÁC MINH:\n${context}`,
            campaignTitle: campaign.title, pillar: slot.pillar, objective: slot.objective,
            topicBrief: slot.topicBrief, platform: slot.platform, mediaType: slot.mediaType,
            variant: ANGLES[index], ...campaign.rules, recentTitles: recent.map((item) => item.title),
          });
          completed();
          draft.bodyText = ensureKnowledgeContactFooter(draft.bodyText, context);
          return MarketingCandidateModel.create({
            ...scope, campaignId: campaign._id, variant, ...draft, inputHash,
            contentHash: createHash("sha256").update(draft.bodyText.toLocaleLowerCase("vi").trim()).digest("hex"),
            score: 0, selected: false, evaluationStatus: "generated",
            usage: { estimatedCost: price },
          });
        });
      });
      const candidates = generated.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      const quotaFailure = generated.find((result) => result.status === "rejected" && result.reason?.code === "AI_SUBSCRIPTION_LIMIT");
      if (quotaFailure?.status === "rejected") throw quotaFailure.reason;
      providerErrors += generated.filter((result) => result.status === "rejected").length;
      const valid: typeof candidates = [];
      const acceptedBodies = recent.map((item) => item.bodyText);
      for (const candidate of candidates) {
        const reasons = validateCandidate(candidate, slot.platform, campaign.rules || {}, acceptedBodies);
        if (reasons.length) {
          candidate.rejectionReasons = reasons; candidate.evaluationStatus = "invalid"; candidate.selected = false;
          await candidate.save(); continue;
        }
        acceptedBodies.push(candidate.bodyText);
        valid.push(candidate);
      }
      await MarketingCampaignSlotModel.updateOne({ _id: slot._id, lockId: slot.lockId }, { $set: { status: "scoring" }, $push: { transitions: { from: "writing", to: "scoring", reason: `Chấm ${valid.length} phương án hợp lệ.`, at: new Date() } } });
      const scored = await bounded(valid, async (candidate) => {
        if (candidate.evaluationStatus === "scored") return candidate;
        return billed(candidate.variant, "score", async (completed) => {
          const scores = await geminiService.scoreCampaignCandidate({ sourceBrief: campaign.sourceBrief, objective: slot.objective, platform: slot.platform, title: candidate.title, bodyText: candidate.bodyText, recentTitles: recent.map((item) => item.title) });
          completed();
          candidate.scoreDetails = normalizeScores(scores);
          candidate.score = Object.values(candidate.scoreDetails).reduce((sum, value) => sum + value, 0);
          candidate.evaluationStatus = "scored";
          candidate.rejectionReasons = candidate.score >= campaign.minimumScore ? [] : ["Nội dung chưa đạt điểm tối thiểu."];
          candidate.usage.estimatedCost += price;
          await candidate.save();
          return candidate;
        });
      });
      providerErrors += scored.filter((result) => result.status === "rejected").length;
      const ranked = scored.flatMap((result) => result.status === "fulfilled" ? [result.value] : []).sort((a, b) => b.score - a.score);
      const scoreQuotaFailure = scored.find((result) => result.status === "rejected" && result.reason?.code === "AI_SUBSCRIPTION_LIMIT");
      if (scoreQuotaFailure?.status === "rejected") throw scoreQuotaFailure.reason;
      const winner = ranked.find((candidate) => candidate.score >= campaign.minimumScore && !candidate.rejectionReasons.length);
      if (winner) {
        await MarketingCandidateModel.updateMany({ companyCode: slot.companyCode, slotId: slot._id }, { $set: { selected: false } });
        winner.selected = true; await winner.save();
        return winner;
      }
      if (round > 0 || !ranked.some((candidate) => candidate.score >= 65)) break;
    }
    await MarketingCampaignSlotModel.updateOne({ _id: slot._id, lockId: slot.lockId }, {
      $set: { status: "needs_attention", lastError: { type: providerErrors ? "provider" : "validation", message: "Không có phương án hợp lệ đạt điểm tối thiểu.", occurredAt: new Date() } },
      $unset: { lockId: "", lockedAt: "", lockExpiresAt: "" },
      $push: { transitions: { from: "scoring", to: "needs_attention", reason: "Candidate selection exhausted.", at: new Date() } },
    });
    throw new Error("Không có phương án hợp lệ đạt điểm tối thiểu.");
  }
}

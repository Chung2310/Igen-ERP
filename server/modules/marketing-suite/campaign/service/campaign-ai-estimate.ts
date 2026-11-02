import { buildCampaignSchedule } from "./marketing-campaign-schedule.service";

export type CampaignAiEstimateInput = Omit<Parameters<typeof buildCampaignSchedule>[0], "generationLeadMinutes" | "verificationLeadMinutes" | "timezone"> & {
  timezone?: string; generationLeadMinutes?: number; verificationLeadMinutes?: number;
  candidateCount?: number; imageMode?: string; mediaPolicy?: string; captionMode?: string;
};
/** No provider calls: compute the plan before any AI usage is reserved. */
export function estimateCampaignAi(input: CampaignAiEstimateInput) {
  const slots = buildCampaignSchedule({ ...input, timezone: input.timezone || "Asia/Ho_Chi_Minh",
    generationLeadMinutes: input.generationLeadMinutes ?? 60, verificationLeadMinutes: input.verificationLeadMinutes ?? 15 });
  const candidates = Math.min(5, Math.max(2, input.candidateCount ?? 3));
  const planningCalls = 3; // Research, strategy, content matrix.
  const researchCalls = slots.length;
  const verificationCalls = slots.length;
  const candidateCalls = slots.length * candidates * 2; // Generate and score each candidate.
  const imageCalls = input.imageMode === "ai" && input.mediaPolicy !== "video"
    ? slots.filter((slot) => slot.platform === "Facebook").length : 0;
  const captionCalls = input.captionMode && input.captionMode !== "none"
    ? slots.length * (input.captionMode === "combined" ? 2 : 1) : 0;
  const estimatedCalls = planningCalls + researchCalls + verificationCalls + candidateCalls + imageCalls + captionCalls;
  return { totalSlots: slots.length, planningCalls, researchCalls, verificationCalls, candidateCalls, imageCalls, captionCalls,
    estimatedCalls, maximumCalls: estimatedCalls + candidateCalls };
}

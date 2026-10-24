import { UserModel } from "../../../../model/user.model";
import { aiSubscriptionService, getAiUsageContext, quotaError } from "./ai-subscription.service";

/** Existing task estimates now use calls, with one unit per provider request. */
export const API_COSTS = {
  GEMINI_CHAT: 1, GEMINI_MARKETING: 1, GEMINI_IMAGE: 1, GEMINI_VIDEO: 1,
  GEMINI_OPTIMIZE: 1, AI_HTML_CHAT: 1, GEMINI_FAQ: 1,
  ELEVENLABS_TTS_CHAR: 0, ELEVENLABS_MIN: 1,
  CAMPAIGN_RESEARCH: 1, CAMPAIGN_VISION: 1, CAMPAIGN_STRATEGY: 1,
  CAMPAIGN_CONTENT_PREMIUM: 1, CAMPAIGN_CONTENT_BUDGET: 1,
  CAMPAIGN_IMAGE_PREMIUM: 1, CAMPAIGN_IMAGE_BUDGET: 1,
};

export const walletService = {
  async checkBalance(userId: string, amount: number) {
    if (amount <= 0) return;
    const context = getAiUsageContext();
    const companyCode = context?.companyCode || (await UserModel.findById(userId).select("companyCode").lean())?.companyCode;
    if (!companyCode) throw quotaError("Không xác định được doanh nghiệp sử dụng AI.", 403);
    await aiSubscriptionService.available(companyCode.trim().toUpperCase(), Math.ceil(amount));
  },
  // The provider boundary owns reservation and settlement; existing task callers
  // must not debit again after their AI call has already been counted.
  async deductBalance(...legacy: [string, number, string, string?]) { void legacy; return { charged: false }; },
  async reserveBalance(userId: string, ...legacy: [number, string, string]) {
    void legacy;
    await this.checkBalance(userId, 1);
    return { reserved: true };
  },
  async settleReservation(...legacy: [string, string]) { void legacy; return { settled: false }; },
  async releaseReservation(...legacy: [string, string]) { void legacy; return { released: false }; },
};

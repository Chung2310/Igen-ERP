import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { IMarketingCampaignSlot } from "../../../campaign/interface/marketing-campaign-slot.interface";
import type { IMarketingCampaign } from "../../../campaign/interface/marketing-campaign.interface";
import { MediaCreatorAgentService } from "./media-creator-agent.service";

const mocks = vi.hoisted(() => ({ find: vi.fn(), image: vi.fn(), balance: vi.fn() }));
vi.mock("../../../campaign/model/marketing-content.model.ts", () => ({ MarketingContentModel: { findOne: mocks.find } }));
vi.mock("../../../campaign/model/marketing-campaign.model.ts", () => ({ MarketingCampaignModel: {} }));
vi.mock("../gemini.service.ts", () => ({ geminiService: { generateImage: mocks.image } }));
vi.mock("../wallet.service.ts", () => ({ API_COSTS: {}, walletService: { checkBalance: mocks.balance } }));
vi.mock("../../../campaign/service/agents/campaign-caption.service.ts", () => ({ applyCampaignVideoCaption: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console, "warn").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

it.each([false, true])("only permits an image-to-text downgrade when explicitly configured: %s", async allowed => {
  const content = { mediaPrompt: "Product", save: vi.fn() };
  mocks.find.mockResolvedValue(content);
  mocks.image.mockRejectedValue(new Error("provider unavailable"));
  const slot = { platform: "Facebook", mediaType: "image", save: vi.fn() } as unknown as IMarketingCampaignSlot;
  const campaign = { rules: { allowTextOnlyFallback: allowed } } as unknown as IMarketingCampaign;
  if (allowed) {
    await expect(MediaCreatorAgentService.createMedia(slot, campaign)).resolves.toBe("");
    expect(slot.mediaType).toBe("text");
  } else {
    await expect(MediaCreatorAgentService.createMedia(slot, campaign)).rejects.toThrow("không cho phép");
    expect(slot.mediaType).toBe("image");
    expect(slot.save).not.toHaveBeenCalled();
  }
});
it("never hides exhausted AI quota behind text fallback", async () => {
  mocks.find.mockResolvedValue({ mediaPrompt: "Product" });
  mocks.balance.mockRejectedValue(Object.assign(new Error("quota"), { code: "AI_SUBSCRIPTION_LIMIT" }));
  await expect(MediaCreatorAgentService.createMedia({ mediaType: "image" } as IMarketingCampaignSlot, { rules: { allowTextOnlyFallback: true } } as IMarketingCampaign)).rejects.toMatchObject({ code: "AI_SUBSCRIPTION_LIMIT" });
  expect(mocks.image).not.toHaveBeenCalled();
});

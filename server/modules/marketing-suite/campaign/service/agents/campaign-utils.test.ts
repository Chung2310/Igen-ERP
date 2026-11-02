import { beforeEach, expect, it, vi } from "vitest";
import { resolveFacebookCredentials } from "./campaign-utils";

const mocks = vi.hoisted(() => ({ integration: vi.fn(), user: vi.fn() }));
vi.mock("../../../shared/model/social-integration.model.ts", () => ({ SocialIntegrationModel: { findOne: mocks.integration } }));
vi.mock("../../../../../model/user.model.ts", () => ({ UserModel: { findById: mocks.user } }));
vi.mock("../../model/marketing-campaign.model.ts", () => ({ MarketingCampaignModel: {} }));
vi.mock("../../model/marketing-campaign-slot.model.ts", () => ({ MarketingCampaignSlotModel: {} }));
beforeEach(() => vi.resetAllMocks());

it("never replaces an explicitly selected Page when its token is missing", async () => {
  mocks.integration.mockReturnValue({ lean: async () => ({ username: "chosen-page" }) });
  await expect(resolveFacebookCredentials({ companyCode: "A", createdBy: "owner", integrationId: "chosen" })).rejects.toThrow("Fanpage đã chọn");
  expect(mocks.user).not.toHaveBeenCalled();
  expect(mocks.integration).toHaveBeenCalledExactlyOnceWith({ _id: "chosen", companyCode: "A", platform: "Facebook", isConnected: true });
});
it("does not select an arbitrary company Page when the author has no connection", async () => {
  mocks.user.mockReturnValue({ select: () => ({ lean: async () => ({ companyCode: "A" }) }) });
  await expect(resolveFacebookCredentials({ companyCode: "A", createdBy: "owner" })).rejects.toThrow("chọn đúng Fanpage");
  expect(mocks.integration).not.toHaveBeenCalled();
});
it("rejects an immediate-publish Page that differs from the canonical slot Page", async () => {
  mocks.integration.mockReturnValue({ lean: async () => ({ username: "canonical", accessToken: "test-token" }) });
  await expect(resolveFacebookCredentials({ companyCode: "A", createdBy: "owner", integrationId: "chosen", expectedPageId: "other-page" })).rejects.toMatchObject({ statusCode: 409 });
});
it("retains the creator's personal Page only inside the same company", async () => {
  mocks.user.mockReturnValue({ select: () => ({ lean: async () => ({ companyCode: "A", facebookIntegration: { isConnected: true, pageId: "personal", pageAccessToken: "test-token" } }) }) });
  await expect(resolveFacebookCredentials({ companyCode: "A", createdBy: "owner" })).resolves.toMatchObject({ pageId: "personal" });
  await expect(resolveFacebookCredentials({ companyCode: "B", createdBy: "owner" })).rejects.toThrow();
});

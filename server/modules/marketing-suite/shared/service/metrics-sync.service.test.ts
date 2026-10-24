import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MetricsSyncService } from "./metrics-sync.service";
const mocks = vi.hoisted(() => ({ slots: vi.fn(), save: vi.fn(), enabled: vi.fn(), integration: vi.fn() }));
vi.mock("../../campaign/model/marketing-campaign-slot.model.ts", () => ({ MarketingCampaignSlotModel: { find: mocks.slots } }));
vi.mock("../../campaign/model/marketing-campaign.model.ts", () => ({ MarketingCampaignModel: {} }));
vi.mock("../model/social-integration.model.ts", () => ({ SocialIntegrationModel: { findOne: mocks.integration } }));
vi.mock("../../../../model/user.model.ts", () => ({ UserModel: {} }));
vi.mock("../../campaign/model/social-post-metric.model.ts", () => ({ SocialPostMetricModel: { find: () => ({ select: () => ({ lean: async () => [] }) }), findOneAndUpdate: mocks.save } }));
vi.mock("../access", () => ({ companyModuleEnabled: mocks.enabled }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled.mockImplementation(async company => company === "A");
  mocks.integration.mockReturnValue({ lean: async () => ({ username: "page", accessToken: "test-token" }) });
  mocks.save.mockResolvedValue({});
  async function* slots() {
    yield { _id: "disabled", companyCode: "D", integrationId: "integration", publishedPostId: "post" };
    yield { _id: "slot", companyCode: "A", integrationId: "integration", publishedPostId: "post" };
  }
  mocks.slots.mockReturnValue({ sort: () => ({ lean: () => ({ cursor: slots }) }) });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("skips disabled tenants without starving enabled ones and preserves unavailable Insights", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ likes: { summary: { total_count: 5 } } })))
    .mockResolvedValueOnce(new Response("permission denied", { status: 403 }));
  vi.stubGlobal("fetch", fetcher);
  expect(await MetricsSyncService.syncFacebookMetrics(1)).toMatchObject({ processed: 1, success: 1, failed: 0 });
  expect(mocks.integration).toHaveBeenCalledWith(expect.objectContaining({ companyCode: "A" }));
  const [scope, update] = mocks.save.mock.calls[0];
  expect(scope).toEqual({ slotId: "slot", companyCode: "A" });
  expect(update.$set).toMatchObject({ likes: 5 });
  expect(update.$set).not.toHaveProperty("reach");
  expect(update.$unset).toEqual({ syncError: 1 });
  expect(fetcher.mock.calls.every(call => call[1].signal instanceof AbortSignal)).toBe(true);
});
it("records provider failures under the same tenant without resetting previous counts", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
  expect(await MetricsSyncService.syncFacebookMetrics(1)).toMatchObject({ processed: 1, success: 0, failed: 1 });
  expect(mocks.save.mock.calls[0][0]).toEqual({ slotId: "slot", companyCode: "A" });
  expect(mocks.save.mock.calls[0][1].$set).not.toHaveProperty("likes");
});
it("does not send local mock posts to the real Graph API", async () => {
  mocks.integration.mockReturnValue({ lean: async () => ({ isMock: true, username: "mock-page", accessToken: "mock-token" }) });
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  expect(await MetricsSyncService.syncFacebookMetrics()).toMatchObject({ processed: 0, success: 0, failed: 0 });
  expect(fetcher).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});

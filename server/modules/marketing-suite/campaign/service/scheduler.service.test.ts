import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { schedulerService } from "./scheduler.service";

vi.mock("../../shared/runtime-settings", () => ({ getMarketingAppUrl: () => "https://erp.invalid" }));
vi.mock("../../shared/service/facebook-post.service.ts", () => ({ facebookPostService: {} }));
vi.mock("../model/marketing-content.model.ts", () => ({ MarketingContentModel: {} }));
vi.mock("../../../../model/user.model.ts", () => ({ UserModel: {} }));
vi.mock("../../shared/model/social-integration.model.ts", () => ({ SocialIntegrationModel: {} }));
vi.mock("../../shared/access", () => ({ companyModuleEnabled: vi.fn() }));
beforeEach(() => { vi.stubEnv("N8N_FB_WEBHOOK_URL", "https://workflow.invalid"); vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const payload = { channel: "Facebook", cardId: "card", integration: { pageId: "page", pageAccessToken: "test" }, imageUrl: "https://cdn.invalid/1.jpg", mediaUrls: ["https://cdn.invalid/1.jpg", "https://cdn.invalid/2.jpg"] };

it.each([{ status: "failed" }, { data: { status: "error" } }, { success: false }, { error: "rejected" }, [{ data: { data: { status: "failed" } } }]])("rejects a provider failure inside HTTP 200: %j", async data => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } })));
  await expect(schedulerService.sendScheduleToN8n(payload)).rejects.toThrow("từ chối");
});
it("does not treat malformed JSON as an accepted schedule", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{invalid", { headers: { "content-type": "application/json" } })));
  await expect(schedulerService.sendScheduleToN8n(payload)).rejects.toThrow("JSON không hợp lệ");
});
it("keeps every image and bounds the external request", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", id: "post" }), { headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);
  await expect(schedulerService.sendScheduleToN8n(payload)).resolves.toMatchObject({ status: "success", data: { id: "post" } });
  const init = fetcher.mock.calls[0][1];
  expect(JSON.parse(init.body)).toMatchObject({ mediaUrls: payload.mediaUrls, mediaUrl: payload.imageUrl, pageId: "page" });
  expect(init.signal).toBeInstanceOf(AbortSignal);
});

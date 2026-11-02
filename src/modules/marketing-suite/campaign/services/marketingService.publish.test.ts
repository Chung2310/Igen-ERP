import { afterEach, expect, it, vi } from "vitest";
import { marketingService } from "./marketingService";

vi.mock("../../shared/services/authService", () => ({ getAccessToken: () => "test-session" }));
afterEach(() => vi.unstubAllGlobals());
it("publishes Facebook content using Page ID without requiring or sending a browser token", async () => {
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: "123_456" }, publication: { status: "published", postId: "123_456" } })));
  vi.stubGlobal("fetch", fetcher);
  expect(await marketingService.publishToFacebook("card", "123", "Nội dung", false)).toBe("123_456");
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe("/api/v1/facebook/publish");
  const body = JSON.parse(String(init?.body));
  expect(body).toMatchObject({ cardId: "card", pageId: "123" });
  expect(body).not.toHaveProperty("accessToken");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

import { beforeEach, expect, test, vi } from "vitest";
import { superAdminUserAccessService } from "./superAdminUserAccessService";

beforeEach(() => { vi.restoreAllMocks(); localStorage.setItem("accessToken", "root-token"); });

test("search scopes requests to the selected tenant and paginates", async () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async () => new Response(JSON.stringify({ data: [], total: 0, page: 2, limit: 10 }), { headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  await superAdminUserAccessService.search("acme", { page: 2, limit: 10, q: "mai" });
  expect(String(fetchMock.mock.calls[0][0])).toContain("tenantId=acme");
  expect(String(fetchMock.mock.calls[0][0])).toContain("page=2");
});

test("dangerous recovery requires a written reason before sending", async () => {
  await expect(superAdminUserAccessService.resetTwoFactor("acme", "u1", "")).rejects.toThrow(/reason/i);
});

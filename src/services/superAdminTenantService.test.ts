import { describe, expect, it, vi } from "vitest";
import { superAdminTenantService } from "./superAdminTenantService";

describe("superAdminTenantService", () => {
  it("lists tenants with the requested filter and returns mutation action ids", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ tenants: [{ code: "ACME" }] }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ actionId: "a1", result: { code: "ACME" } }), { status: 200 }));
    await expect(superAdminTenantService.list("acme")).resolves.toEqual([{ code: "ACME" }]);
    await expect(superAdminTenantService.scheduleDeletion("ACME", { reason: "contract ended", password: "pw", token: "123456", step: 1 })).resolves.toEqual({ actionId: "a1", result: { code: "ACME" } });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/super-admin/tenants?query=acme");
    fetchMock.mockRestore();
  });
});

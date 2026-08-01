import { beforeEach, describe, expect, test, vi } from "vitest";
import { branchService } from "./branchService";

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); localStorage.setItem("accessToken", "token"); });

describe("branchService", () => {
  test("lists branches for the current company", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [{ _id: "b1", code: "HQ", name: "Head Office", companyCode: "ACME", isActive: true }] }), { status: 200 })));
    await expect(branchService.list()).resolves.toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith("/api/v1/auth/branches", expect.objectContaining({ headers: expect.any(Headers) }));
    expect((fetch as any).mock.calls[0][1].headers.get("Authorization")).toBe("Bearer token");
  });

  test("creates, updates, and toggles a branch", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { _id: "b1", code: "HQ", name: "Head Office", companyCode: "ACME", isActive: true } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await branchService.create({ code: "HQ", name: "Head Office" });
    await branchService.update("b1", { name: "Updated" });
    await branchService.update("b1", { isActive: false });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((fetchMock as any).mock.calls[1][0]).toBe("/api/v1/auth/branches/b1");
  });
});
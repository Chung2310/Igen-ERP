// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { branchService } from "./branchService";
import { refreshAccessToken } from "./sessionRefresh";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  localStorage.setItem("accessToken", "token");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const branch = { _id: "b1", code: "HQ", name: "Head Office", companyCode: "ACME", isActive: true };
const success = () => new Response(JSON.stringify({ data: [branch] }));

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

  test("creates an owner and removes a pending branch", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await branchService.createOwner("b 1", { displayName: "Owner", email: "owner@test", password: "secret" });
    await branchService.removePending("b 1");
    expect((fetchMock as any).mock.calls[0][0]).toBe("/api/v1/auth/branches/b%201/owner");
    expect((fetchMock as any).mock.calls[0][1]).toEqual(expect.objectContaining({ method: "POST" }));
    expect((fetchMock as any).mock.calls[1][0]).toBe("/api/v1/auth/branches/b%201/pending");
    expect((fetchMock as any).mock.calls[1][1]).toEqual(expect.objectContaining({ method: "DELETE" }));
  });

  test.each([408, 429, 500, 502, 503, 504])("recovers from a temporary HTTP %s while loading branches", async (status) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("<html>Temporarily unavailable</html>", { status })).mockResolvedValueOnce(success());
    vi.stubGlobal("fetch", fetchMock);
    const result = branchService.list();
    await vi.advanceTimersByTimeAsync(499);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual([branch]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("recovers from a network failure", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(success());
    vi.stubGlobal("fetch", fetchMock);
    const result = branchService.list();
    await vi.advanceTimersByTimeAsync(500);
    await expect(result).resolves.toEqual([branch]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("stops after three network attempts and reports a Vietnamese connection error", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    const result = expect(branchService.list()).rejects.toThrow("Không thể kết nối để tải chi nhánh");
    await vi.advanceTimersByTimeAsync(2000);
    await result;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  test("stops after three HTTP failures and reports a load error instead of an update error", async () => {
    const fetchMock = vi.fn(async () => new Response("Bad Gateway", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = expect(branchService.list()).rejects.toThrow("Không thể tải danh sách chi nhánh");
    await vi.advanceTimersByTimeAsync(2000);
    await result;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  test.each([400, 401, 403, 404, 409, 422])("does not retry HTTP %s or hide a structured server error", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: { code: "BRANCH_ACCESS", message: "Thông báo từ máy chủ", requestId: "req-123" } }), { status })));
    await expect(branchService.list()).rejects.toThrow("Thông báo từ máy chủ");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith("[branchService] Request failed", expect.objectContaining({ path: "/api/v1/auth/branches", status, code: "BRANCH_ACCESS", requestId: "req-123", timestamp: expect.any(String) }));
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("Bearer token");
  });

  test("supports legacy errors and reads proxy request IDs", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Không có quyền quản lý chi nhánh." }), { status: 403, headers: { "x-request-id": "header-id", "cf-ray": "cf-id" } })));
    await expect(branchService.list()).rejects.toThrow("Không có quyền quản lý chi nhánh.");
    expect(console.warn).toHaveBeenCalledWith("[branchService] Request failed", expect.objectContaining({ requestId: "header-id", cfRay: "cf-id" }));
  });

  test.each(["2", new Date(Date.UTC(2026, 10, 9, 8, 0, 2)).toUTCString()])("honors Retry-After %s before retrying", async (retryAfter) => {
    vi.setSystemTime(Date.UTC(2026, 10, 9, 8));
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("", { status: 429, headers: { "Retry-After": retryAfter } })).mockResolvedValueOnce(success());
    vi.stubGlobal("fetch", fetchMock);
    const result = branchService.list();
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual([branch]);
  });

  test("does not retry before a server cooldown that exceeds the request deadline", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429, headers: { "Retry-After": "30" } })));
    await expect(branchService.list()).rejects.toThrow("Hệ thống đang nhận nhiều yêu cầu");
    await vi.advanceTimersByTimeAsync(15000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test.each([null, {}, { data: {} }])("rejects an invalid successful payload without retrying: %j", async (data) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(data))));
    await expect(branchService.list()).rejects.toThrow("Không thể tải danh sách chi nhánh");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("does not start an already aborted request", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const controller = new AbortController();
    controller.abort();
    await expect(branchService.list(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("cancels the retry delay when its caller is aborted", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const result = expect(branchService.list(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await result;
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  test("bounds a stalled read at fifteen seconds even when fetch ignores abort", async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    const result = expect(branchService.list()).rejects.toThrow("Tải chi nhánh quá lâu");
    await vi.advanceTimersByTimeAsync(15000);
    await result;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  test("never retries an old account's request with a different login", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = expect(branchService.list()).rejects.toThrow("Phiên đăng nhập đã thay đổi");
    await vi.advanceTimersByTimeAsync(0);
    localStorage.setItem("accessToken", "another-login");
    await vi.advanceTimersByTimeAsync(500);
    await result;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("allows a refreshed token from the same session on retry", async () => {
    const fetchMock = vi.fn().mockImplementationOnce(async () => {
      await refreshAccessToken(vi.fn(async () => new Response(JSON.stringify({ accessToken: "refreshed-token" }))));
      return new Response("", { status: 503 });
    }).mockResolvedValueOnce(success());
    vi.stubGlobal("fetch", fetchMock);
    const result = branchService.list();
    await vi.advanceTimersByTimeAsync(500);
    await expect(result).resolves.toEqual([branch]);
    expect(fetchMock.mock.calls[1][1].headers.get("Authorization")).toBe("Bearer refreshed-token");
  });

  test("discards a successful response if the login changed during the read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { localStorage.setItem("accessToken", "another-login"); return success(); }));
    await expect(branchService.list()).rejects.toThrow("Phiên đăng nhập đã thay đổi");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test.each(["create", "update", "createOwner", "removePending"])("never automatically replays the %s mutation", async (operation) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    const result = operation === "create" ? branchService.create({ code: "HQ", name: "Head Office" })
      : operation === "update" ? branchService.update("b1", { name: "Updated" })
      : operation === "createOwner" ? branchService.createOwner("b1", { displayName: "Owner", email: "owner@test", password: "secret" })
      : branchService.removePending("b1");
    await expect(result).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

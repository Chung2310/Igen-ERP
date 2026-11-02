// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../modules/shared/lib/apiFetch";
import { inventoryCountService, countQueueKey } from "./inventoryCountService";

vi.mock("../modules/shared/lib/apiFetch", () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
const scope = { companyCode: "IGEN", branchId: "b", userId: "u" };
const key = countQueueKey(scope);
const requestId = "11111111-1111-4111-8111-111111111111";
const completed = { status: "completed", requestId, countId: "c", itemId: "i", committedVersion: 4, currentVersion: 4 };
const entry = { requestId, id: "c", itemId: "i", countedQuantity: 7, expectedVersion: 3 };
const queued = () => JSON.parse(localStorage.getItem(key) || "[]");

describe("versioned inventory count edits", () => {
  it("sends explicit approval review with its version", async () => {
    const review = { expectedVersion: 3, discrepancyConfirmed: true, reason: "Recounted", unexpectedScanResolutions: [{ code: "EXTRA", reason: "Excluded" }] };
    fetchMock.mockResolvedValue({ data: { _id: "c", version: 4 } });
    await inventoryCountService.approve("c", review);
    expect(fetchMock.mock.calls[0][0]).toBe("/inventory/counts/c/approve");
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual(review);
  });
  beforeEach(() => { vi.restoreAllMocks(); fetchMock.mockReset(); localStorage.clear(); vi.spyOn(crypto, "randomUUID").mockReturnValue(requestId);
    const held = new Set<string>();
    Object.defineProperty(navigator, "locks", { configurable: true, value: { request: async (name: string, _options: unknown, work: any) => {
      if (held.has(name)) return work(null);
      held.add(name); try { return await work({ name }); } finally { held.delete(name); }
    } } }); vi.spyOn(navigator, "onLine", "get").mockReturnValue(true); });
  it("sends the displayed version with quantity and rejects a missing version locally", async () => {
    fetchMock.mockResolvedValue({ data: { _id: "c", version: 4 } });
    await inventoryCountService.updateItem("c", "i", 7, 3, scope);
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ countedQuantity: 7, expectedVersion: 3, requestId });
    await expect(inventoryCountService.updateItem("c", "i", 7, undefined as any, scope)).rejects.toThrow(/tải lại/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("retains the original version offline and never rebases a conflicting replay", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(inventoryCountService.updateItem("c", "i", 7, 3, scope)).rejects.toThrow();
    expect(queued()).toEqual([entry]);
    fetchMock.mockClear().mockRejectedValue({ status: 409 });
    expect(await inventoryCountService.syncPending(scope)).toEqual({ remaining: 1, conflicts: 1, legacy: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).expectedVersion).toBe(3);
    expect(queued()).toEqual([entry]);
  });
  it("keeps legacy unversioned queued edits for manual reconciliation without sending", async () => {
    localStorage.setItem(key, JSON.stringify([{ id: "c", itemId: "i", countedQuantity: 7 }]));
    expect(await inventoryCountService.syncPending(scope)).toEqual({ remaining: 1, conflicts: 1, legacy: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects overlapping sync calls and preserves a newer queued edit while replay is in flight", async () => {
    localStorage.setItem(key, JSON.stringify([entry]));
    let resolve!: (value: any) => void;
    fetchMock.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const first = inventoryCountService.syncPending(scope);
    const second = expect(inventoryCountService.syncPending(scope)).rejects.toThrow(/tab khác/);
    localStorage.setItem(key, JSON.stringify([{ ...entry, countedQuantity: 8 }]));
    resolve({ data: completed });
    await Promise.all([first, second]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(queued()).toEqual([{ ...entry, countedQuantity: 8 }]);
  });
  it("removes a verified completed entry and keeps other failed entries", async () => {
    localStorage.setItem(key, JSON.stringify([entry, { ...entry, itemId: "other" }]));
    fetchMock.mockResolvedValueOnce({ data: completed }).mockRejectedValueOnce({ status: 409 });
    expect(await inventoryCountService.syncPending(scope)).toEqual({ remaining: 1, conflicts: 1, legacy: false });
    expect(queued()[0].itemId).toBe("other");
  });
  it("reloads before discarding only the selected count's pending edits", async () => {
    localStorage.setItem(key, JSON.stringify([entry, { ...entry, id: "other" }]));
    fetchMock.mockRejectedValueOnce(new Error("network"));
    await expect(inventoryCountService.reload("c", scope)).rejects.toThrow();
    expect(queued()).toHaveLength(2);
    fetchMock.mockResolvedValueOnce({ data: { status: "revoked", requestId, countId: "c", itemId: "i" } }).mockResolvedValueOnce({ data: { _id: "c", version: 9 } });
    expect(await inventoryCountService.reload("c", scope)).toMatchObject({ version: 9 });
    expect(queued()).toEqual([{ ...entry, id: "other" }]);
  });
});


describe("scoped durable count queue", () => {
  beforeEach(() => { fetchMock.mockReset(); localStorage.clear(); vi.spyOn(crypto, "randomUUID").mockReturnValue(requestId); Object.defineProperty(navigator, "locks", { configurable: true, value: { request: async (_name: string, _options: unknown, work: any) => work({}) } }); });
  it("never adopts or erases the unowned legacy queue", async () => {
    localStorage.setItem("igen.inventory-count.pending", "broken legacy data");
    expect(await inventoryCountService.syncPending(scope)).toEqual({ remaining: 0, conflicts: 0, legacy: true });
    await inventoryCountService.discardPending("c", scope);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("igen.inventory-count.pending")).toBe("broken legacy data");
  });
  it.each(["{broken", "{}", '[null]', '[{"id":"c","itemId":"i","countedQuantity":-1}]'])("preserves malformed scoped data %s and sends nothing", async raw => {
    localStorage.setItem(key, raw);
    await expect(inventoryCountService.syncPending(scope)).rejects.toThrow(/giữ nguyên/);
    await expect(inventoryCountService.updateItem("c", "i", 7, 3, scope)).rejects.toThrow();
    await expect(inventoryCountService.reload("c", scope)).rejects.toThrow();
    await expect(inventoryCountService.discardPending("c", scope)).rejects.toThrow();
    expect(localStorage.getItem(key)).toBe(raw);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([{ ...scope, userId: "other" }, { ...scope, branchId: "other" }, { ...scope, companyCode: "OTHER" }])("does not replay another scope %j", async other => {
    localStorage.setItem(countQueueKey(other), JSON.stringify([entry]));
    await inventoryCountService.syncPending(scope);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(countQueueKey(other))!)).toEqual([entry]);
  });
  it("persists before sending and retains uncertain online failures without overwriting", async () => {
    fetchMock.mockImplementation(async () => { expect(queued()).toEqual([entry]); throw new Error("lost response"); });
    await expect(inventoryCountService.updateItem("c", "i", 7, 3, scope)).rejects.toThrow("lost response");
    await expect(inventoryCountService.updateItem("c", "i", 8, 4, scope)).rejects.toThrow(/đang chờ/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(queued()).toEqual([entry]);
  });
  it("sends the captured branch and stops after the account changes", async () => {
    localStorage.setItem(key, JSON.stringify([entry, { ...entry, itemId: "other" }]));
    fetchMock.mockImplementation(async (_url, options) => {
      expect(options?.headers).toEqual({ "x-branch-id": "b" });
      localStorage.setItem("accessToken", "another-account");
      return { data: {} };
    });
    await expect(inventoryCountService.syncPending(scope)).rejects.toThrow(/đã thay đổi/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(queued()).toHaveLength(2);
  });
  it("preserves edits when reload completes after scope changes", async () => {
    localStorage.setItem(key, JSON.stringify([entry]));
    let current = true;
    fetchMock.mockImplementation(async () => { current = false; return { data: {} }; });
    await expect(inventoryCountService.reload("c", { ...scope, isCurrent: () => current })).rejects.toThrow(/đã thay đổi/);
    expect(queued()).toEqual([entry]);
  });
  it("does not treat reload as permission to drop a replaced or in-flight request", async () => {
    localStorage.setItem(key, JSON.stringify([entry]));
    fetchMock.mockImplementation(async () => { localStorage.setItem(key, JSON.stringify([{ ...entry, countedQuantity: 8 }])); return { data: { status: "revoked", requestId, countId: "c", itemId: "i" } }; });
    await expect(inventoryCountService.reload("c", scope)).rejects.toThrow(/thay đổi/);
    expect(queued()).toEqual([{ ...entry, countedQuantity: 8 }]);
  });
  it("fails closed without locks or a complete scope", async () => {
    Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
    await expect(inventoryCountService.updateItem("c", "i", 7, 3, scope)).rejects.toThrow(/khóa/);
    await expect(inventoryCountService.syncPending({ ...scope, userId: "" })).rejects.toThrow(/tài khoản/);
    expect(fetchMock).not.toHaveBeenCalled(); expect(localStorage.getItem(key)).toBeNull();
  });
  it("sends nothing when persistence fails", async () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    try { await expect(inventoryCountService.updateItem("c", "i", 7, 3, scope)).rejects.toThrow("quota"); expect(fetchMock).not.toHaveBeenCalled(); } finally { spy.mockRestore(); }
  });
});


describe("read-only pending inspection", () => {
  beforeEach(() => { fetchMock.mockReset(); localStorage.clear(); vi.spyOn(crypto, "randomUUID").mockReturnValue(requestId); });
  it("preserves and exposes malformed raw records without assigning legacy ownership", () => {
    localStorage.setItem(key, " { broken "); localStorage.setItem("igen.inventory-count.pending", "old raw");
    expect(inventoryCountService.inspectPending(scope)).toMatchObject({ raw: " { broken ", legacyRaw: "old raw", entries: [], error: expect.any(String) });
    expect(localStorage.getItem(key)).toBe(" { broken "); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reads only the active scope and keeps unversioned rows available for comparison", () => {
    localStorage.setItem(countQueueKey({ ...scope, userId: "other" }), JSON.stringify([entry]));
    expect(inventoryCountService.inspectPending(scope).entries).toEqual([]);
    localStorage.setItem(key, JSON.stringify([{ ...entry, expectedVersion: undefined }]));
    expect(inventoryCountService.inspectPending(scope).entries).toHaveLength(1);
  });
  it("does not infer success or delete a pending edit when server quantity matches", async () => {
    localStorage.setItem(key, JSON.stringify([entry]));
    fetchMock.mockResolvedValue({ data: { _id: "c", version: 4, items: [{ _id: "i", countedQuantity: 7 }] } });
    await expect(inventoryCountService.comparePending(entry, scope)).resolves.toMatchObject({ version: 4 });
    expect(fetchMock).toHaveBeenCalledWith("/inventory/counts/c", { refreshSession: false, headers: { "x-branch-id": "b" } });
    expect(queued()).toEqual([entry]);
  });
  it.each(["replacement", "session", "wrong-document", "network"])("retains data and rejects comparison after %s", async failure => {
    localStorage.setItem(key, JSON.stringify([entry]));
    fetchMock.mockImplementation(async () => {
      if (failure === "replacement") localStorage.setItem(key, JSON.stringify([{ ...entry, countedQuantity: 8 }]));
      if (failure === "session") localStorage.setItem("accessToken", "changed");
      if (failure === "network") throw new Error("network");
      return { data: { _id: failure === "wrong-document" ? "other" : "c" } };
    });
    await expect(inventoryCountService.comparePending(entry, scope)).rejects.toThrow();
    expect(queued()).toHaveLength(1); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects an entry no longer stored before requesting server data", async () => {
    await expect(inventoryCountService.comparePending(entry, scope)).rejects.toThrow(/đã thay đổi/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});


describe("request-based count recovery", () => {
  beforeEach(() => {
    fetchMock.mockReset(); localStorage.clear();
    Object.defineProperty(navigator, "locks", { configurable: true, value: { request: async (_name: string, _options: unknown, work: any) => work({}) } });
    localStorage.setItem(key, JSON.stringify([entry]));
  });
  it("reconciles a committed request and clears only its matching record without PATCH", async () => {
    fetchMock.mockResolvedValue({ data: { ...completed, currentVersion: 9 } });
    expect(await inventoryCountService.reconcilePending(entry, scope)).toMatchObject({ status: "completed" });
    expect(queued()).toEqual([]); expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/inventory/counts/c/items/i/reconcile");
  });
  it("preserves not_found without treating it as permission to discard", async () => {
    fetchMock.mockResolvedValue({ data: { ...completed, status: "not_found" } });
    expect((await inventoryCountService.reconcilePending(entry, scope)).status).toBe("not_found");
    expect(queued()).toEqual([entry]); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("automatically replays only not_found requests with their original identity and version", async () => {
    fetchMock.mockResolvedValueOnce({ data: { ...completed, status: "not_found" } }).mockResolvedValueOnce({ data: { _id: "c", version: 4 } });
    expect((await inventoryCountService.syncPending(scope)).remaining).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
    expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).toEqual({ requestId, expectedVersion: 3, countedQuantity: 7 });
  });
  it.each([{ ...completed, requestId: "wrong" }, { ...completed, countId: "wrong" }, { ...completed, itemId: "wrong" }, { ...completed, committedVersion: 9 }, { ...completed, currentVersion: 2 }, { ...completed, status: "processing" }, null])("retains records for invalid evidence %j", async evidence => {
    fetchMock.mockResolvedValue({ data: evidence });
    await expect(inventoryCountService.reconcilePending(entry, scope)).rejects.toThrow();
    expect(queued()).toEqual([entry]); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(["replacement", "session"])("does not clean up after %s changes during verification", async change => {
    fetchMock.mockImplementation(async () => {
      if (change === "replacement") localStorage.setItem(key, JSON.stringify([{ ...entry, countedQuantity: 8 }]));
      else localStorage.setItem("accessToken", "other");
      return { data: completed };
    });
    await expect(inventoryCountService.reconcilePending(entry, scope)).rejects.toThrow(/đã thay đổi/);
    expect(queued()).toHaveLength(1);
  });
  it("never assigns a new request identity to an old versioned edit", async () => {
    const old = { ...entry, requestId: undefined }; localStorage.setItem(key, JSON.stringify([old]));
    expect((await inventoryCountService.syncPending(scope)).conflicts).toBe(1);
    await expect(inventoryCountService.reconcilePending(old, scope)).rejects.toThrow(/cũ/);
    expect(fetchMock).not.toHaveBeenCalled(); expect(queued()[0].requestId).toBeUndefined();
  });
});

it("does not replay a replaced record after a not_found response arrives", async () => {
  fetchMock.mockReset(); localStorage.clear();
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: async (_name: string, _options: unknown, work: any) => work({}) } });
  localStorage.setItem(key, JSON.stringify([entry]));
  fetchMock.mockImplementation(async () => {
    localStorage.setItem(key, JSON.stringify([{ ...entry, countedQuantity: 8 }]));
    return { data: { ...completed, status: "not_found" } };
  });
  expect((await inventoryCountService.syncPending(scope)).remaining).toBe(1);
  expect(fetchMock).toHaveBeenCalledTimes(1); expect(queued()[0].countedQuantity).toBe(8);
});

describe("safe pending count revocation", () => {
  beforeEach(() => { fetchMock.mockReset(); localStorage.clear(); vi.spyOn(crypto, "randomUUID").mockReturnValue(requestId); Object.defineProperty(navigator, "locks", { configurable: true, value: { request: async (_name: string, _options: unknown, work: any) => work({}) } }); localStorage.setItem(key, JSON.stringify([entry])); });
  it("posts the bound fingerprint, clears only after revoked evidence and retains other rows", async () => {
    const other = { ...entry, itemId: "other" }; localStorage.setItem(key, JSON.stringify([entry, other]));
    fetchMock.mockResolvedValue({ data: { status: "revoked", requestId, countId: "c", itemId: "i" } });
    await expect(inventoryCountService.revokePending(entry, scope)).resolves.toMatchObject({ status: "revoked" });
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(fetchMock.mock.calls[0][0]).toBe("/inventory/counts/c/items/i/revoke-request");
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ requestId, countedQuantity: 7, expectedVersion: 3 });
    expect(queued()).toEqual([other]);
  });
  it("clears an already-completed request only after verifying its committed version", async () => {
    fetchMock.mockResolvedValue({ data: completed });
    expect((await inventoryCountService.revokePending(entry, scope)).status).toBe("completed");
    expect(queued()).toEqual([]);
  });
  it.each([{ status: "not_found" }, { status: "revoked", requestId: "other" }, { status: "revoked", countId: "other" }, { status: "revoked", itemId: "other" }, null])("preserves a request if the revoke response is incomplete: %j", async response => {
    fetchMock.mockResolvedValue({ data: response });
    await expect(inventoryCountService.revokePending(entry, scope)).rejects.toThrow();
    expect(queued()).toEqual([entry]);
  });
  it("does not clear a row replaced while revocation is in flight", async () => {
    fetchMock.mockImplementation(async () => { localStorage.setItem(key, JSON.stringify([{ ...entry, countedQuantity: 8 }])); return { data: { ...completed, status: "revoked" } }; });
    await expect(inventoryCountService.revokePending(entry, scope)).rejects.toThrow(/thay đổi/);
    expect(queued()[0].countedQuantity).toBe(8);
  });
  it("clears a revocation already committed by another tab during sync without retrying the PATCH", async () => {
    localStorage.setItem(key, JSON.stringify([entry]));
    fetchMock.mockResolvedValueOnce({ data: { status: "revoked", requestId, countId: "c", itemId: "i" } });
    expect((await inventoryCountService.syncPending(scope)).remaining).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});


describe("safe explicit discard", () => {
  beforeEach(() => { fetchMock.mockReset(); localStorage.clear(); Object.defineProperty(navigator, "locks", { configurable: true, value: { request: async (_name: string, _options: unknown, work: any) => work({}) } }); });
  it("requires durable server revocation before removing pending rows for a count", async () => {
    localStorage.setItem(key, JSON.stringify([entry, { ...entry, itemId: "other" }]));
    fetchMock.mockResolvedValueOnce({ data: { status: "revoked", requestId, countId: "c", itemId: "i" } }).mockResolvedValueOnce({ data: { status: "revoked", requestId, countId: "c", itemId: "other" } });
    await inventoryCountService.discardPending("c", scope);
    expect(queued()).toEqual([]); expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => String(url).endsWith("/revoke-request"))).toBe(true);
  });
  it("retains legacy entries without identities rather than deleting them", async () => {
    const old = { id: "c", itemId: "i", countedQuantity: 7, expectedVersion: 3 }; localStorage.setItem(key, JSON.stringify([old]));
    await expect(inventoryCountService.discardPending("c", scope)).rejects.toThrow(/cũ thiếu mã yêu cầu/);
    expect(queued()).toEqual([old]); expect(fetchMock).not.toHaveBeenCalled();
  });
});

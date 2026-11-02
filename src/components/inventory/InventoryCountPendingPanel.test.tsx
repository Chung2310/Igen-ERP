// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InventoryCountPendingPanel } from "./InventoryCountPendingPanel";
import { inventoryCountService, countQueueChangedEvent } from "../../services/inventoryCountService";
const confirmation = vi.hoisted(() => ({ confirm: vi.fn(async () => true) }));
vi.mock("../../services/inventoryCountService", () => ({ countQueueChangedEvent: "queue-change", inventoryCountService: { inspectPending: vi.fn(), comparePending: vi.fn(), reconcilePending: vi.fn(), revokePending: vi.fn() } }));
vi.mock("../../context/ConfirmationContext", () => ({ useConfirmation: () => confirmation.confirm }));
const scope = { companyCode: "IGEN", branchId: "b", userId: "u" };
const entry = { id: "c", itemId: "i", countedQuantity: 7, expectedVersion: 3 };
const snapshot = { raw: JSON.stringify([entry]), legacyRaw: null, entries: [entry] };
const latest = { _id: "c", countCode: "KK-1", warehouseId: "w", version: 4, items: [{ _id: "i", countedQuantity: 7 }] };
beforeEach(() => { vi.resetAllMocks(); confirmation.confirm.mockResolvedValue(true); vi.mocked(inventoryCountService.inspectPending).mockReturnValue(snapshot); });
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("compares quantities and versions without exposing a destructive resolution action", async () => {
  vi.mocked(inventoryCountService.comparePending).mockResolvedValue(latest as any);
  render(<InventoryCountPendingPanel scope={scope} />);
  fireEvent.click(screen.getByRole("button", { name: "Đối chiếu c / i" }));
  const status = await screen.findByRole("status");
  expect(status.textContent).toContain("Phiên bản gốc: 3; phiên bản máy chủ: 4");
  expect(status.textContent).toContain("Số đếm đã lưu: 7; số đếm máy chủ: 7");
  expect(screen.getByText(/chưa chứng minh lần lưu/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /xóa|áp dụng|hoàn tất/i })).toBeNull();
});
it("shows a missing server row without inventing a zero quantity", async () => {
  vi.mocked(inventoryCountService.comparePending).mockResolvedValue({ ...latest, items: [] } as any);
  render(<InventoryCountPendingPanel scope={scope} />);
  fireEvent.click(screen.getByRole("button", { name: "Đối chiếu c / i" }));
  expect((await screen.findByRole("status")).textContent).toContain("Không tìm thấy dòng tương ứng");
});
it("exports the exact corrupt and legacy raw text, with no comparison or adoption", () => {
  vi.useFakeTimers();
  const raw = " { broken\n  ", legacyRaw = "legacy\nuntouched";
  vi.mocked(inventoryCountService.inspectPending).mockReturnValue({ raw, legacyRaw, entries: [], error: "Dữ liệu lỗi" });
  const blobs: Blob[] = [];
  vi.stubGlobal("URL", { createObjectURL: vi.fn((blob: Blob) => { blobs.push(blob); return "blob:test"; }), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const blobConstructor = vi.fn(function(this: object, parts: BlobPart[], options: BlobPropertyBag) { Object.assign(this, { parts, options }); });
  vi.stubGlobal("Blob", blobConstructor);
  render(<InventoryCountPendingPanel scope={scope} />);
  fireEvent.click(screen.getByText("Dữ liệu gốc của tài khoản hiện tại"));
  fireEvent.click(screen.getByText("Dữ liệu cũ chưa rõ chủ sở hữu"));
  fireEvent.click(screen.getByRole("button", { name: "Xuất bản chờ nguyên gốc" }));
  fireEvent.click(screen.getByRole("button", { name: "Xuất dữ liệu cũ nguyên gốc" }));
  expect(blobConstructor.mock.calls.map(call => call[0])).toEqual([[raw], [legacyRaw]]);
  expect(inventoryCountService.comparePending).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /Đối chiếu/ })).toBeNull();
});
it("invalidates an in-flight comparison when another tab changes storage", async () => {
  let resolve!: (value: any) => void;
  vi.mocked(inventoryCountService.comparePending).mockReturnValue(new Promise(done => { resolve = done; }));
  render(<InventoryCountPendingPanel scope={scope} />);
  fireEvent.click(screen.getByRole("button", { name: "Đối chiếu c / i" }));
  vi.mocked(inventoryCountService.inspectPending).mockReturnValue({ ...snapshot, entries: [{ ...entry, countedQuantity: 9 }] });
  act(() => window.dispatchEvent(new Event("storage")));
  await act(async () => resolve(latest));
  expect(screen.queryByRole("status")).toBeNull(); expect(screen.getByText("9")).toBeTruthy();
});
it("updates from writes in the same tab and preserves errors after a failed read", async () => {
  render(<InventoryCountPendingPanel scope={scope} />);
  vi.mocked(inventoryCountService.comparePending).mockRejectedValue(new Error("Không có quyền đọc phiếu"));
  fireEvent.click(screen.getByRole("button", { name: "Đối chiếu c / i" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Không có quyền đọc phiếu");
  expect(screen.getByText("7")).toBeTruthy();
  vi.mocked(inventoryCountService.inspectPending).mockReturnValue({ raw: "[]", legacyRaw: null, entries: [] });
  act(() => window.dispatchEvent(new Event(countQueueChangedEvent)));
  expect(screen.queryByRole("region")).toBeNull();
});
it("ignores a comparison that completes after the scope changes", async () => {
  let resolve!: (value: any) => void;
  vi.mocked(inventoryCountService.comparePending).mockReturnValue(new Promise(done => { resolve = done; }));
  const { rerender } = render(<InventoryCountPendingPanel scope={scope} />);
  fireEvent.click(screen.getByRole("button", { name: "Đối chiếu c / i" }));
  rerender(<InventoryCountPendingPanel scope={{ ...scope, userId: "other" }} />);
  await act(async () => resolve(latest));
  expect(screen.queryByRole("status")).toBeNull();
});

it("renders invalid historical versions safely during comparison", async () => {
  vi.mocked(inventoryCountService.inspectPending).mockReturnValue({ ...snapshot, entries: [{ ...entry, expectedVersion: { bad: true } as any }] });
  vi.mocked(inventoryCountService.comparePending).mockResolvedValue(latest as any);
  render(<InventoryCountPendingPanel scope={scope} />);
  fireEvent.click(screen.getByRole("button", { name: "Đối chiếu c / i" }));
  expect((await screen.findByRole("status")).textContent).toContain("Phiên bản gốc: Thiếu hoặc không hợp lệ");
});

it("keeps a not_found request visible and explains that verification does not revoke it", async () => {
  const keyed = { ...entry, requestId: "11111111-1111-4111-8111-111111111111" };
  vi.mocked(inventoryCountService.inspectPending).mockReturnValue({ ...snapshot, entries: [keyed] });
  vi.mocked(inventoryCountService.reconcilePending).mockResolvedValue({ status: "not_found", requestId: keyed.requestId, countId: "c", itemId: "i" });
  render(<InventoryCountPendingPanel scope={scope} />);
  fireEvent.click(screen.getByRole("button", { name: "Xác minh lần lưu c / i" }));
  expect((await screen.findByRole("alert")).textContent).toContain("không thu hồi yêu cầu đang gửi");
  expect(inventoryCountService.comparePending).not.toHaveBeenCalled();
  expect(screen.getByText("7")).toBeTruthy();
});
it("removes the row after the service verifies and publishes matching cleanup", async () => {
  const keyed = { ...entry, requestId: "11111111-1111-4111-8111-111111111111" };
  vi.mocked(inventoryCountService.inspectPending).mockReturnValue({ ...snapshot, entries: [keyed] });
  vi.mocked(inventoryCountService.reconcilePending).mockImplementation(async () => {
    vi.mocked(inventoryCountService.inspectPending).mockReturnValue({ raw: "[]", legacyRaw: null, entries: [] });
    window.dispatchEvent(new Event(countQueueChangedEvent));
    return { status: "completed", requestId: keyed.requestId, countId: "c", itemId: "i", committedVersion: 4, currentVersion: 4 };
  });
  render(<InventoryCountPendingPanel scope={scope} />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Xác minh lần lưu c / i" })));
  expect(screen.queryByRole("region")).toBeNull();
});

it("ignores late verification errors after switching operators", async () => {
  const keyed = { ...entry, requestId: "11111111-1111-4111-8111-111111111111" };
  vi.mocked(inventoryCountService.inspectPending).mockReturnValue({ ...snapshot, entries: [keyed] });
  let reject!: (value: any) => void;
  vi.mocked(inventoryCountService.reconcilePending).mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
  const { rerender } = render(<InventoryCountPendingPanel scope={scope} />);
  fireEvent.click(screen.getByRole("button", { name: "Xác minh lần lưu c / i" }));
  rerender(<InventoryCountPendingPanel scope={{ ...scope, userId: "other" }} />);
  await act(async () => reject(new Error("late error")));
  expect(screen.queryByRole("alert")).toBeNull();
});

it("requires confirmation before revoking and distinguishes an in-flight request from a committed one", async () => {
  const keyed = { ...entry, requestId: "11111111-1111-4111-8111-111111111111" };
  vi.mocked(inventoryCountService.inspectPending).mockReturnValue({ ...snapshot, entries: [keyed] });
  confirmation.confirm.mockResolvedValueOnce(false);
  vi.mocked(inventoryCountService.revokePending).mockImplementation(async () => {
    vi.mocked(inventoryCountService.inspectPending).mockReturnValue({ raw: "[]", legacyRaw: null, entries: [] });
    window.dispatchEvent(new Event(countQueueChangedEvent));
    return { status: "revoked", requestId: keyed.requestId, countId: "c", itemId: "i" };
  });
  render(<InventoryCountPendingPanel scope={scope} />);
  fireEvent.click(screen.getByRole("button", { name: "Thu hồi c / i" }));
  expect(inventoryCountService.revokePending).not.toHaveBeenCalled();
  confirmation.confirm.mockResolvedValueOnce(true);
  fireEvent.click(screen.getByRole("button", { name: "Thu hồi c / i" }));
  expect((await screen.findByRole("status")).textContent).toContain("đã được thu hồi trên máy chủ");
  expect(inventoryCountService.revokePending).toHaveBeenCalledWith(keyed, scope);
});
it("reports completed instead of claiming a committed count was revoked", async () => {
  const keyed = { ...entry, requestId: "11111111-1111-4111-8111-111111111111" };
  vi.mocked(inventoryCountService.inspectPending).mockReturnValue({ ...snapshot, entries: [keyed] });
  vi.mocked(inventoryCountService.revokePending).mockResolvedValue({ status: "completed", requestId: keyed.requestId, countId: "c", itemId: "i", committedVersion: 4, currentVersion: 7 });
  render(<InventoryCountPendingPanel scope={scope} />);
  fireEvent.click(screen.getByRole("button", { name: "Thu hồi c / i" }));
  expect((await screen.findByRole("status")).textContent).toContain("đã ghi nhận; phiếu được giữ nguyên");
});

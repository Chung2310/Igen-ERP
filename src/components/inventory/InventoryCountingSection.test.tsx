// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryCountingModal } from "./InventoryCountingSection";
import { inventoryCountService } from "../../services/inventoryCountService";
import { toast } from "../../pages/Toast";

vi.mock("../../services/inventoryCountService", () => ({ inventoryCountService: { list: vi.fn(), syncPending: vi.fn(), updateItem: vi.fn(), reload: vi.fn(), get: vi.fn(), recreate: vi.fn(), approve: vi.fn() } }));
vi.mock("./InventoryCountPendingPanel", () => ({ InventoryCountPendingPanel: () => null }));
vi.mock("../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const auth = vi.hoisted(() => ({ user: { id: "approver" }, userProfile: { companyCode: "IGEN", branchId: "b" }, hasPermission: vi.fn() }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => auth }));
const confirmation = vi.hoisted(() => ({ confirm: vi.fn(async () => true) }));
vi.mock("../../context/ConfirmationContext", () => ({ useConfirmation: () => confirmation.confirm }));
const fixture = { _id: "c", version: 3, countCode: "KK-1", warehouseId: "w", status: "counting" as const, createdAt: "2026-09-29", items: [{ _id: "i", productId: "p", sku: "SKU-1", productName: "Phone", systemQuantity: 10, countedQuantity: 10, quantityDelta: 0 }] };
beforeEach(() => {
  vi.clearAllMocks();
  confirmation.confirm.mockResolvedValue(true);
  auth.user.id = "approver";
  auth.userProfile.branchId = "b";
  auth.hasPermission.mockReturnValue(false);
  vi.mocked(inventoryCountService.list).mockResolvedValue([fixture]);
  vi.mocked(inventoryCountService.syncPending).mockResolvedValue({ remaining: 0, conflicts: 0, legacy: false });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("count edit conflict UI", () => {
  it("requires discrepancy confirmation and every unexpected-code reason before approval", async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryCountService.list).mockResolvedValue([{ ...fixture, status: "pending_approval", createdById: "creator", items: [{ ...fixture.items[0], countedQuantity: 8, quantityDelta: -2 }], unexpectedScans: [{ code: "EXTRA", reason: "unknown", scannedAt: "2026-09-29" }] }]);
    vi.mocked(inventoryCountService.approve).mockResolvedValue({ ...fixture, status: "completed", version: 4 });
    auth.hasPermission.mockReturnValue(true);
    render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    const approve = await screen.findByRole("button", { name: "Duyệt & Cân bằng tồn kho thực tế" });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText("Lý do chênh lệch"), "Recount verified");
    await user.click(screen.getByRole("checkbox", { name: /Tôi đã đối chiếu/ }));
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText("Kết quả đối chiếu mã ngoài dự kiến EXTRA"), "Customer equipment");
    expect((approve as HTMLButtonElement).disabled).toBe(false);
    await user.click(approve);
    await waitFor(() => expect(inventoryCountService.approve).toHaveBeenCalledWith("c", { expectedVersion: 3, discrepancyConfirmed: true, reason: "Recount verified", unexpectedScanResolutions: [{ code: "EXTRA", reason: "Customer equipment" }] }));
  });
  it("confirms recreation and opens the new empty count with a link to its source", async () => {
    vi.mocked(inventoryCountService.list).mockResolvedValue([{ ...fixture, status: "conflict" }]);
    vi.mocked(inventoryCountService.recreate).mockResolvedValue({ ...fixture, _id: "new", countCode: "KK-NEW", status: "draft", recreatedFromId: "c", items: [{ ...fixture.items[0], countedQuantity: 0, quantityDelta: -10 }] });
    auth.hasPermission.mockImplementation((permission) => permission === "inventory:manage");
    confirmation.confirm.mockResolvedValueOnce(false);
    render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    const button = await screen.findByRole("button", { name: "Tạo lại phiếu kiểm kê" });
    fireEvent.click(button);
    expect(inventoryCountService.recreate).not.toHaveBeenCalled();
    confirmation.confirm.mockResolvedValueOnce(true); fireEvent.click(button);
    await waitFor(() => expect(inventoryCountService.recreate).toHaveBeenCalledWith("c"));
    await screen.findByRole("button", { name: "Xem phiếu xung đột gốc" });
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("0");
  });
  it("disables recreation without inventory management permission", async () => {
    vi.mocked(inventoryCountService.list).mockResolvedValue([{ ...fixture, status: "conflict" }]);
    render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    const button = await screen.findByRole("button", { name: "Tạo lại phiếu kiểm kê" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
  it("refreshes the conflict state after failed approval so recreation becomes available", async () => {
    vi.mocked(inventoryCountService.list).mockResolvedValue([{ ...fixture, status: "pending_approval", createdById: "creator" }]);
    vi.mocked(inventoryCountService.approve).mockRejectedValue({ status: 409, message: "Stock changed" });
    vi.mocked(inventoryCountService.get).mockResolvedValue({ ...fixture, status: "conflict" });
    auth.hasPermission.mockReturnValue(true);
    render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Duyệt & Cân bằng tồn kho thực tế" }));
    await screen.findByRole("button", { name: "Tạo lại phiếu kiểm kê" });
    expect(inventoryCountService.get).toHaveBeenCalledWith("c");
    expect(inventoryCountService.recreate).not.toHaveBeenCalled();
  });
  it("only enables approval for an independently identified approver with the dedicated permission", async () => {
    vi.mocked(inventoryCountService.list).mockResolvedValue([{ ...fixture, status: "pending_approval", createdById: "creator", submittedById: "submitter" }]);
    const { rerender } = render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    const button = await screen.findByRole("button", { name: "Duyệt & Cân bằng tồn kho thực tế" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    auth.hasPermission.mockImplementation((permission) => permission === "inventory-count-approval:manage");
    rerender(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    expect((button as HTMLButtonElement).disabled).toBe(false);
    auth.user.id = "creator";
    rerender(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    expect((await screen.findByRole("button", { name: "Duyệt & Cân bằng tồn kho thực tế" }) as HTMLButtonElement).disabled).toBe(true);
    auth.user.id = "submitter";
    rerender(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    expect((await screen.findByRole("button", { name: "Duyệt & Cân bằng tồn kho thực tế" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("submits the displayed version and reports a stale edit without silently retrying", async () => {
    vi.mocked(inventoryCountService.updateItem).mockRejectedValue(new Error("Phiếu đã thay đổi, hãy tải lại"));
    render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    const input = await screen.findByRole("spinbutton");
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.blur(input);
    await waitFor(() => expect(inventoryCountService.updateItem).toHaveBeenCalledWith("c", "i", 7, 3, expect.objectContaining({ companyCode: "IGEN", branchId: "b", userId: "approver" })));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Phiếu đã thay đổi, hãy tải lại"));
    expect(inventoryCountService.updateItem).toHaveBeenCalledTimes(1);
    expect(inventoryCountService.reload).not.toHaveBeenCalled();
  });
  it("requires confirmation before replacing edits with the reloaded count", async () => {
    confirmation.confirm.mockResolvedValueOnce(false);
    vi.mocked(inventoryCountService.reload).mockResolvedValue({ ...fixture, version: 9, items: [{ ...fixture.items[0], countedQuantity: 12 }] });
    render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    const reload = await screen.findByRole("button", { name: "Tải lại phiếu" });
    fireEvent.click(reload);
    expect(inventoryCountService.reload).not.toHaveBeenCalled();
    confirmation.confirm.mockResolvedValueOnce(true);
    fireEvent.click(reload);
    await waitFor(() => expect(inventoryCountService.reload).toHaveBeenCalledWith("c", expect.objectContaining({ branchId: "b" })));
    await waitFor(() => expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("12"));
  });
});


describe("count queue scope changes", () => {
  it.each(["update", "reload"])("ignores late %s results after a branch switch", async operation => {
    let complete!: (value: any) => void;
    const pending = new Promise<any>(resolve => { complete = resolve; });
    vi.mocked(operation === "update" ? inventoryCountService.updateItem : inventoryCountService.reload).mockReturnValueOnce(pending);
    const { rerender } = render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    const input = await screen.findByRole("spinbutton");
    if (operation === "update") { fireEvent.change(input, { target: { value: "7" } }); fireEvent.blur(input); }
    else fireEvent.click(screen.getByRole("button", { name: "Tải lại phiếu" }));
    if (operation === "reload") await waitFor(() => expect(inventoryCountService.reload).toHaveBeenCalledOnce());
    const oldScope = operation === "update" ? vi.mocked(inventoryCountService.updateItem).mock.calls[0][4] : vi.mocked(inventoryCountService.reload).mock.calls[0][1];
    expect(oldScope.isCurrent?.()).toBe(true);
    auth.userProfile.branchId = "new-branch";
    vi.mocked(inventoryCountService.list).mockResolvedValue([{ ...fixture, _id: "new", items: [{ ...fixture.items[0], countedQuantity: 20 }] }]);
    rerender(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    await waitFor(() => expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("20"));
    expect(oldScope.isCurrent?.()).toBe(false);
    await act(async () => complete({ ...fixture, items: [{ ...fixture.items[0], countedQuantity: 99 }] }));
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("20");
  });
  it("invalidates the captured queue scope and suppresses sync errors after closing", async () => {
    let fail!: (error: Error) => void;
    vi.mocked(inventoryCountService.syncPending).mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject; }));
    const { unmount } = render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    await screen.findByRole("spinbutton");
    const oldScope = vi.mocked(inventoryCountService.syncPending).mock.calls[0][0];
    unmount(); expect(oldScope.isCurrent?.()).toBe(false);
    await act(async () => fail(new Error("late error")));
    expect(toast.error).not.toHaveBeenCalled();
  });
  it("reports unowned legacy data without adopting it", async () => {
    vi.mocked(inventoryCountService.syncPending).mockResolvedValue({ remaining: 0, conflicts: 0, legacy: true });
    render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("chưa rõ tài khoản/chi nhánh")));
  });
});


it("refreshes the displayed version after pending synchronization", async () => {
  let finish!: (value: any) => void;
  vi.mocked(inventoryCountService.syncPending).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
  expect((await screen.findByRole("spinbutton") as HTMLInputElement).value).toBe("10");
  vi.mocked(inventoryCountService.list).mockResolvedValue([{ ...fixture, version: 4, items: [{ ...fixture.items[0], countedQuantity: 20 }] }]);
  await act(async () => finish({ remaining: 0, conflicts: 0, legacy: false }));
  await waitFor(() => expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("20"));
});
it("does not let the initial list response overwrite the post-sync snapshot", async () => {
  let finish!: (value: any) => void;
  vi.mocked(inventoryCountService.list).mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValue([{ ...fixture, version: 4, items: [{ ...fixture.items[0], countedQuantity: 20 }] }]);
  render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
  expect((await screen.findByRole("spinbutton") as HTMLInputElement).value).toBe("20");
  await act(async () => finish([fixture]));
  expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("20");
});

it("refreshes the selected count after explicit request reconciliation", async () => {
  render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
  expect((await screen.findByRole("spinbutton") as HTMLInputElement).value).toBe("10");
  vi.mocked(inventoryCountService.list).mockResolvedValue([{ ...fixture, version: 8, items: [{ ...fixture.items[0], countedQuantity: 18 }] }]);
  act(() => window.dispatchEvent(new Event("inventory-count-reconciled")));
  await waitFor(() => expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("18"));
});

it("invalidates an already-open scope when another tab replaces the login session before a request starts", async () => {
  const original = localStorage.getItem("accessToken");
  localStorage.setItem("accessToken", "original-session");
  try {
    render(<InventoryCountingModal warehouseId="w" onClose={() => {}} />);
    await screen.findByRole("spinbutton");
    const scope = vi.mocked(inventoryCountService.syncPending).mock.calls[0][0];
    expect(scope.isCurrent?.()).toBe(true);
    localStorage.setItem("accessToken", "another-account-session");
    expect(scope.isCurrent?.()).toBe(false);
  } finally { if (original === null) localStorage.removeItem("accessToken"); else localStorage.setItem("accessToken", original); }
});

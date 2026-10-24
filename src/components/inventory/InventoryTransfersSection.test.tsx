// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), listBalances: vi.fn(), canManage: false }));
vi.mock("../../modules/shared/lib/apiFetch", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("../../services/inventoryReceivingService", () => ({ inventoryReceivingService: { listBalances: mocks.listBalances } }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { role: "user", companyCode: "QA_EDU" }, hasPermission: (code: string) => code === "inventory:manage" && mocks.canManage }) }));
vi.mock("../../context/BranchContext", () => ({ useBranch: () => ({ activeBranchId: "hn", branches: [{ _id: "hn", name: "Hà Nội" }] }) }));
import { InventoryTransfersSection } from "./InventoryTransfersSection";

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
beforeEach(() => {
  mocks.canManage = false;
  mocks.listBalances.mockResolvedValue([]);
  mocks.apiFetch.mockImplementation(async (path: string) => path === "/inventory/transfers/warehouses"
    ? { data: [{ _id: "w1", branchId: "hn", name: "Kho Hà Nội" }, { _id: "w2", branchId: "hcm", name: "Kho Hồ Chí Minh" }] }
    : { data: [{ _id: "t1", code: "DC-01", status: "in_transit", fromBranchId: "hn", fromWarehouseId: "w1", toBranchId: "hcm", toWarehouseId: "w2", items: [{ sku: "PHONE-01", quantity: 1 }], reason: "Bổ sung tồn", createdAt: "2026-10-24" }] });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("inventory transfer surface", () => {
  it("shows transfer documents to a reader without mutation actions", async () => {
    render(<InventoryTransfersSection />);
    expect(await screen.findByText("DC-01")).toBeTruthy();
    expect(screen.getByText(/PHONE-01/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tạo phiếu điều chuyển" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hủy phiếu" })).toBeNull();
  });

  it("opens the transfer form in a popup for a manager", async () => {
    mocks.canManage = true;
    render(<InventoryTransfersSection />);
    await screen.findByText("DC-01");
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu điều chuyển" }));
    const dialog = screen.getByRole("dialog", { name: "Tạo phiếu điều chuyển" });
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(screen.getByText("Kho gửi")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Đóng phiếu điều chuyển" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Tạo phiếu điều chuyển" })).toBeNull());
  });
});

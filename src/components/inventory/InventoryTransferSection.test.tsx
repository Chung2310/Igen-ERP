// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InventoryTransferSection } from "./InventoryTransferSection";
import { inventoryTransferService } from "../../services/inventoryTransferService";
import { apiFetch } from "../../modules/shared/lib/apiFetch";

import { inventorySerialService } from "../../services/inventorySerialService";

vi.mock("../../services/inventoryTransferService", () => ({ inventoryTransferService: { destinations: vi.fn(), list: vi.fn(), create: vi.fn(), accept: vi.fn(), cancel: vi.fn() } }));
vi.mock("../../services/inventorySerialService", () => ({ inventorySerialService: { list: vi.fn() } }));
vi.mock("../../modules/shared/lib/apiFetch", () => ({ apiFetch: vi.fn() }));
vi.mock("../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const doc = { _id: "t1", transferCode: "CK-1", fromBranchId: "A", toBranchId: "B", fromWarehouseId: "WA", toWarehouseId: "WB", fromWarehouseName: "Source", toWarehouseName: "Target", status: "in_transit", items: [], reason: "Replenish", createdByName: "Sender", createdAt: "2026-09-29" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(inventoryTransferService.destinations).mockResolvedValue([
    { _id: "WA", branchId: "A", branchName: "Branch A", name: "Source", code: "WA", isDefault: false },
    { _id: "WB", branchId: "B", branchName: "Branch B", name: "Target", code: "WB", isDefault: true },
  ]);
  vi.mocked(inventoryTransferService.list).mockResolvedValue({ items: [doc], page: 1, limit: 20, total: 1 } as never);
  vi.mocked(inventorySerialService.list).mockResolvedValue({
    items: [
      { _id: "s1", serialNumber: "IMEI-PICK-1", internalBarcode: "BC-1", sku: "SKU", status: "in_stock" },
      { _id: "s2", serialNumber: "IMEI-PICK-2", internalBarcode: "BC-2", sku: "SKU", status: "in_stock" },
    ],
    total: 2,
    page: 1,
    limit: 100,
  } as never);
  vi.mocked(apiFetch).mockResolvedValue({ data: [{ _id: "balance", productId: "p", variantId: "v", sku: "SKU", productName: "Phone", quantity: 2, reservedQuantity: 0, trackingMode: "serial" }] });
});
afterEach(cleanup);
async function expand() { fireEvent.click(await screen.findByText(/CK-1/)); }
async function choose(label: string, option: string | RegExp) { fireEvent.click(screen.getByRole("button", { name: label })); fireEvent.click(await screen.findByRole("option", { name: option })); }

it("only allows the receiver to accept the full document", async () => {
  render(<InventoryTransferSection branchId="B" canManage />);
  await expand();
  expect(screen.queryByRole("button", { name: "Hủy chuyển" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Nhận đủ nguyên phiếu" }));
  await waitFor(() => expect(inventoryTransferService.accept).toHaveBeenCalledWith("B", "t1"));
});

it("only allows the sender to cancel, with an explicit reason", async () => {
  render(<InventoryTransferSection branchId="A" canManage />);
  await expand();
  expect(screen.queryByRole("button", { name: "Nhận đủ nguyên phiếu" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Hủy chuyển" }));
  fireEvent.change(screen.getByLabelText("Lý do hủy chuyển"), { target: { value: "Wrong destination" } });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" }));
  await waitFor(() => expect(inventoryTransferService.cancel).toHaveBeenCalledWith("A", "t1", "Wrong destination"));
});

it("hides write actions for read-only users", async () => {
  render(<InventoryTransferSection branchId="B" canManage={false} />);
  await expand();
  expect(screen.queryByRole("button", { name: "Tạo phiếu điều chuyển" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Nhận đủ nguyên phiếu" })).toBeNull();
});

it("retains the request key after a failed dispatch and uses the selected branch and warehouse", async () => {
  vi.mocked(inventoryTransferService.create).mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValueOnce(doc as never);
  render(<InventoryTransferSection branchId="A" canManage />);
  await screen.findByText(/CK-1/);
  fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu điều chuyển" }));
  await choose("Kho gửi", "Source");
  await choose("Kho nhận", "Branch B / Target");
  await choose("SKU 1", /SKU — Phone/);
  fireEvent.change(screen.getByLabelText("Mã máy 1"), { target: { value: "IMEI-1" } });
  fireEvent.change(screen.getByLabelText("Lý do điều chuyển"), { target: { value: "Replenish" } });
  fireEvent.click(screen.getByRole("button", { name: "Xuất chuyển kho" }));
  await waitFor(() => expect(inventoryTransferService.create).toHaveBeenCalledTimes(1));
  await waitFor(() => expect((screen.getByRole("button", { name: "Xuất chuyển kho" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Xuất chuyển kho" }));
  await waitFor(() => expect(inventoryTransferService.create).toHaveBeenCalledTimes(2));
  const calls = vi.mocked(inventoryTransferService.create).mock.calls;
  expect(calls[0]).toEqual(calls[1]);
  expect(calls[0][0]).toBe("A");
  expect(calls[0][1]).toMatchObject({ fromWarehouseId: "WA", toWarehouseId: "WB", toBranchId: "B", items: [{ variantId: "v", quantity: 1, unitIdentifiers: ["IMEI-1"] }] });
  expect(calls[0][1].idempotencyKey).toBeTruthy();
  expect(apiFetch).toHaveBeenCalledWith("/inventory/warehouses/balances", expect.objectContaining({ params: { warehouseId: "WA" }, headers: { "x-branch-id": "A" } }));
});

it("discards unfinished drafts and refetches on a branch-keyed remount", async () => {
  const view = render(<InventoryTransferSection key="A" branchId="A" canManage />);
  await screen.findByText(/CK-1/);
  fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu điều chuyển" }));
  expect(screen.getByRole("form", { name: "Tạo phiếu điều chuyển" })).toBeTruthy();
  view.rerender(<InventoryTransferSection key="B" branchId="B" canManage />);
  await screen.findByText(/CK-1/);
  expect(screen.queryByRole("form", { name: "Tạo phiếu điều chuyển" })).toBeNull();
  expect(inventoryTransferService.list).toHaveBeenLastCalledWith("B", 1, "", expect.any(AbortSignal), {});
});

it("allows selecting available IMEI units directly from warehouse for the selected SKU without manual typing", async () => {
  render(<InventoryTransferSection branchId="A" canManage />);
  await screen.findByText(/CK-1/);
  fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu điều chuyển" }));
  await choose("Kho gửi", "Source");
  await choose("Kho nhận", "Branch B / Target");
  await choose("SKU 1", /SKU — Phone/);

  // Verify that the available units for SKU are loaded and displayed as selectable chips
  const imeiChip = await screen.findByRole("button", { name: /IMEI-PICK-1/ });
  expect(imeiChip).toBeTruthy();

  // Click the chip to select it instead of typing
  fireEvent.click(imeiChip);

  // Verify textarea received the selected code
  const textarea = screen.getByLabelText("Mã máy 1") as HTMLTextAreaElement;
  expect(textarea.value).toContain("IMEI-PICK-1");

  // Fill reason and submit
  fireEvent.change(screen.getByLabelText("Lý do điều chuyển"), { target: { value: "Transfer selected" } });
  fireEvent.click(screen.getByRole("button", { name: "Xuất chuyển kho" }));

  await waitFor(() => expect(inventoryTransferService.create).toHaveBeenCalledTimes(1));
  expect(vi.mocked(inventoryTransferService.create).mock.calls[0][1]).toMatchObject({
    fromWarehouseId: "WA",
    toWarehouseId: "WB",
    items: [{ variantId: "v", unitIdentifiers: ["IMEI-PICK-1"] }],
  });
});

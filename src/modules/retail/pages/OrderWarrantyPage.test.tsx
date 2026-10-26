// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import OrderWarrantyPage from "./OrderWarrantyPage";
import { orderWarrantyService, type OrderWarrantyResult } from "../../../services/orderWarrantyService";

const context = vi.hoisted(() => ({ scope: { companyCode: "ERP", branchId: "MAIN" } }));
vi.mock("../hooks/useRetailScope", () => ({ useRetailScope: () => context }));
vi.mock("../../../services/orderWarrantyService", () => ({ orderWarrantyService: { list: vi.fn() } }));
const result = (productName = "Ghế văn phòng"): OrderWarrantyResult => ({ items: [{ id: "order:0", orderId: "order", orderCode: "DH1", customerName: "Khách An", productId: "chair", productName, sku: "CHAIR", quantity: 2, status: "active", warrantyMonths: 12, warrantyStartAt: "2026-01-01", warrantyEndAt: "2027-01-01" }], total: 1, page: 1, limit: 20 });
beforeEach(() => { vi.resetAllMocks(); context.scope = { companyCode: "ERP", branchId: "MAIN" }; vi.mocked(orderWarrantyService.list).mockResolvedValue(result()); });
afterEach(cleanup);

it("looks up sold products by order or customer without an identifier requirement", async () => {
  render(<OrderWarrantyPage />);
  expect(await screen.findByText("Ghế văn phòng")).toBeTruthy();
  expect(screen.queryByText(/IMEI|Serial|thiết bị/i)).toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: "Tìm bảo hành" }), { target: { value: "DH1" } });
  fireEvent.click(screen.getByRole("button", { name: "Tra cứu" }));
  await waitFor(() => expect(orderWarrantyService.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: "DH1", branchId: "MAIN", page: 1 }), expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole("button", { name: "Trạng thái" }));
  fireEvent.click(screen.getByRole("option", { name: "Hết bảo hành" }));
  await waitFor(() => expect(orderWarrantyService.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: "expired" }), expect.any(AbortSignal)));
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Trạng thái" }));
  fireEvent.keyDown(screen.getByRole("button", { name: "Ngưỡng sắp hết hạn" }), { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("option", { name: "60 ngày" }));
  await waitFor(() => expect(orderWarrantyService.list).toHaveBeenLastCalledWith(expect.objectContaining({ days: 60 }), expect.any(AbortSignal)));
});

it("clears old branch rows and ignores a late response after changing branches", async () => {
  let resolveOld!: (data: OrderWarrantyResult) => void;
  vi.mocked(orderWarrantyService.list).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  const view = render(<OrderWarrantyPage />);
  await waitFor(() => expect(orderWarrantyService.list).toHaveBeenCalledTimes(1));
  context.scope = { companyCode: "ERP", branchId: "OTHER" };
  view.rerender(<OrderWarrantyPage />);
  expect(await screen.findByText("Ghế văn phòng")).toBeTruthy();
  resolveOld(result("Sản phẩm chi nhánh cũ"));
  await waitFor(() => expect(screen.queryByText("Sản phẩm chi nhánh cũ")).toBeNull());
  expect(orderWarrantyService.list).toHaveBeenLastCalledWith(expect.objectContaining({ branchId: "OTHER" }), expect.any(AbortSignal));
});

it("shows an actionable error and retries the same query", async () => {
  vi.mocked(orderWarrantyService.list).mockRejectedValueOnce(new Error("Không tải được bảo hành"));
  render(<OrderWarrantyPage />);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Không tải được bảo hành"));
  fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  expect(await screen.findByText("Ghế văn phòng")).toBeTruthy();
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RetailReturnsPage from "./RetailReturnsPage";

const { list } = vi.hoisted(() => ({ list: vi.fn() }));
const scope = { companyCode: "ACME", branchId: "B1" };

vi.mock("../api/retailAfterSales.api", () => ({ retailAfterSalesApi: { list } }));
vi.mock("../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope }) }));

const afterSale = {
  _id: "a1",
  code: "TH-001",
  type: "return" as const,
  orderId: "o1",
  orderCode: "DH-001",
  customerName: "Nguyễn An",
  items: [{ orderLineIndex: 0, quantity: 1, condition: "good" as const, sku: "PHONE-1", productName: "Điện thoại mẫu", lineAmount: 2_000_000 }],
  totalAmount: 2_000_000,
  paymentMethod: "cash" as const,
  reason: "Lỗi sản phẩm",
  businessDate: "2026-10-24",
  createdAt: "2026-10-24T08:00:00.000Z",
};

describe("RetailReturnsPage", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    list.mockReset();
    list.mockResolvedValue({ items: [afterSale], total: 1, page: 1, limit: 20 });
  });

  it("shows after-sale documents and their source order", async () => {
    render(<RetailReturnsPage />);

    expect(await screen.findByRole("table", { name: "Danh sách phiếu đổi trả và thu mua" })).toBeTruthy();
    expect(screen.getByRole("region", { name: /Bảng phiếu đổi trả, cuộn ngang/ }).className).toContain("visible-scrollbar");
    expect(screen.getByRole("columnheader", { name: "Mã phiếu" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Tổng tiền" })).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "TH-001" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: /DH-001/ })).toBeTruthy();
    const detailsButton = screen.getByRole("button", { name: "Chi tiết 1 mặt hàng và lý do" });
    expect(detailsButton.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(detailsButton);
    expect(detailsButton.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("row", { name: /Điện thoại mẫu/ })).toBeTruthy();
  });

  it("sends search and type filters to the paged list API", async () => {
    render(<RetailReturnsPage />);
    await screen.findByText("TH-001");
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm chứng từ" }), { target: { value: "PHONE-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Loại phiếu" }));
    fireEvent.click(screen.getByRole("option", { name: "Khách trả hàng" }));

    await waitFor(() => expect(list).toHaveBeenLastCalledWith(scope, expect.objectContaining({ q: "PHONE-1", type: "return", page: "1", limit: "20" })));
  });
});

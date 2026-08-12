// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CheckoutSuccessDialog from "./CheckoutSuccessDialog";
import ReceiptPrintView from "./ReceiptPrintView";
import type { RetailOrderResult } from "../../types";

afterEach(cleanup);

const result: RetailOrderResult = {
  order: { _id: "o1", orderCode: "DH-CN01-1", status: "completed", paymentStatus: "paid", items: [], subtotal: 90_000, orderDiscount: 5_000, taxRate: 8, taxAmount: 6_800, shippingFee: 20_000, grandTotal: 111_800, paidAmount: 111_800, dueAmount: 0, version: 1, createdBy: "u1", createdByName: "Thu ngân" },
  invoice: { _id: "i1", invoiceNo: "HD-CN01-1", orderId: "o1", orderCode: "DH-CN01-1", issuedAt: "2026-08-10T08:00:00.000Z", status: "issued", snapshot: { store: { legalName: "Công ty Igen", storeName: "Cửa hàng Igen", branchCode: "CN01", branchName: "Chi nhánh 1", branchAddress: "1 Nguyễn Huệ", branchPhone: "0901" }, customerName: "Nguyễn Văn A", customerPhone: "0901", cashierName: "Thu ngân", businessDate: "2026-08-10", items: [{ productId: "p1", sku: "SKU-1", productName: "Áo", unit: "cái", quantity: 1, unitPrice: 100_000, discountAmount: 10_000, lineTotal: 90_000 }], subtotal: 90_000, orderDiscount: 5_000, taxRate: 8, taxAmount: 6_800, shippingFee: 20_000, grandTotal: 111_800, payments: [{ method: "cash", amount: 111_800, tenderedAmount: 120_000, changeAmount: 8_200 }], amountInWords: "111.800 đồng" } },
};

describe("retail receipt", () => {
  it("renders printable invoice snapshot without cost data", () => {
    render(<ReceiptPrintView invoice={result.invoice} />);
    expect(screen.getByText("HD-CN01-1")).toBeTruthy();
    expect(screen.getByText("Cửa hàng Igen")).toBeTruthy();
    expect(screen.getByText("1 Nguyễn Huệ")).toBeTruthy();
    expect(screen.getByText("Nguyễn Văn A")).toBeTruthy();
    expect(screen.getByText("Phí vận chuyển")).toBeTruthy();
    expect(screen.queryByText(/giá vốn/i)).toBeNull();
  });

  it("prints the completed invoice and can start a new order", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const onNewOrder = vi.fn();
    render(<CheckoutSuccessDialog result={result} onNewOrder={onNewOrder} onClose={() => undefined} />);
    expect(screen.getByText("DH-CN01-1")).toBeTruthy();
    expect(screen.getByText("HD-CN01-1")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "In hóa đơn" }));
    expect(print).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Đơn mới" }));
    expect(onNewOrder).toHaveBeenCalledOnce();
  });
});

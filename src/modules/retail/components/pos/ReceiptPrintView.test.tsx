// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CheckoutSuccessDialog from "./CheckoutSuccessDialog";
import ReceiptPrintView from "./ReceiptPrintView";
import ReceiptPrintViewSerial from "./ReceiptPrintViewSerial";
import type { RetailOrderResult } from "../../types";

afterEach(cleanup);

const result: RetailOrderResult = {
  order: { _id: "o1", orderCode: "DH-CN01-1", status: "completed", paymentStatus: "paid", items: [], subtotal: 90_000, orderDiscount: 5_000, taxRate: 8, taxAmount: 6_800, shippingFee: 20_000, grandTotal: 111_800, paidAmount: 111_800, dueAmount: 0, version: 1, createdBy: "u1", createdByName: "Thu ngân" },
  invoice: { _id: "i1", invoiceNo: "HD-CN01-1", orderId: "o1", orderCode: "DH-CN01-1", issuedAt: "2026-08-10T08:00:00.000Z", status: "issued", snapshot: { store: { legalName: "Công ty Igen", storeName: "Cửa hàng Igen", branchCode: "CN01", branchName: "Chi nhánh 1", branchAddress: "1 Nguyễn Huệ", branchPhone: "0901" }, customerName: "Nguyễn Văn A", customerPhone: "0901", cashierName: "Thu ngân", businessDate: "2026-08-10", items: [{ productId: "p1", sku: "SKU-1", productName: "Áo", unit: "cái", quantity: 1, unitPrice: 100_000, discountAmount: 10_000, lineTotal: 90_000 }], subtotal: 90_000, orderDiscount: 5_000, taxRate: 8, taxAmount: 6_800, shippingFee: 20_000, grandTotal: 111_800, payments: [{ method: "cash", amount: 111_800, tenderedAmount: 120_000, changeAmount: 8_200 }], amountInWords: "111.800 đồng" } },
};

describe("retail receipt", () => {
  it.each(["58mm", "80mm", "A5", "A4"] as const)("keeps full product and serial data on %s receipts", (paperSize) => {
    const items = Array.from({ length: 25 }, (_, index) => ({ ...result.invoice.snapshot.items[0], productId: "p" + index, productName: "Thiết bị " + index + " " + "MODEL".repeat(40), quantity: index + 1, serialNumbers: ["SERIAL".repeat(40) + index] }));
    const invoice = { ...result.invoice, snapshot: { ...result.invoice.snapshot, customerName: "Khách hàng " + "NAME".repeat(50), items } };
    render(<ReceiptPrintViewSerial invoice={invoice} paperSize={paperSize} />);
    expect(screen.getByText(items[24].productName)).toBeTruthy();
    expect(screen.getByText("IMEI: " + items[24].serialNumbers[0])).toBeTruthy();
    expect(screen.getByText("25", { selector: "td" })).toBeTruthy();
    expect(screen.getByText("Khách hàng: " + invoice.snapshot.customerName)).toBeTruthy();
    expect(screen.getByText("Tổng cộng")).toBeTruthy();
    expect(screen.getByText("Tiền thừa")).toBeTruthy();
  });

  it("renders printable invoice snapshot without cost data", () => {
    render(<ReceiptPrintView invoice={result.invoice} />);
    expect(screen.getAllByText("HD-CN01-1").length).toBeGreaterThan(0);
    expect(screen.getByText("Cửa hàng Igen")).toBeTruthy();
    expect(screen.getByText("1 Nguyễn Huệ")).toBeTruthy();
    expect(screen.getByText("Nguyễn Văn A")).toBeTruthy();
    expect(screen.getByText("Phí vận chuyển")).toBeTruthy();
    expect(screen.queryByText(/giá vốn/i)).toBeNull();
  });

  it("shows full debt when an invoice has no payment", () => {
    render(<ReceiptPrintView invoice={{ ...result.invoice, snapshot: { ...result.invoice.snapshot, payments: [], paidAmount: 0, dueAmount: result.invoice.snapshot.grandTotal, paymentStatus: "unpaid" } }} />);
    expect(screen.getByText("Ghi nợ toàn bộ")).toBeTruthy();
    expect(screen.getAllByText("111.800 ₫").length).toBeGreaterThan(1);
  });

  it("shows the completed invoice and starts a new order without a duplicate POS print action", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const onNewOrder = vi.fn();
    render(<CheckoutSuccessDialog result={result} onNewOrder={onNewOrder} onClose={() => undefined} />);
    expect(screen.getByText("DH-CN01-1")).toBeTruthy();
    expect(screen.getAllByText("HD-CN01-1").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "In hóa đơn" })).toBeNull();
    expect(print).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Đơn mới" }));
    expect(onNewOrder).toHaveBeenCalledOnce();
  });
});

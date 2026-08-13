// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailInvoicesApi } from "../api/retailInvoices.api";
import RetailInvoicesPage from "./RetailInvoicesPageContent";

vi.mock("../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "ACME", branchId: "B1" } }) }));
vi.mock("../api/retailInvoices.api", () => ({ retailInvoicesApi: { list: vi.fn(), detail: vi.fn(), downloadPdf: vi.fn() } }));

const invoice: any = {
  _id: "i1", invoiceNo: "HD-01", orderId: "o1", orderCode: "DH-01", issuedAt: "2026-08-12T01:00:00Z", status: "issued",
  snapshot: { store: { legalName: "Công ty Igen", storeName: "Igen Store", branchCode: "HCM", branchName: "Chi nhánh HCM", branchAddress: "1 Nguyễn Huệ" }, customerName: "Nguyễn Văn A", cashierName: "Thu ngân A", items: [], subtotal: 100_000, orderDiscount: 0, taxRate: 0, taxAmount: 0, shippingFee: 0, grandTotal: 100_000, paidAmount: 40_000, dueAmount: 60_000, paymentStatus: "partial", payments: [{ method: "transfer", amount: 40_000 }], amountInWords: "Một trăm nghìn đồng" },
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(retailInvoicesApi.list).mockResolvedValue({ items: [invoice], total: 1, page: 1, limit: 20 });
  vi.mocked(retailInvoicesApi.detail).mockResolvedValue(invoice);
  vi.mocked(retailInvoicesApi.downloadPdf).mockResolvedValue(undefined);
});

describe("RetailInvoicesPage", () => {
  it("reprints and downloads from the invoice list without issuing a new invoice", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<RetailInvoicesPage />);
    await screen.findByText("HD-01");
    await userEvent.click(screen.getByRole("button", { name: "In lại hóa đơn HD-01" }));
    await waitFor(() => expect(retailInvoicesApi.detail).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, "i1"));
    expect(print).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Tải PDF hóa đơn HD-01" }));
    await waitFor(() => expect(retailInvoicesApi.downloadPdf).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, "i1"));
  });

  it("shows cashier and localized partial payment details", async () => {
    render(<RetailInvoicesPage />);
    expect(await screen.findByText(/Thanh toán một phần · Đã thanh toán 40\.000 ₫ · Còn nợ 60\.000 ₫/)).toBeTruthy();
    await userEvent.click(await screen.findByRole("button", { name: "Xem hóa đơn HD-01" }));
    expect(await screen.findByText("Thu ngân A")).toBeTruthy();
    expect(screen.getAllByText("Chuyển khoản").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Còn nợ").length).toBeGreaterThan(0);
  });
});

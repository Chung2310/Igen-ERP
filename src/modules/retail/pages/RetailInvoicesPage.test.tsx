// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailInvoicesApi } from "../api/retailInvoices.api";
import type { RetailInvoice } from "../types";
import RetailInvoicesPage from "./RetailInvoicesPageContent";

vi.mock("../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "ACME", branchId: "B1" }, userProfile: { permissions: ["retail:manage"] } }) }));
vi.mock("../api/retailInvoices.api", () => ({ retailInvoicesApi: { list: vi.fn(), detail: vi.fn(), reprint: vi.fn(), downloadPdf: vi.fn(), downloadBulkPdf: vi.fn() } }));

const invoice: RetailInvoice = {
  _id: "i1", invoiceNo: "HD-01", orderId: "o1", orderCode: "DH-01", issuedAt: "2026-08-12T01:00:00Z", status: "issued",
  snapshot: { store: { legalName: "Công ty Igen", storeName: "Igen Store", branchCode: "HCM", branchName: "Chi nhánh HCM", branchAddress: "1 Nguyễn Huệ" }, customerName: "Nguyễn Văn A", cashierName: "Thu ngân A", items: [], subtotal: 100_000, orderDiscount: 0, taxRate: 0, taxAmount: 0, shippingFee: 0, grandTotal: 100_000, paidAmount: 40_000, dueAmount: 60_000, paymentStatus: "partial", payments: [{ method: "transfer", amount: 40_000 }], amountInWords: "Một trăm nghìn đồng" },
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(retailInvoicesApi.list).mockResolvedValue({ items: [invoice], total: 1, page: 1, limit: 20 });
  vi.mocked(retailInvoicesApi.detail).mockResolvedValue(invoice);
  vi.mocked(retailInvoicesApi.reprint).mockResolvedValue(invoice);
  vi.mocked(retailInvoicesApi.downloadPdf).mockResolvedValue(undefined);
  vi.mocked(retailInvoicesApi.downloadBulkPdf).mockResolvedValue(undefined);
});

describe("RetailInvoicesPage", () => {
  it("reprints and downloads from the invoice list without issuing a new invoice", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<RetailInvoicesPage />);
    await screen.findByText("HD-01");
    await userEvent.click(screen.getByRole("button", { name: "In lại hóa đơn HD-01" }));
    await waitFor(() => expect(retailInvoicesApi.reprint).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, "i1"));
    await waitFor(() => expect(print).toHaveBeenCalledOnce());
    expect(retailInvoicesApi.detail).not.toHaveBeenCalled();
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

  it("supports selecting invoices and exporting bulk reconciliation PDF", async () => {
    render(<RetailInvoicesPage />);
    await screen.findByText("HD-01");
    const checkbox = screen.getByRole("checkbox", { name: "Chọn hóa đơn HD-01" });
    await userEvent.click(checkbox);
    const bulkButton = await screen.findByRole("button", { name: "Xuất PDF chuỗi bill (1)" });
    await userEvent.click(bulkButton);
    await waitFor(() => expect(retailInvoicesApi.downloadBulkPdf).toHaveBeenCalledWith(
      { companyCode: "ACME", branchId: "B1" },
      { ids: ["i1"], paperSize: "A4" },
    ));
  });

  it("keeps long identifiers and every invoice line readable while retaining header actions", async () => {
    const longInvoice = {
      ...invoice,
      invoiceNo: "HD-" + "202610-MAIN-".repeat(24),
      orderCode: "DH-" + "REFERENCE".repeat(24),
      snapshot: {
        ...invoice.snapshot,
        customerName: "Công ty khách hàng " + "tên đầy đủ ".repeat(30),
        salespersonName: "Nhân viên " + "phụ trách ".repeat(30),
        items: Array.from({ length: 40 }, (_, index) => ({
          productId: "p" + index,
          sku: "SKU" + index,
          productName: "Thiết bị " + index + " " + "MODEL".repeat(40),
          quantity: 1,
          unitPrice: 1000,
          discountAmount: 0,
          lineTotal: 1000,
          unit: "cái",
          serialNumbers: ["SERIAL".repeat(60) + index],
        })),
      },
    };
    vi.mocked(retailInvoicesApi.list).mockResolvedValue({ items: [longInvoice as unknown as RetailInvoice], total: 1, page: 1, limit: 20 });
    vi.mocked(retailInvoicesApi.detail).mockResolvedValue(longInvoice as unknown as RetailInvoice);
    render(<RetailInvoicesPage />);
    const open = await screen.findByRole("button", { name: "Xem hóa đơn " + longInvoice.invoiceNo });
    await userEvent.click(open);
    const dialog = within(await screen.findByRole("dialog", { name: "Hóa đơn" }));
    const content = within(dialog.getByRole("region", { name: "Nội dung hóa đơn" }));
    expect(content.getByText(longInvoice.invoiceNo)).toBeTruthy();
    expect(content.getByText(longInvoice.orderCode)).toBeTruthy();
    expect(content.getByText(longInvoice.snapshot.customerName.trim())).toBeTruthy();
    expect(content.getByText(longInvoice.snapshot.salespersonName.trim())).toBeTruthy();
    expect(content.getByText(longInvoice.snapshot.items[39].productName + " × 1")).toBeTruthy();
    const lastSerialDetails = content.getAllByText("S/N: 1 mã")[39].closest("details");
    expect(lastSerialDetails?.open).toBe(false);
    await userEvent.click(content.getAllByText("S/N: 1 mã")[39]);
    expect(lastSerialDetails?.open).toBe(true);
    expect(content.getByText("S/N: " + longInvoice.snapshot.items[39].serialNumbers[0])).toBeTruthy();
    const pdf = dialog.getByRole("button", { name: "Tải bản in lại PDF" });
    expect(content.queryByRole("button", { name: "Tải bản in lại PDF" })).toBeNull();
    await userEvent.click(pdf);
    await waitFor(() => expect(retailInvoicesApi.downloadPdf).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, "i1"));
    await userEvent.click(dialog.getByRole("button", { name: "Đóng hóa đơn" }));
    expect(screen.queryByRole("dialog", { name: "Hóa đơn" })).toBeNull();
  });
});

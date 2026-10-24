// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import FinancialReportsPage from "./FinancialReportsPage";
import { financialReportRequest } from "../api/financialReporting.api";
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { companyCode: "ACME", role: "admin" } }) }));
vi.mock("../../../context/BranchContext", () => ({ useBranchOptional: () => ({ activeBranchId: "B1", activeBranch: { name: "Hà Nội" } }) }));
vi.mock("../api/financialReporting.api", () => ({ financialReportRequest: vi.fn() }));
const debt = { asOf: "2026-09-23", totals: { receivable: 100, overdueReceivable: 100, payable: 200, upcomingPayable: 200 }, aging: {}, items: [{ id: "debt1", source: "manual", direction: "payable", partyKind: "supplier", partyName: "NCC A", reference: "PN1", balance: 200, dueOn: "2026-09-25", bucket: "notDue", alert: true, version: 2 }], unrecordedReceipts: [] };
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); vi.mocked(financialReportRequest).mockResolvedValue(debt); });
it("shows supplier due dates and hides writing actions for read-only users", async () => {
  render(<FinancialReportsPage permissions={["finance-wallet:read"]} />);
  expect(await screen.findByText("NCC A")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Ghi nhận nợ" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Thanh toán" })).toBeNull();
  await userEvent.selectOptions(screen.getByLabelText("Cảnh báo NCC trước hạn"), "3");
  await waitFor(() => expect(financialReportRequest).toHaveBeenLastCalledWith("/debts", { companyCode: "ACME", branchId: "B1", warningDays: "3" }, "GET", undefined, expect.any(AbortSignal)));
});
it("records payment in a dialog with a stable key and expected version", async () => {
  render(<FinancialReportsPage permissions={["*"]} />);
  await userEvent.click(await screen.findByRole("button", { name: "Thanh toán" }));
  expect(screen.getByRole("dialog", { name: "Ghi nhận thanh toán NCC" })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(financialReportRequest).toHaveBeenCalledWith("/debts/debt1/payments", { companyCode: "ACME", branchId: "B1" }, "POST", expect.objectContaining({ amount: 200, version: 2, key: expect.any(String) })));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("shows signed losses and switches profit report to a custom date range", async () => {
  vi.mocked(financialReportRequest).mockImplementation(async path => path === "/profit" ? { range: { from: "2026-09-01", to: "2026-09-23" }, totals: { revenue: 16500000, costOfGoods: 18000000, grossProfit: -1500000, netProfit: -1500000 }, lossSales: [{ date: "2026-09-01", code: "LOSS1", revenue: 16500000, cost: 18000000, grossProfit: -1500000 }], movements: [], warnings: [] } : debt);
  render(<FinancialReportsPage permissions={["*"]} />);
  await userEvent.click(screen.getByRole("button", { name: "Lãi lỗ / Xả lỗ" }));
  expect(await screen.findByText("LOSS1")).toBeTruthy();
  expect(screen.getAllByText("-1.500.000 ₫").length).toBeGreaterThan(0);
  await userEvent.selectOptions(screen.getByLabelText("Kỳ báo cáo"), "custom");
  await waitFor(() => expect(financialReportRequest).toHaveBeenLastCalledWith("/profit", expect.objectContaining({ from: expect.any(String), to: expect.any(String) }), "GET", undefined, expect.any(AbortSignal)));
});
it("shows VAT credit confirmation and includes prior invoices in the adjustment picker", async () => {
  vi.mocked(financialReportRequest).mockImplementation(async path => path === "/vat" ? { totals: {}, settings: { period: "2026-09", version: 0, openingCredit: 0 }, items: [], adjustmentOptions: [{ _id: "i1", issuedOn: "2026-08-01", series: "A", invoiceNumber: "001", partyName: "NCC cũ" }] } : debt);
  render(<FinancialReportsPage permissions={["*"]} />);
  await userEvent.click(screen.getByRole("button", { name: "Thuế VAT" }));
  expect(await screen.findByText(/chưa xác nhận/)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Thêm hóa đơn" }));
  expect(screen.getByRole("option", { name: /NCC cũ/ })).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
});

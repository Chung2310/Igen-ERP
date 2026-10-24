// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import FinancialManagementPage from "./FinancialManagementPage";
import { financeManagement } from "../api/financeManagement.api";
vi.mock("../api/financeManagement.api", () => ({ financeManagement: vi.fn() }));
const report = { summary: { cashIn: 1000, cashOut: 400, expense: 400 }, cash: [{ code: "PT-1", date: "2026-09-23", kind: "receipt", category: "retail", amount: 1000, method: "cash" }, { code: "PC-1", date: "2026-09-23", kind: "payment", category: "rent", amount: 400, method: "transfer" }], warnings: ["Dữ liệu trong chi nhánh đang chọn"], lines: [] };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(financeManagement).mockResolvedValue(report); });
afterEach(cleanup);
describe("Finance management screens", () => {
  it("shows actual receipts and payments from the API and applies date filters", async () => { render(<FinancialManagementPage view="cash" />); expect(await screen.findByText("PT-1")).toBeTruthy(); expect(screen.getByText("PC-1")).toBeTruthy(); fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2026-09-01" } }); await vi.waitFor(() => expect(vi.mocked(financeManagement).mock.calls.some(c => c[0].includes("from=2026-09-01"))).toBe(true)); });
  it("preserves the form and retry key on a failed submission", async () => {
    render(<FinancialManagementPage view="cash" />); await screen.findByText("PT-1"); fireEvent.click(screen.getByText("Tạo phiếu thu / chi")); fireEvent.change(screen.getByLabelText("Số tiền (VND)"), { target: { value: "300" } });
    vi.mocked(financeManagement).mockRejectedValueOnce(new Error("Vui lòng thử lại.")); fireEvent.click(screen.getByRole("button", { name: "Lưu" })); expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Vui lòng thử lại."); const first = vi.mocked(financeManagement).mock.calls.find(c => c[0] === "/vouchers")?.[1] as any; expect(first.amount).toBe(300); expect(first.expenseClass).toBe("fixed"); fireEvent.click(screen.getByRole("button", { name: "Lưu" })); await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull()); const attempts = vi.mocked(financeManagement).mock.calls.filter(c => c[0] === "/vouchers"); expect((attempts[1][1] as any).idempotencyKey).toBe(first.idempotencyKey);
  });
  it("does not display invented zero totals after an API failure", async () => { vi.mocked(financeManagement).mockRejectedValue(new Error("Bạn chưa được cấp quyền thực hiện nghiệp vụ tài chính này.")); render(<FinancialManagementPage view="cash" />); expect(await screen.findByRole("alert")).toBeTruthy(); expect(screen.queryByText("Tổng thu thực tế")).toBeNull(); });
});

it("does not turn unknown cost into profit while grouping products", async () => {
  vi.mocked(financeManagement).mockResolvedValue({ ...report, summary: { revenue: 500, cost: null, grossProfit: null, netProfit: null, missingCostCount: 1 }, expenses: [], inventory: [], lines: [{ productName: "Phone", quantity: 1, revenue: 200, cost: 100, grossProfit: 100 }, { productName: "Phone", quantity: 1, revenue: 300, cost: null, grossProfit: null }] });
  render(<FinancialManagementPage view="profit" />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getAllByText("Chưa có dữ liệu").length).toBeGreaterThanOrEqual(5);
  const row = screen.getByText("Phone").closest("tr");
  expect(row?.textContent).toContain("Chưa có dữ liệu");
});

it("opens a reversal form only for original Finance vouchers and submits a reason", async()=>{
 vi.mocked(financeManagement).mockResolvedValue({...report,cash:[{...report.cash[1],_id:"v1",source:"finance"}]});
 render(<FinancialManagementPage view="cash"/>);
 fireEvent.click(await screen.findByText("Đảo phiếu"));
 fireEvent.change(screen.getByLabelText("Lý do đảo phiếu"),{target:{value:"Nhập nhầm số tiền"}});
 fireEvent.click(screen.getByRole("button",{name:"Lưu"}));
 await vi.waitFor(()=>expect(vi.mocked(financeManagement).mock.calls.some(c=>c[0]==="/vouchers/v1/reversal" && (c[1] as any).reason==="Nhập nhầm số tiền")).toBe(true));
});

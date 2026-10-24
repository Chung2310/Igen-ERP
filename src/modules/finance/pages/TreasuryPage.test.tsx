// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TreasuryPage from "./TreasuryPage";
import { financialReportRequest } from "../api/financialReporting.api";
const branch = vi.hoisted(() => ({ activeBranchId: "B1", activeBranch: { name: "Hà Nội" } }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { companyCode: "ACME" } }) }));
vi.mock("../../../context/BranchContext", () => ({ useBranchOptional: () => branch }));
vi.mock("../api/financialReporting.api", () => ({ financialReportRequest: vi.fn() }));
const data = { accounts: [{ _id: "a1", name: "Quỹ chính", kind: "cash", openingOn: "2026-01-01", openingBalance: 1000, balance: 1000, version: 3 }], vouchers: [{ _id: "v1", kind: "payment", description: "Thuê nhà", accountId: "a1", amount: 100, occurredOn: "2026-01-10", status: "pending", version: 0 }], balance: 1000, forecast: [{ date: "2026-01-10", incoming: 0, outgoing: 2000, projected: -1000, conservative: -1000, references: ["NCC1"] }], unassigned: [], unscheduledDebt: [], unrecordedReceipts: [], debts: [], bankLines: [], reconciliations: [], periods: [], forecastNote: "Dự báo theo hạn trả" };
afterEach(cleanup);
beforeEach(() => { branch.activeBranchId = "B1"; vi.resetAllMocks(); vi.mocked(financialReportRequest).mockResolvedValue(data); });
it("shows cash deficit and keeps all mutation actions hidden for readers", async () => {
  render(<TreasuryPage permissions={["finance-wallet:read"]} />);
  expect(await screen.findByText("Quỹ chính")).toBeTruthy(); expect(screen.queryByRole("button", { name: "Tạo quỹ" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Phiếu thu / chi" })); expect(screen.queryByRole("button", { name: "Duyệt" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Dự báo" })); expect(screen.getAllByText("-1.000 ₫").length).toBeGreaterThan(0);
  await userEvent.selectOptions(screen.getByLabelText("Số ngày dự báo"), "7");
  await waitFor(() => expect(financialReportRequest).toHaveBeenCalledWith("/treasury", { companyCode: "ACME", branchId: "B1", days: "7" }, "GET", undefined, expect.any(AbortSignal)));
});
it("reviews a pending voucher in a dialog before posting its version", async () => {
  render(<TreasuryPage permissions={["finance-wallet:manage"]} />); await screen.findByText("Quỹ chính");
  await userEvent.click(screen.getByRole("button", { name: "Phiếu thu / chi" })); await userEvent.click(screen.getByRole("button", { name: "Duyệt" }));
  expect(screen.getByRole("dialog", { name: "Duyệt ghi sổ" })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(financialReportRequest).toHaveBeenCalledWith("/treasury/vouchers/v1/decision", { companyCode: "ACME", branchId: "B1" }, "POST", { action: "approve", version: 0 }));
});
it("closes branch-specific entry dialogs when switching branch", async () => {
  const view = render(<TreasuryPage permissions={["*"]} />); await userEvent.click(await screen.findByRole("button", { name: "Tạo quỹ" })); expect(screen.getByRole("dialog")).toBeTruthy();
  branch.activeBranchId = "B2"; view.rerender(<TreasuryPage permissions={["*"]} />); expect(screen.queryByRole("dialog")).toBeNull();
  await waitFor(() => expect(financialReportRequest).toHaveBeenCalledWith("/treasury", { companyCode: "ACME", branchId: "B2", days: "30" }, "GET", undefined, expect.any(AbortSignal)));
});

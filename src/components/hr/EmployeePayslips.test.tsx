// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EmployeePayslips from "./EmployeePayslips";

const mocks = vi.hoisted(() => ({ getPayslips: vi.fn(), getReviews: vi.fn(), requestReview: vi.fn() }));
vi.mock("../../services/payrollService", () => ({ payrollService: {
  getEmployeePayslips: mocks.getPayslips,
  getMyPayslipReviews: mocks.getReviews,
  requestPayslipReview: mocks.requestReview,
} }));
vi.mock("./payroll/EmployeePayrollReconciliation", () => ({ EmployeePayrollReconciliation: () => null }));
vi.mock("./payroll/PayslipReviewMessageDialog", () => ({ PayslipReviewMessageDialog: ({ onSubmit }: { onSubmit: (message: string) => Promise<void> }) => <button type="button" onClick={() => void onSubmit("Thiếu phụ cấp")}>Xác nhận gửi</button> }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getPayslips.mockResolvedValue([{ runId: "run-1", employeeId: "e1", periodKey: "2026-09", netPay: 1000, paidAmount: 0, balance: 1000 }]);
  mocks.getReviews.mockResolvedValue([]);
  mocks.requestReview.mockResolvedValue({ id: "request-1", runId: "run-1", employeeId: "e1", periodKey: "2026-09", message: "Thiếu phụ cấp", status: "open" });
});

describe("employee published payslip reviews", () => {
  it("lets an employee request a check after the payslip is published and shows the pending state", async () => {
    render(<EmployeePayslips />);
    fireEvent.click(await screen.findByRole("button", { name: "Yêu cầu kiểm tra lại lương" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận gửi" }));
    await waitFor(() => expect(mocks.requestReview).toHaveBeenCalledWith("run-1", "Thiếu phụ cấp"));
    expect(await screen.findByText("Đang chờ kiểm tra lại lương")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Đang chờ phản hồi" }).hasAttribute("disabled")).toBe(true);
  });
});

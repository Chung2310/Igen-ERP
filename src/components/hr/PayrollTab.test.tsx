// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import PayrollTab from "./PayrollTab";

const getRun = vi.hoisted(() => vi.fn());
const getResults = vi.hoisted(() => vi.fn());
const getAdjustments = vi.hoisted(() => vi.fn());
const getPeriodInputs = vi.hoisted(() => vi.fn());
const getPolicies = vi.hoisted(() => vi.fn());
const bulkSavePeriodInputs = vi.hoisted(() => vi.fn());
const calculate = vi.hoisted(() => vi.fn());

vi.mock("../../services/payrollService", () => ({
  payrollService: { getRun, getResults, getAdjustments, getPeriodInputs, getPolicies, bulkSavePeriodInputs, calculate },
}));
vi.mock("../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("./payroll/PayrollPolicyManager", () => ({ PayrollPolicyManager: () => null }));
vi.mock("./payroll/PayrollFormulaLibrary", () => ({ PayrollFormulaLibrary: () => <div>formula-library-entry-point</div> }));
vi.mock("./payroll/PayrollCustomVariableManager", () => ({ PayrollCustomVariableManager: () => null }));
vi.mock("./payroll/PayrollReviewQueue", () => ({ PayrollReviewQueue: () => null }));
vi.mock("./payroll/PayrollPayslipsPanel", () => ({ PayrollPayslipsPanel: () => null }));
vi.mock("./payroll/PayrollReopenModal", () => ({ PayrollReopenModal: () => null }));

const employee = {
  employeeId: "employee-1",
  employeeName: "Nguyễn Văn A",
  monthlySalary: 12_000_000,
  workedDays: 21.5,
  workedMinutes: 10_320,
  shortageMinutes: 0,
  status: "draft",
  calculation: { allowances: 1_000_000, bonuses: 250_000, otherDeductions: 50_000 },
};

const periodInputResponse = {
  items: [{ employeeId: employee.employeeId, version: 1 }],
  variables: [],
  editable: true,
  needsRefresh: false,
};

function mockPayrollResponses(run: unknown = null) {
  getRun.mockResolvedValue(run);
  getResults.mockResolvedValue([employee]);
  getAdjustments.mockResolvedValue([]);
  getPeriodInputs.mockResolvedValue(periodInputResponse);
  getPolicies.mockResolvedValue([]);
  bulkSavePeriodInputs.mockResolvedValue([]);
  calculate.mockResolvedValue(undefined);
}

function employeeField(field: string) {
  return `${field}-${employee.employeeId}`;
}

const fixedInputFields = ["agreedSalary", "reconciledDays", "reconciledHours", "allowance", "bonus", "deduction"];

describe("PayrollTab formula library feature flag", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("does not render the formula library entry point when disabled", () => {
    mockPayrollResponses();
    render(<PayrollTab canManage />);

    expect(screen.queryByText("formula-library-entry-point")).toBeNull();
  });
});

describe("PayrollTab inline period inputs", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("shows enabled fixed inputs for an employee in a manager's draft payroll and tracks one dirty employee", async () => {
    mockPayrollResponses();
    const user = userEvent.setup();

    render(<PayrollTab canManage />);

    const agreedSalary = await screen.findByLabelText(employeeField("agreedSalary"));
    const reconciledDays = screen.getByLabelText(employeeField("reconciledDays"));
    const bonus = screen.getByLabelText(employeeField("bonus"));

    for (const field of fixedInputFields) {
      expect((screen.getByLabelText(employeeField(field)) as HTMLInputElement).disabled).toBe(false);
    }

    await user.click(agreedSalary);
    await user.tab();
    expect(document.activeElement).toBe(reconciledDays);

    await user.clear(agreedSalary);
    await user.type(agreedSalary, "15000000");
    await user.clear(bonus);
    await user.type(bonus, "0");

    expect((await screen.findByText("1 nhân viên có thay đổi chưa lưu")).textContent).toBe("1 nhân viên có thay đổi chưa lưu");
    expect(screen.getAllByRole("button", { name: "Lưu thay đổi" })).toHaveLength(1);
  });

  it("keeps all fixed period-input columns visible but disabled for a manager reviewing payroll", async () => {
    mockPayrollResponses({
      _id: "run-1",
      status: "review",
      publishedEmployeeIds: [],
      lines: [{
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        calculation: {
          monthlySalary: employee.monthlySalary,
          workedDays: employee.workedDays,
          workedMinutes: employee.workedMinutes,
          allowances: employee.calculation.allowances,
          bonuses: employee.calculation.bonuses,
          otherDeductions: employee.calculation.otherDeductions,
        },
      }],
    });

    render(<PayrollTab canManage />);

    await screen.findByLabelText(employeeField("agreedSalary"));
    for (const field of fixedInputFields) {
      expect((screen.getByLabelText(employeeField(field)) as HTMLInputElement).disabled).toBe(true);
    }
    expect(screen.queryByRole("button", { name: "Lưu thay đổi" })).toBeNull();
  });
});

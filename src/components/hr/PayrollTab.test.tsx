// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

function payrollEmployee(employeeId: string) {
  return { ...employee, employeeId, employeeName: employeeId };
}

function saveReasonInput() {
  const input = screen.getAllByRole("textbox").find(element => element.tagName === "TEXTAREA");
  if (!input) throw new Error("Save reason input is not present");
  return input;
}

function saveButtons() {
  return screen.getAllByRole("button").filter(button => button.textContent?.includes("thay"));
}

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

  it("saves dirty input rows once with a trimmed shared reason without recalculating payroll", async () => {
    const firstEmployee = payrollEmployee("e1");
    const secondEmployee = payrollEmployee("e2");
    const unrelatedEmployee = payrollEmployee("e3");
    const inputResponse = {
      items: [
        { employeeId: "e1", version: 3 },
        { employeeId: "e2", version: 7 },
        { employeeId: "e3", version: 11 },
      ],
      variables: [],
      editable: true,
      needsRefresh: false,
    };
    getRun.mockResolvedValue(null);
    getResults.mockResolvedValueOnce([firstEmployee, secondEmployee, unrelatedEmployee]).mockResolvedValueOnce([firstEmployee, secondEmployee, unrelatedEmployee]);
    getAdjustments.mockResolvedValue([]);
    getPeriodInputs.mockResolvedValueOnce(inputResponse).mockResolvedValueOnce(inputResponse);
    getPolicies.mockResolvedValue([]);
    bulkSavePeriodInputs.mockResolvedValue([{ employeeId: "e1", status: "success" }, { employeeId: "e2", status: "success" }]);
    calculate.mockResolvedValue(undefined);
    const user = userEvent.setup();
    const reasonText = "\u0110\u1ed1i so\u00e1t th\u00e1ng 8";

    render(<PayrollTab canManage />);

    const agreedSalary = await screen.findByLabelText("agreedSalary-e1");
    const deduction = screen.getByLabelText("deduction-e2");
    await user.clear(agreedSalary);
    await user.type(agreedSalary, "15000000");
    await user.clear(deduction);
    await user.type(deduction, "250000");

    expect(await screen.findByText(/2 .*thay/)).toBeTruthy();
    await user.click(saveButtons()[0]);
    expect(saveButtons()).toHaveLength(2);
    expect((saveButtons()[1] as HTMLButtonElement).disabled).toBe(true);

    const reason = saveReasonInput();
    await user.type(reason, "   ");
    expect((saveButtons()[1] as HTMLButtonElement).disabled).toBe(true);
    await user.clear(reason);
    await user.type(reason, ` ${reasonText} `);
    await user.click(saveButtons()[1]);

    await waitFor(() => expect(bulkSavePeriodInputs).toHaveBeenCalledTimes(1));
    expect(bulkSavePeriodInputs).toHaveBeenCalledWith(expect.any(String), [
      { employeeId: "e1", expectedVersion: 3, reason: reasonText, agreedSalary: 15_000_000, clearFields: [] },
      { employeeId: "e2", expectedVersion: 7, reason: reasonText, deduction: 250_000, clearFields: [] },
    ]);
    expect(calculate).not.toHaveBeenCalled();
    await waitFor(() => expect(saveButtons()).toHaveLength(0));
  });

  it("retains only failed drafts and keeps the save dialog open for retry after a partial save failure", async () => {
    const firstEmployee = payrollEmployee("e1");
    const secondEmployee = payrollEmployee("e2");
    const inputResponse = {
      items: [{ employeeId: "e1", version: 3 }, { employeeId: "e2", version: 7 }],
      variables: [],
      editable: true,
      needsRefresh: false,
    };
    getRun.mockResolvedValue(null);
    getResults.mockResolvedValueOnce([firstEmployee, secondEmployee]).mockResolvedValueOnce([firstEmployee, secondEmployee]);
    getAdjustments.mockResolvedValue([]);
    getPeriodInputs.mockResolvedValueOnce(inputResponse).mockResolvedValueOnce(inputResponse);
    getPolicies.mockResolvedValue([]);
    const conflict = "D\u1eef li\u1ec7u \u0111\u00e3 thay \u0111\u1ed5i";
    bulkSavePeriodInputs.mockResolvedValue([
      { employeeId: "e1", status: "success" },
      { employeeId: "e2", status: "error", message: conflict },
    ]);
    calculate.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<PayrollTab canManage />);

    const agreedSalary = await screen.findByLabelText("agreedSalary-e1");
    const deduction = screen.getByLabelText("deduction-e2");
    await user.clear(agreedSalary);
    await user.type(agreedSalary, "15000000");
    await user.clear(deduction);
    await user.type(deduction, "250000");
    await user.click(saveButtons()[0]);
    const reason = saveReasonInput();
    await user.type(reason, "\u0110\u1ed1i so\u00e1t th\u00e1ng 8");
    await user.click(saveButtons()[1]);

    await screen.findByText(conflict);
    expect((screen.getByLabelText("deduction-e2") as HTMLInputElement).value).toBe("250000");
    expect(screen.getByText(/1 .*thay/)).toBeTruthy();
    expect(saveButtons()).toHaveLength(2);
    expect(saveReasonInput()).toBeTruthy();
    expect(getPeriodInputs).toHaveBeenCalledTimes(2);
    expect(getResults).toHaveBeenCalledTimes(2);
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

    expect((bonus as HTMLInputElement).value).toBe("0");
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

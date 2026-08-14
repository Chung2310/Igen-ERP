// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PAYROLL_RESULT_FIELDS } from "./payroll/payrollLineOverrides";
import PayrollTab from "./PayrollTab";

const getRun = vi.hoisted(() => vi.fn());
const getResults = vi.hoisted(() => vi.fn());
const getAdjustments = vi.hoisted(() => vi.fn());
const getPolicies = vi.hoisted(() => vi.fn());
const getLineOverrides = vi.hoisted(() => vi.fn());
const getPeriodInputVariables = vi.hoisted(() => vi.fn());
const bulkSaveLineOverrides = vi.hoisted(() => vi.fn());
const review = vi.hoisted(() => vi.fn());
const reviewRun = vi.hoisted(() => vi.fn());

vi.mock("../../services/payrollService", () => ({
  payrollService: {
    getRun,
    getResults,
    getAdjustments,
    getPolicies,
    getLineOverrides,
    getPeriodInputVariables,
    bulkSaveLineOverrides,
    review,
    reviewRun,
  },
}));
vi.mock("../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("./payroll/PayrollPolicyManager", () => ({ PayrollPolicyManager: () => null }));
vi.mock("./payroll/PayrollFormulaLibrary", () => ({ PayrollFormulaLibrary: () => <div>formula-library-entry-point</div> }));
vi.mock("./payroll/PayrollCustomVariableManager", () => ({ PayrollCustomVariableManager: () => <div>custom-variable-catalog</div> }));
vi.mock("./payroll/PayrollReviewQueue", () => ({ PayrollReviewQueue: () => null }));
vi.mock("./payroll/PayrollPayslipsPanel", () => ({ PayrollPayslipsPanel: () => null }));
vi.mock("./payroll/PayrollReopenModal", () => ({ PayrollReopenModal: () => null }));

const fixedPeriodInputFields = ["agreedSalary", "reconciledDays", "reconciledHours", "allowance", "bonus", "deduction"];
const fixedPeriodInputLabels = ["Lương thỏa thuận", "Ngày đối soát", "Giờ đối soát", "Phụ cấp", "Thưởng", "Khấu trừ"];

const values = (changes: Record<string, number> = {}) => ({
  baseSalary: 12_000_000,
  adjustedBase: 10_000_000,
  overtime: 1_000_000,
  bonusTotal: 500_000,
  penaltyTotal: 100_000,
  socialInsurance: 800_000,
  healthInsurance: 150_000,
  unemploymentInsurance: 100_000,
  personalIncomeTax: 200_000,
  otherDeductions: 50_000,
  advances: 0,
  hiddenIncome: 300_000,
  ...changes,
});

const effectiveLine = (employeeId: string, changes: Record<string, unknown> = {}) => ({
  employeeId,
  employeeName: employeeId === "e1" ? "Nguyễn Văn A" : "Trần Thị B",
  segmentLines: [{ employeeId, calculation: { monthlySalary: 12_000_000 } }],
  systemValues: values(),
  overrideValues: {},
  effectiveValues: values(),
  overrideVersion: 0,
  deductionTotal: 1_400_000,
  net: 10_400_000,
  provenance: {},
  ...changes,
});

const draftRun = (status = "draft") => ({
  _id: "run-1",
  status,
  publishedEmployeeIds: [],
  lines: [
    { employeeId: "e1", calculation: { monthlySalary: 12_000_000 } },
    { employeeId: "e2", calculation: { monthlySalary: 12_000_000 } },
  ],
  effectiveLines: [
    effectiveLine("e1", {
      overrideValues: { bonusTotal: 700_000 },
      effectiveValues: values({ bonusTotal: 700_000 }),
      overrideVersion: 3,
      deductionTotal: 1_400_000,
      net: 10_600_000,
      provenance: { bonusTotal: "manual_override" },
    }),
    effectiveLine("e2", { overrideVersion: 7 }),
  ],
});

function arrange(run = draftRun()) {
  getRun.mockResolvedValue(run);
  getResults.mockResolvedValue([]);
  getAdjustments.mockResolvedValue([]);
  getPolicies.mockResolvedValue([]);
  getLineOverrides.mockResolvedValue([
    { employeeId: "e1", version: 3, bonusTotal: 700_000 },
    { employeeId: "e2", version: 7 },
  ]);
  getPeriodInputVariables.mockResolvedValue([
    { _id: "variable-1", code: "sales", name: "Doanh số", unit: "money", status: "active", defaultValue: 0 },
    { _id: "variable-2", code: "retired", name: "Đã ngưng", unit: "number", status: "retired" },
  ]);
  bulkSaveLineOverrides.mockResolvedValue([]);
  review.mockResolvedValue({});
  reviewRun.mockResolvedValue({});
}

function saveReasonInput() {
  const input = screen.getAllByRole("textbox").find((element) => element.tagName === "TEXTAREA");
  if (!input) throw new Error("Save reason input is not present");
  return input;
}

function saveDialog() {
  const dialog = saveReasonInput().closest("div.fixed");
  if (!(dialog instanceof HTMLElement)) throw new Error("Save dialog is not present");
  return within(dialog);
}

describe("PayrollTab editable payroll results", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("keeps the disabled formula library entry point hidden", () => {
    arrange();
    render(<PayrollTab canManage />);

    expect(screen.queryByText("formula-library-entry-point")).toBeNull();
  });

  it("keeps the custom catalog but replaces fixed period inputs with editable result and active custom cells", async () => {
    arrange();
    render(<PayrollTab canManage />);

    expect(await screen.findByText("Thông tin nhân viên")).toBeTruthy();
    expect(await screen.findByText("Các khoản có thể chỉnh sửa")).toBeTruthy();
    expect(await screen.findByText("Khoản khấu trừ")).toBeTruthy();
    expect((await screen.findAllByText("Thực nhận")).length).toBeGreaterThanOrEqual(2);
    expect(await screen.findByText("Nguyễn Văn A")).toBeTruthy();
    expect(screen.queryByText("Chưa phát hành")).toBeNull();
    expect(screen.queryByText("e1")).toBeNull();
    expect(screen.getAllByRole("columnheader")[0].className).toContain("text-center");
    expect(screen.getAllByRole("columnheader")[1].className).toContain("text-center");
    expect(screen.getByRole("cell", { name: /Nguyễn Văn A/ }).className).toContain("text-center");

    expect(screen.getByText("custom-variable-catalog")).toBeTruthy();
    for (const field of PAYROLL_RESULT_FIELDS) {
      expect(await screen.findByLabelText(`${field.key}-e1`)).toBeTruthy();
    }
    expect(screen.getByLabelText("custom.sales-e1")).toBeTruthy();
    expect(screen.queryByLabelText("custom.retired-e1")).toBeNull();
    for (const field of fixedPeriodInputFields) {
      expect(screen.queryByLabelText(`${field}-e1`)).toBeNull();
    }
    for (const label of fixedPeriodInputLabels) {
      expect(screen.queryByRole("columnheader", { name: label })).toBeNull();
    }
    expect(screen.getByRole("button", { name: "Chi tiết adjustedBase-e1" })).toBeTruthy();

    expect(screen.getByLabelText("deductionTotal-e1").tagName).not.toBe("INPUT");
    expect(screen.getByLabelText("net-e1").tagName).not.toBe("INPUT");
  });

  it("previews derived values, restores a persisted result, and retains only a conflicting employee after bulk save", async () => {
    arrange();
    const conflict = "Payroll line override was changed by another user";
    bulkSaveLineOverrides.mockResolvedValue([
      { employeeId: "e1", status: "success" },
      { employeeId: "e2", status: "error", message: conflict },
    ]);
    const user = userEvent.setup();
    render(<PayrollTab canManage />);

    const bonus = await screen.findByLabelText("bonusTotal-e1");
    const insurance = screen.getByLabelText("socialInsurance-e1");
    await user.clear(bonus);
    await user.type(bonus, "1000000");
    await user.clear(insurance);
    await user.type(insurance, "900000");

    expect(screen.getByLabelText("deductionTotal-e1").textContent).toContain("1.500.000");
    expect(screen.getByLabelText("net-e1").textContent).toContain("10.800.000");

    await user.click(screen.getByRole("button", { name: "Khôi phục bonusTotal-e1" }));
    expect((bonus as HTMLInputElement).value).toBe("500000");
    expect(screen.getByLabelText("net-e1").textContent).toContain("10.300.000");

    const secondBonus = screen.getByLabelText("bonusTotal-e2");
    await user.clear(secondBonus);
    await user.type(secondBonus, "250000");
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    const submit = saveDialog().getByRole("button", { name: "Lưu thay đổi" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    await user.type(saveReasonInput(), "  Đối soát kỳ tháng 8  ");
    await user.click(submit);

    await waitFor(() => expect(bulkSaveLineOverrides).toHaveBeenCalledTimes(1));
    expect(bulkSaveLineOverrides).toHaveBeenCalledWith(expect.any(String), [
      {
        employeeId: "e1",
        expectedVersion: 3,
        reason: "Đối soát kỳ tháng 8",
        values: { socialInsurance: 900_000 },
        clearFields: ["bonusTotal"],
      },
      {
        employeeId: "e2",
        expectedVersion: 7,
        reason: "Đối soát kỳ tháng 8",
        values: { bonusTotal: 250_000 },
        clearFields: [],
      },
    ]);

    const e1Row = screen.getByLabelText("socialInsurance-e1").closest("tr");
    const e2Row = screen.getByLabelText("bonusTotal-e2").closest("tr");
    if (!e1Row || !e2Row) throw new Error("Payroll employee row is not present");
    await waitFor(() => expect(within(e2Row).getByText(conflict)).toBeTruthy());
    expect(within(e1Row).queryByText(conflict)).toBeNull();
    expect((within(e2Row).getByLabelText("bonusTotal-e2") as HTMLInputElement).value).toBe("250000");
    expect(screen.getByText(/1 nhân viên có thay đổi chưa lưu/)).toBeTruthy();
    expect(saveDialog().getByRole("button", { name: "Lưu thay đổi" })).toBeTruthy();
  });

  it("uses non-default system custom values and includes unsaved custom drafts in the footer preview", async () => {
    const run: any = draftRun();
    run.effectiveLines[0].systemValues = { ...run.effectiveLines[0].systemValues, customValues: { sales: 125 } };
    run.effectiveLines[0].overrideValues = { ...run.effectiveLines[0].overrideValues, customValues: { sales: 300 } };
    run.effectiveLines[0].effectiveValues = { ...run.effectiveLines[0].effectiveValues, customValues: { sales: 300 } };
    run.effectiveLines[1].systemValues = { ...run.effectiveLines[1].systemValues, customValues: { sales: 50 } };
    run.effectiveLines[1].effectiveValues = { ...run.effectiveLines[1].effectiveValues, customValues: { sales: 50 } };
    arrange(run);
    getLineOverrides.mockResolvedValue([
      { employeeId: "e1", version: 3, bonusTotal: 700_000, customValues: { sales: 300 } },
      { employeeId: "e2", version: 7 },
    ]);
    const user = userEvent.setup();
    render(<PayrollTab canManage />);

    const custom = await screen.findByLabelText("custom.sales-e1");
    const footer = custom.closest("table")?.querySelector("tfoot");
    if (!(footer instanceof HTMLElement)) throw new Error("Payroll footer is not present");
    expect((custom as HTMLInputElement).value).toBe("300");
    expect(within(footer).getByText("350")).toBeTruthy();

    await user.clear(custom);
    await user.type(custom, "450");
    expect(within(footer).getByText("500")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Khôi phục custom.sales-e1" }));
    expect((custom as HTMLInputElement).value).toBe("125");
    expect(within(footer).getByText("175")).toBeTruthy();
  });
});

describe("PayrollTab read-only payroll results", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it.each([
    { status: "review", canManage: true, label: "review" },
    { status: "closed", canManage: true, label: "closed" },
    { status: "draft", canManage: false, label: "no-manage" },
  ])("shows effective component values without editing actions in $label mode", async ({ status, canManage }) => {
    arrange(draftRun(status));
    render(<PayrollTab canManage={canManage} />);

    const row = (await screen.findByText("Nguyễn Văn A")).closest("tr");
    if (!row) throw new Error("Payroll employee row is not present");
    expect(within(row).getByText("700.000 đ")).toBeTruthy();
    expect(within(row).queryByRole("spinbutton")).toBeNull();
    expect(within(row).queryByRole("button", { name: /Khôi phục/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Lưu thay đổi" })).toBeNull();
  });

  it("drops an unsaved draft when review succeeds and renders the authoritative effective values", async () => {
    arrange();
    getRun.mockResolvedValueOnce({ ...draftRun(), activeRevisionId: "revision-1" }).mockResolvedValue({ ...draftRun("review"), activeRevisionId: "revision-1" });
    const user = userEvent.setup();
    render(<PayrollTab canManage />);

    const bonus = await screen.findByLabelText("bonusTotal-e1");
    await user.clear(bonus);
    await user.type(bonus, "1000000");
    expect(screen.getByLabelText("net-e1").textContent).toContain("10.900.000");

    await user.click(screen.getByRole("button", { name: /Ki.*tra/ }));
    await waitFor(() => expect(reviewRun).toHaveBeenCalledWith("run-1"));

    const row = (await screen.findByText("Nguyễn Văn A")).closest("tr");
    if (!row) throw new Error("Payroll employee row is not present");
    await waitFor(() => expect(within(row).queryByRole("spinbutton")).toBeNull());
    expect(within(row).getByText("700.000 đ")).toBeTruthy();
    expect(screen.queryByText(/nhân viên có thay đổi chưa lưu/)).toBeNull();
  });

  it("keeps a no-run payroll view read-only for a user without manage permission", async () => {
    arrange(null);
    getRun.mockRejectedValue(new Error("not found"));
    render(<PayrollTab canManage={false} />);

    expect(await screen.findByText("Bảng lương chưa được tính cho kỳ này")).toBeTruthy();
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.queryByRole("button", { name: "Lưu thay đổi" })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  buildLineOverrideRows,
  previewPayrollLine,
  removeLineOverrideDraftField,
  restoreLineOverrideDraftField,
  retainFailedLineOverrideDrafts,
  setLineOverrideDraftValue,
  type PayrollLineOverrideDrafts,
} from "./payrollLineOverrides";

const emptyDrafts: PayrollLineOverrideDrafts = {};

describe("payroll line override drafts", () => {
  it("keeps explicit zero and keys drafts by employee and result field", () => {
    const first = setLineOverrideDraftValue(emptyDrafts, "employee-a", "bonusTotal", 0);
    const second = setLineOverrideDraftValue(first, "employee-b", "socialInsurance", 250_000);

    expect(second).toEqual({
      "employee-a": { values: { bonusTotal: 0 }, clearFields: [] },
      "employee-b": { values: { socialInsurance: 250_000 }, clearFields: [] },
    });
    expect(emptyDrafts).toEqual({});
  });

  it("supports active custom fields without widening period-input drafts", () => {
    const drafts = setLineOverrideDraftValue(emptyDrafts, "employee-a", "custom.sales", 12);

    expect(drafts["employee-a"].values).toEqual({ "custom.sales": 12 });
  });

  it("marks a persisted field for restore and removes a discarded draft immutably", () => {
    const entered = setLineOverrideDraftValue(emptyDrafts, "employee-a", "bonusTotal", 500_000);
    const restored = restoreLineOverrideDraftField(entered, "employee-a", "bonusTotal");
    const discarded = removeLineOverrideDraftField(restored, "employee-a", "bonusTotal");

    expect(restored).toEqual({
      "employee-a": { values: {}, clearFields: ["bonusTotal"] },
    });
    expect(discarded).toEqual({});
    expect(entered["employee-a"].values).toEqual({ bonusTotal: 500_000 });
  });
});

describe("payroll line override requests", () => {
  it("builds nested core and custom values with trimmed reason and expected versions", () => {
    const drafts = setLineOverrideDraftValue(
      setLineOverrideDraftValue(emptyDrafts, "employee-a", "bonusTotal", 0),
      "employee-a",
      "custom.sales",
      8,
    );
    const withRestore = restoreLineOverrideDraftField(drafts, "employee-b", "socialInsurance");

    expect(buildLineOverrideRows(withRestore, [
      { employeeId: "employee-a", version: 3 },
      { employeeId: "employee-b", overrideVersion: 7 },
    ], "  Payroll reconciliation  ")).toEqual([
      {
        employeeId: "employee-a",
        expectedVersion: 3,
        reason: "Payroll reconciliation",
        values: { bonusTotal: 0 },
        customValues: { sales: 8 },
        clearFields: [],
      },
      {
        employeeId: "employee-b",
        expectedVersion: 7,
        reason: "Payroll reconciliation",
        values: {},
        clearFields: ["socialInsurance"],
      },
    ]);
  });

  it("retains only failed employee drafts and their row errors", () => {
    const drafts = setLineOverrideDraftValue(
      setLineOverrideDraftValue(emptyDrafts, "employee-a", "bonusTotal", 100),
      "employee-b",
      "advances",
      50,
    );

    expect(retainFailedLineOverrideDrafts(drafts, [
      { employeeId: "employee-a", status: "success" },
      { employeeId: "employee-b", status: "error", message: "Version conflict" },
    ])).toEqual({
      drafts: { "employee-b": { values: { advances: 50 }, clearFields: [] } },
      errors: { "employee-b": "Version conflict" },
    });
  });
});

describe("payroll line derived preview", () => {
  it("recalculates deductions and net while preserving hidden system income", () => {
    const line = {
      systemValues: {
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
      },
      effectiveValues: {
        baseSalary: 12_000_000,
        adjustedBase: 10_000_000,
        overtime: 1_000_000,
        bonusTotal: 700_000,
        penaltyTotal: 100_000,
        socialInsurance: 600_000,
        healthInsurance: 150_000,
        unemploymentInsurance: 100_000,
        personalIncomeTax: 200_000,
        otherDeductions: 50_000,
        advances: 0,
        hiddenIncome: 300_000,
      },
    };
    const drafts = restoreLineOverrideDraftField(
      setLineOverrideDraftValue(emptyDrafts, "employee-a", "bonusTotal", 1_000_000),
      "employee-a",
      "socialInsurance",
    );

    expect(previewPayrollLine(line, drafts["employee-a"])).toMatchObject({
      values: { bonusTotal: 1_000_000, socialInsurance: 800_000, hiddenIncome: 300_000 },
      deductionTotal: 1_400_000,
      net: 10_900_000,
    });
  });

  it("rounds deductions and previews custom drafts and restores against system custom values", () => {
    const line = {
      systemValues: {
        baseSalary: 1_000,
        adjustedBase: 1_000,
        overtime: 0,
        bonusTotal: 0,
        penaltyTotal: 10.4,
        socialInsurance: 20.4,
        healthInsurance: 0,
        unemploymentInsurance: 0,
        personalIncomeTax: 0,
        otherDeductions: 0,
        advances: 0,
        hiddenIncome: 0,
        customValues: { sales: 125 },
      },
      effectiveValues: {
        baseSalary: 1_000,
        adjustedBase: 1_000,
        overtime: 0,
        bonusTotal: 0,
        penaltyTotal: 10.4,
        socialInsurance: 20.4,
        healthInsurance: 0,
        unemploymentInsurance: 0,
        personalIncomeTax: 0,
        otherDeductions: 0,
        advances: 0,
        hiddenIncome: 0,
        customValues: { sales: 300 },
      },
    };
    const restored = restoreLineOverrideDraftField(
      setLineOverrideDraftValue(emptyDrafts, "employee-a", "custom.sales", 450),
      "employee-a",
      "custom.sales",
    )["employee-a"];

    expect(previewPayrollLine(line, restored)).toMatchObject({
      values: { customValues: { sales: 125 } },
      deductionTotal: 31,
      net: 969,
    });

    const changed = setLineOverrideDraftValue(
      emptyDrafts,
      "employee-a",
      "custom.sales",
      450,
    )["employee-a"];
    expect(previewPayrollLine(line, changed).values.customValues).toEqual({ sales: 450 });
  });
});

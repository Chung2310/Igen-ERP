import { describe, expect, it } from "vitest";
import { buildDirtyRows, removeDraftField, restoreDraftField, retainFailedDrafts, setDraftValue } from "./payrollInlineInputs";

describe("payroll inline inputs", () => {
  it("keeps explicit zero as a value keyed by employee", () => {
    const drafts = setDraftValue({}, "e1", "bonus", 0);
    expect(drafts).toEqual({ e1: { values: { bonus: 0 }, clearFields: [] } });
  });

  it("represents restore separately from zero", () => {
    const withValue = setDraftValue({}, "e1", "bonus", 0);
    const restored = restoreDraftField(withValue, "e1", "bonus");
    expect(restored.e1.values).not.toHaveProperty("bonus");
    expect(restored.e1.clearFields).toEqual(["bonus"]);
  });

  it("removes an unsaved edit when the input is emptied", () => {
    const drafts = setDraftValue({}, "e1", "bonus", 5);
    expect(removeDraftField(drafts, "e1", "bonus")).toEqual({});
  });

  it("builds only dirty employee payloads with versions and one reason", () => {
    const drafts = setDraftValue({}, "e2", "custom.sales", 12);
    expect(buildDirtyRows(drafts, [{ employeeId: "e2", version: 4 }], "Đối soát tháng")).toEqual([
      { employeeId: "e2", expectedVersion: 4, reason: "Đối soát tháng", customValues: { sales: 12 }, clearFields: [] },
    ]);
  });

  it("builds a payload row for each employee with fixed and custom overrides", () => {
    const drafts = setDraftValue(
      setDraftValue(
        setDraftValue(setDraftValue({}, "e1", "agreedSalary", 15000000), "e1", "bonus", 0),
        "e1",
        "reconciledDays",
        22.5,
      ),
      "e1",
      "custom.sales",
      12,
    );
    const twoEmployees = setDraftValue(drafts, "e2", "agreedSalary", 15000000);

    expect(buildDirtyRows(twoEmployees, [{ employeeId: "e1", version: 3 }, { employeeId: "e2", version: 7 }], "  \u0110\u1ed1i so\u00e1t th\u00e1ng 8  ")).toEqual([
      {
        employeeId: "e1",
        expectedVersion: 3,
        reason: "\u0110\u1ed1i so\u00e1t th\u00e1ng 8",
        agreedSalary: 15000000,
        reconciledDays: 22.5,
        bonus: 0,
        customValues: { sales: 12 },
        clearFields: [],
      },
      {
        employeeId: "e2",
        expectedVersion: 7,
        reason: "\u0110\u1ed1i so\u00e1t th\u00e1ng 8",
        agreedSalary: 15000000,
        clearFields: [],
      },
    ]);
  });

  it("builds a restoration payload with clear fields and no values", () => {
    const drafts = setDraftValue(setDraftValue({}, "e1", "allowance", 500), "e1", "custom.sales", 12);
    const restored = restoreDraftField(restoreDraftField(drafts, "e1", "allowance"), "e1", "custom.sales");

    expect(buildDirtyRows(restored, [{ employeeId: "e1", version: 7 }], "reason")).toEqual([
      { employeeId: "e1", expectedVersion: 7, reason: "reason", clearFields: ["allowance", "custom.sales"] },
    ]);
  });

  it("clears successful drafts and retains failed rows", () => {
    const drafts = setDraftValue(setDraftValue({}, "e1", "bonus", 1), "e2", "deduction", 2);
    expect(retainFailedDrafts(drafts, [{ employeeId: "e1", status: "success" }, { employeeId: "e2", status: "error", message: "conflict" }])).toEqual({
      drafts: { e2: drafts.e2 }, errors: { e2: "conflict" },
    });
  });
});

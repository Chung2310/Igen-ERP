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

  it("clears successful drafts and retains failed rows", () => {
    const drafts = setDraftValue(setDraftValue({}, "e1", "bonus", 1), "e2", "deduction", 2);
    expect(retainFailedDrafts(drafts, [{ employeeId: "e1", status: "success" }, { employeeId: "e2", status: "error", message: "conflict" }])).toEqual({
      drafts: { e2: drafts.e2 }, errors: { e2: "conflict" },
    });
  });
});

import { describe, expect, it } from "vitest";
import { getPayrollProcessingAction, hasActivePolicyForMonth } from "./payrollProcessingAction";

describe("getPayrollProcessingAction", () => {
  it("offers initial payroll calculation when no run exists", () => {
    expect(getPayrollProcessingAction(undefined, false)).toEqual({ visible: true, disabled: false, label: "Tính lương" });
  });

  it("offers repeatable payroll refresh for a draft run", () => {
    expect(getPayrollProcessingAction("draft", false)).toEqual({ visible: true, disabled: false, label: "Cập nhật bảng lương" });
  });

  it.each(["review", "closed", "paid"])("hides processing for %s", (status) => {
    expect(getPayrollProcessingAction(status, false).visible).toBe(false);
  });

  it("disables and changes the label while processing", () => {
    expect(getPayrollProcessingAction("draft", true)).toEqual({ visible: true, disabled: true, label: "Đang cập nhật..." });
    expect(getPayrollProcessingAction(undefined, true)).toEqual({ visible: true, disabled: true, label: "Đang tính lương..." });
  });

  it("disables payroll when the selected month has no active policy", () => {
    expect(getPayrollProcessingAction(undefined, false, false)).toEqual({ visible: true, disabled: true, label: "Tính lương", reason: "Cần áp dụng công thức lương cho kỳ này" });
  });

  it("detects an active policy covering the selected month's calculation date", () => {
    expect(hasActivePolicyForMonth([{ status: "active", effectiveFrom: "2026-08-12" }], "2026-08")).toBe(true);
    expect(hasActivePolicyForMonth([{ status: "active", effectiveFrom: "2026-01-01", effectiveTo: "2026-08-15" }], "2026-08")).toBe(false);
    expect(hasActivePolicyForMonth([{ status: "retired", effectiveFrom: "2026-01-01" }], "2026-08")).toBe(false);
  });
});

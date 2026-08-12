import { describe, expect, it } from "vitest";
import { getPayrollProcessingAction } from "./payrollProcessingAction";

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
});

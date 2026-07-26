import { describe, expect, it } from "vitest";
import { TimekeepingLogModel } from "./timekeeping.model";
import { TimekeepingAdjustmentAuditModel } from "./timekeeping-adjustment-audit.model";
import { AttendancePeriodResultModel } from "./attendance-period-result.model";

describe("attendance adjustment persistence", () => {
  it("stores manual adjustment metadata on attendance logs", () => {
    expect(TimekeepingLogModel.schema.path("manuallyAdjusted")).toBeTruthy();
    expect(TimekeepingLogModel.schema.path("adjustedBy")).toBeTruthy();
    expect(TimekeepingLogModel.schema.path("adjustmentReason")).toBeTruthy();
  });

  it("stores before/after audit entries and stale payroll state", () => {
    expect(TimekeepingAdjustmentAuditModel.schema.path("before")).toBeTruthy();
    expect(TimekeepingAdjustmentAuditModel.schema.path("after")).toBeTruthy();
    expect(TimekeepingAdjustmentAuditModel.schema.path("reason")).toBeTruthy();
    expect(AttendancePeriodResultModel.schema.path("needsRecalculation")).toBeTruthy();
  });
});

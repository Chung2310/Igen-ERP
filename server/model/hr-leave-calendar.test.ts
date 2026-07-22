import { describe, expect, it } from "vitest";
import { HRLeaveApplicationModel } from "./hr-leave-application.model";

describe("HR leave calendar snapshot", () => {
  it("defines approval-time chargeable date snapshot fields", () => {
    expect(HRLeaveApplicationModel.schema.path("chargeableDays")).toBeTruthy();
    expect(HRLeaveApplicationModel.schema.path("chargeableDates")).toBeTruthy();
  });
});

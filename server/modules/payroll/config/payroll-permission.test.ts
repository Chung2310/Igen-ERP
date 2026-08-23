import { describe, expect, it } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS } from "../../../middleware/auth";
import { PERMISSION_CODES } from "../../../config/permission-catalog";
import { PAYROLL_RUN_ROUTE_PERMISSIONS } from "../routes/run.routes";
import { PAYROLL_PERIOD_ROUTE_PERMISSIONS } from "../routes/period.routes";

describe("payroll permission registration", () => {
  it("registers separate period, policy, and payment pairs for administrators", () => {
    for (const feature of ["payroll-period", "payroll-policy", "payroll-payment"]) {
      expect(PERMISSION_CODES).toContain(`${feature}:read`);
      expect(PERMISSION_CODES).toContain(`${feature}:manage`);
      expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain(`${feature}:manage`);
    }
  });

  it("guards payroll run creation with period management", () => {
    expect(PAYROLL_RUN_ROUTE_PERMISSIONS["POST /runs"]).toBe("payroll-period:manage");
    expect(PAYROLL_PERIOD_ROUTE_PERMISSIONS["POST /periods/:periodKey/run"]).toBe("payroll-period:manage");
  });
});

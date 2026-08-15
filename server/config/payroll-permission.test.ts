import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS } from "../middleware/auth";
import { PERMISSION_CODES } from "./permission-catalog";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("payroll permission registration", () => {
  it("registers separate period, policy, and payment pairs for administrators", () => {
    for (const feature of ["payroll-period", "payroll-policy", "payroll-payment"]) {
      expect(PERMISSION_CODES).toContain(`${feature}:read`);
      expect(PERMISSION_CODES).toContain(`${feature}:manage`);
      expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain(`${feature}:manage`);
    }
  });

  it("guards payroll run creation with period management", () => {
    const router = read("server/router/payroll.router.ts");
    expect(router).toMatch(/post\("\/runs", requirePermission\("payroll-period:manage"\)/);
    expect(router).toMatch(/post\("\/periods\/:periodKey\/run", requirePermission\("payroll-period:manage"\)/);
  });
});

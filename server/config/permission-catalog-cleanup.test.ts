import { describe, expect, it } from "vitest";
import {
  PERMISSION_CATALOG,
  PERMISSION_FEATURES,
  PermissionValidationError,
  compactStoredPermissions,
  expandEffectivePermissions,
  isPermissionCode,
} from "./permission-catalog";

const EXPECTED_FEATURES = [
  "access", "chat", "dashboard", "finance-receivable", "finance-wallet", "hr",
  "inventory", "labor-partner", "labor-partner-payout", "labor-partner-policy",
  "labor-partner-settlement", "payroll-payment", "payroll-period", "payroll-policy",
  "people", "recruitment", "relationship", "resource", "retail", "settings",
  "timekeeping", "work",
];

describe("permission registry", () => {
it("contains exactly one read/manage pair for every approved feature", () => {
  expect(PERMISSION_FEATURES.map((entry) => entry.feature).sort()).toEqual(EXPECTED_FEATURES);
  expect(PERMISSION_CATALOG).toHaveLength(EXPECTED_FEATURES.length * 2);
  for (const feature of EXPECTED_FEATURES) {
    expect(
      PERMISSION_CATALOG.filter((entry) => entry.feature === feature).map((entry) => entry.action).sort(),
    ).toEqual(["manage", "read"]);
  }
  expect(new Set(PERMISSION_CATALOG.map((entry) => entry.code)).size).toBe(PERMISSION_CATALOG.length);
});

it("recognizes only registered read/manage codes", () => {
  expect(isPermissionCode("payroll-period:read")).toBe(true);
  expect(isPermissionCode("payroll-period:manage")).toBe(true);
  expect(isPermissionCode("payroll-payment:manage")).toBe(true);
  expect(isPermissionCode("labor-partner-settlement:manage")).toBe(true);
  expect(isPermissionCode("payroll:pay")).toBe(false);
  expect(isPermissionCode("unknown:manage")).toBe(false);
});

it("compacts redundant read while returning effective permissions", () => {
  expect(compactStoredPermissions([
    "hr:read",
    "hr:manage",
    "payroll-payment:read",
  ])).toEqual({
    stored: ["hr:manage", "payroll-payment:read"],
    effective: ["hr:manage", "hr:read", "payroll-payment:read"],
  });
});

it("rejects every invalid code instead of silently dropping it", () => {
  expect(() => compactStoredPermissions(["hr:read", "student:manage", "finance:collect"]))
    .toThrowError(expect.objectContaining({
      name: PermissionValidationError.name,
      invalidCodes: ["finance:collect", "student:manage"],
    }));
});

it("manage expands to read without crossing feature boundaries", () => {
  expect(
    [...expandEffectivePermissions(["finance-wallet:manage", "finance-receivable:read"])].sort(),
  ).toEqual(["finance-receivable:read", "finance-wallet:manage", "finance-wallet:read"]);
});
});

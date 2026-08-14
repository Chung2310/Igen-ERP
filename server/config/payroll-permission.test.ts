import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS } from "../middleware/auth";
import { LEGACY_PERMISSION_MAP } from "./permission-catalog";
import { PERMISSION_TRANSLATIONS } from "../../src/utils/permissionUtils";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("payroll prepare permission registration", () => {
  it("registers and seeds payroll:prepare as a distinct operational permission", () => {
    assert.equal(LEGACY_PERMISSION_MAP["payroll:prepare"], "payroll:manage");
    assert.ok(PERMISSION_TRANSLATIONS["payroll:prepare"]);
    assert.ok(DEFAULT_ROLE_PERMISSIONS.admin.includes("payroll:manage"));
  });

  it("registers payroll payment permission and grants it to admins", () => {
    assert.equal(LEGACY_PERMISSION_MAP["payroll:pay"], "payroll:manage");
    assert.ok(PERMISSION_TRANSLATIONS["payroll:pay"]);
    assert.ok(DEFAULT_ROLE_PERMISSIONS.admin.includes("payroll:manage"));
  });

  it("keeps legacy manage permissions while operational routes require prepare directly", () => {
    const router = read("server/router/payroll.router.ts");

    assert.match(router, /post\("\/runs", requirePermission\("payroll:manage"\)/);
    assert.match(router, /post\("\/periods\/:periodKey\/run", requirePermission\("payroll:manage"\)/);
    assert.doesNotMatch(router, /requirePermission\(\[[^\]]*"payroll:manage"[^\]]*"payroll:manage"/);
  });
});


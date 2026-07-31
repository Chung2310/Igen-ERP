import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS } from "../middleware/auth";
import { PERMISSION_CATALOG } from "./permission-catalog";
import { PERMISSION_TRANSLATIONS } from "../../src/utils/permissionUtils";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("payroll prepare permission registration", () => {
  it("registers and seeds payroll:prepare as a distinct operational permission", () => {
    const entry = PERMISSION_CATALOG.find(({ code }) => code === "payroll:prepare");

    assert.ok(entry);
    assert.ok(PERMISSION_TRANSLATIONS["payroll:prepare"]);
    assert.ok(DEFAULT_ROLE_PERMISSIONS.admin.includes("payroll:prepare"));
    assert.match(read("server/config/database.ts"), /payroll:prepare/);
  });

  it("registers payroll payment permission and grants it to admins", () => {
    assert.ok(PERMISSION_CATALOG.some(({ code }) => code === "payroll:pay"));
    assert.ok(PERMISSION_TRANSLATIONS["payroll:pay"]);
    assert.ok(DEFAULT_ROLE_PERMISSIONS.admin.includes("payroll:pay"));
    assert.match(read("server/config/database.ts"), /payroll:pay/);
  });

  it("keeps legacy manage permissions while operational routes require prepare directly", () => {
    const router = read("server/router/payroll.router.ts");

    assert.match(router, /post\("\/runs", requirePermission\("payroll:prepare"\)/);
    assert.match(router, /post\("\/periods\/:periodKey\/run", requirePermission\("payroll:manage"\)/);
    assert.doesNotMatch(router, /requirePermission\(\[[^\]]*"payroll:prepare"[^\]]*"payroll:manage"/);
  });
});


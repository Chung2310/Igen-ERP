import assert from "node:assert/strict";
import test from "node:test";
import { CompanyModel } from "../model/company.model";
import { ModuleSettings } from "../modules/student-management/models/module-settings.model";
import { clearModuleCache, getModuleStateForCompany, resolveModuleAccess } from "./require-module";

test("superadmin always bypasses tenant module restrictions", () => {
  assert.equal(resolveModuleAccess({ role: "superadmin", companyCode: "SYSTEM" }, "hr", []), true);
});

test("a tenant user can access an enabled module", () => {
  assert.equal(resolveModuleAccess({ role: "user", companyCode: "ACME" }, "hr", ["hr", "chat"]), true);
});

test("a tenant user cannot access a disabled module", () => {
  assert.equal(resolveModuleAccess({ role: "admin", companyCode: "ACME" }, "inventory", ["hr"]), false);
});

test("requireModule denies Student and allows Worker for labor tenants with stale student modules", () => {
  const laborModules = ["student", "worker", "hr"];
  assert.equal(resolveModuleAccess({ role: "user", companyCode: "LABOR" }, "student", laborModules, true, "labor"), false);
  assert.equal(resolveModuleAccess({ role: "user", companyCode: "LABOR" }, "worker", laborModules, true, "labor"), true);
});

test("legacy worker tenant route access uses the read-only entity preset fallback", async () => {
  const originalCompanyFindOne = CompanyModel.findOne;
  const originalSettingsFindOne = ModuleSettings.findOne;
  clearModuleCache("LEGACY");
  (CompanyModel as any).findOne = () => ({ select: () => ({ lean: async () => ({ enabledModules: ["student"] }) }) });
  (ModuleSettings as any).findOne = () => ({ select: () => ({ lean: async () => ({ entityPreset: "worker" }) }) });

  try {
    const state = await getModuleStateForCompany("LEGACY");
    assert.equal(state.businessType, "labor");
    assert.equal(resolveModuleAccess({ role: "user", companyCode: "LEGACY" }, "worker", state.modules, state.exists, state.businessType), true);
    assert.equal(resolveModuleAccess({ role: "user", companyCode: "LEGACY" }, "student", state.modules, state.exists, state.businessType), false);
  } finally {
    CompanyModel.findOne = originalCompanyFindOne;
    ModuleSettings.findOne = originalSettingsFindOne;
    clearModuleCache("LEGACY");
  }
});

test("missing or empty module data remains backward compatible", () => {
  assert.equal(resolveModuleAccess({ role: "user", companyCode: "OLD" }, "hr", [], true), true);
  assert.equal(resolveModuleAccess({ role: "user", companyCode: "OLD" }, "hr", undefined, true), true);
});

test("tenant module access fails closed without a company code", () => {
  assert.equal(resolveModuleAccess({ role: "user" }, "student", ["student"], true), false);
});

test("tenant module access fails closed when the company record does not exist", () => {
  assert.equal(resolveModuleAccess({ role: "user", companyCode: "MISSING" }, "student", undefined, false), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { CompanyModel } from "../model/company.model";
import { ModuleSettings } from "../modules/student-management/models/module-settings.model";
import { clearModuleCache, getModuleStateForCompany, isServiceSubscriptionBlocked, resolveModuleAccess } from "./require-module";

test("superadmin always bypasses tenant module restrictions", () => {
  assert.equal(resolveModuleAccess({ role: "superadmin", companyCode: "SYSTEM" }, "hr", []), true);
});

test("a tenant user can access an enabled module", () => {
  assert.equal(resolveModuleAccess({ role: "user", companyCode: "ACME" }, "hr", ["hr", "chat"]), true);
});

test("a tenant user cannot access a disabled module", () => {
  assert.equal(resolveModuleAccess({ role: "admin", companyCode: "ACME" }, "inventory", ["hr"]), false);
});

test("requireModule allows both enabled modules regardless of legacy type", () => {
  const laborModules = ["student", "worker", "hr"];
  assert.equal(resolveModuleAccess({ role: "user", companyCode: "LABOR" }, "student", laborModules, true, "labor"), true);
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
    assert.equal(resolveModuleAccess({ role: "user", companyCode: "LEGACY" }, "worker", state.modules, state.exists, state.businessType), false);
    assert.equal(resolveModuleAccess({ role: "user", companyCode: "LEGACY" }, "student", state.modules, state.exists, state.businessType), true);
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

test("a cancelled or expired service subscription blocks modules while legacy tenants remain available", () => {
  const now = new Date("2026-10-28T00:00:00.000Z");
  assert.equal(isServiceSubscriptionBlocked({}, now), false);
  assert.equal(isServiceSubscriptionBlocked({ subscriptionStatus: "active", subscriptionEndsAt: new Date("2026-10-29") }, now), false);
  assert.equal(isServiceSubscriptionBlocked({ subscriptionStatus: "active", subscriptionEndsAt: now }, now), true);
  assert.equal(isServiceSubscriptionBlocked({ subscriptionStatus: "cancelled", subscriptionEndsAt: new Date("2026-10-29") }, now), true);
});
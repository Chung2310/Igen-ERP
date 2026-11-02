import assert from "node:assert/strict";
import test from "node:test";
import { resolveCompanyModuleUpdate } from "./auth-company-modules";

test("omitted enabledModules leaves the company module selection unchanged", () => {
  assert.equal(resolveCompanyModuleUpdate({ name: "Acme" }), undefined);
});

test("an explicit module selection is sanitized before update", () => {
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: ["hr", "chat", "hr", "unknown"] }), ["hr", "chat"]);
});

import { DEFAULT_MODULE_KEYS } from "../config/module-keys";

test("an empty explicit selection resolves to default modules of the business type", () => {
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: [], businessType: "education" }), DEFAULT_MODULE_KEYS);
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: [], businessType: "labor" }), DEFAULT_MODULE_KEYS);
});

test("legacy business type does not restrict enabled modules", () => {
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: ["student", "worker", "resource"], businessType: "labor" }), ["student", "worker", "resource"]);
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: ["student", "worker", "resource"], businessType: "education" }), ["student", "worker", "resource"]);
});

test("legacy worker preset is treated as a labor company", () => {
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: ["student", "worker"], legacyEntityPreset: "worker" }), ["student", "worker"]);
});

test("business type does not force the core module back on", () => {
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: ["hr", "chat"], businessType: "labor" }), ["hr", "chat"]);
});

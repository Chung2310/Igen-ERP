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
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: [], businessType: "education" }), DEFAULT_MODULE_KEYS.filter((key) => key !== "worker"));
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: [], businessType: "labor" }), DEFAULT_MODULE_KEYS.filter((key) => key !== "student"));
});

test("business type drops the core module of the other business type", () => {
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: ["student", "worker", "resource"], businessType: "labor" }), ["worker", "resource"]);
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: ["student", "worker", "resource"], businessType: "education" }), ["student", "resource"]);
});

test("legacy worker preset is treated as a labor company", () => {
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: ["student", "worker"], legacyEntityPreset: "worker" }), ["worker"]);
});

test("business type does not force the core module back on", () => {
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: ["hr", "chat"], businessType: "labor" }), ["hr", "chat"]);
});

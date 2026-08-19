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

test("an empty explicit selection resolves to default modules", () => {
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: [] }), DEFAULT_MODULE_KEYS);
});

test("company module updates are no longer restricted by business type", () => {
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: ["student", "worker", "resource"], businessType: "labor" }), ["student", "worker", "resource"]);
});

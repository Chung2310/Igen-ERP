import assert from "node:assert/strict";
import test from "node:test";
import { resolveCompanyModuleUpdate } from "./auth-company-modules";

test("omitted enabledModules leaves the company module selection unchanged", () => {
  assert.equal(resolveCompanyModuleUpdate({ name: "Acme" }), undefined);
});

test("an explicit module selection is sanitized before update", () => {
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: ["hr", "chat", "hr", "unknown"] }), ["hr", "chat"]);
});

test("an empty explicit selection resolves to general modules", () => {
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: [] }), ["hr", "inventory", "resource", "chat"]);
});

test("company module updates are filtered by business type", () => {
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: ["student", "worker", "resource"], businessType: "labor" }), ["worker", "resource"]);
});

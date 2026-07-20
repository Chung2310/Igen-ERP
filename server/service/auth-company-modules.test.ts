import assert from "node:assert/strict";
import test from "node:test";
import { MODULE_KEYS } from "../config/module-keys";
import { resolveCompanyModuleUpdate } from "./auth-company-modules";

test("omitted enabledModules leaves the company module selection unchanged", () => {
  assert.equal(resolveCompanyModuleUpdate({ name: "Acme" }), undefined);
});

test("an explicit module selection is sanitized before update", () => {
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: ["hr", "chat", "hr", "unknown"] }), ["hr", "chat"]);
});

test("an empty explicit selection falls back to every module", () => {
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: [] }), [...MODULE_KEYS]);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  DYNAMIC_FIELD_TYPES,
  MODULE_KEYS,
} from "../interfaces/custom-field.interface";
import {
  canManageCustomFields,
  resolveCustomFieldTenant,
} from "./custom-field.util";

test("exposes the exact supported module keys", () => {
  assert.deepEqual(MODULE_KEYS, ["students", "courses", "batches", "exams", "resources", "partners"]);
});

test("exposes the exact supported dynamic field types", () => {
  assert.deepEqual(DYNAMIC_FIELD_TYPES, [
    "text", "email", "phone", "url", "percent",
    "currency", "dateTime",
    "checkbox", "file", "image",
  ]);
});

test("allows only superadmin, admin, and manager to manage custom fields", () => {
  assert.equal(canManageCustomFields("superadmin"), true);
  assert.equal(canManageCustomFields("admin"), true);
  assert.equal(canManageCustomFields("manager"), true);
  assert.equal(canManageCustomFields("user"), false);
  assert.equal(canManageCustomFields("unknown"), false);
});

test("resolves companyCode before centerId", async () => {
  assert.equal(await resolveCustomFieldTenant({ companyCode: "company-a", centerId: "center-a" }), "company-a");
});

test("falls back to centerId when companyCode is absent", async () => {
  assert.equal(await resolveCustomFieldTenant({ centerId: "center-a" }), "center-a");
});

test("rejects a user without a tenant", async () => {
  await assert.rejects(() => resolveCustomFieldTenant({}));
});

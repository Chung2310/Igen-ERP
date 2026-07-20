import assert from "node:assert/strict";
import test from "node:test";
import { customFieldDefinitionSchema } from "./custom-field-definition.model";

test("defines the unique tenant, module, and key index", () => {
  const indexes = customFieldDefinitionSchema.indexes();

  assert.ok(
    indexes.some(
      ([keys, options]) =>
        JSON.stringify(keys) === JSON.stringify({ tenantId: 1, moduleKey: 1, key: 1 }) &&
        options.unique === true,
    ),
  );
});

test("defines the tenant query and display-order index", () => {
  const indexes = customFieldDefinitionSchema.indexes();

  assert.ok(
    indexes.some(
      ([keys]) =>
        JSON.stringify(keys) ===
        JSON.stringify({ tenantId: 1, moduleKey: 1, isArchived: 1, order: 1 }),
    ),
  );
});

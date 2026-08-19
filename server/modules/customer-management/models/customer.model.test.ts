import assert from "node:assert/strict";
import test from "node:test";
import { CustomerModel } from "./customer.model";

test("customer schema enforces company-wide permanent identities", () => {
  const indexes = CustomerModel.schema.indexes();
  assert.ok(indexes.some(([fields, options]) => fields.companyCode === 1 && fields.customerCode === 1 && options.unique === true));
  assert.ok(indexes.some(([fields, options]) => fields.companyCode === 1 && fields.normalizedPhone === 1 && options.unique === true));
});

test("customer schema supports active listing and optimistic concurrency", () => {
  const indexes = CustomerModel.schema.indexes();
  assert.ok(indexes.some(([fields]) => fields.companyCode === 1 && fields.status === 1 && fields.name === 1));
  assert.equal(CustomerModel.schema.path("version").getDefault(undefined, false), 0);
  assert.equal(CustomerModel.schema.path("status").getDefault(undefined, false), "active");
});

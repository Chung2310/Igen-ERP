import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomerListFilter, createCustomerService } from "./customer.service";

const scope = { companyCode: "IGEN" };
const actor = { id: "u1", name: "Nguyễn Admin" };
const stored = {
  _id: "507f1f77bcf86cd799439011", companyCode: "IGEN", customerCode: "KH-IGEN-000001",
  name: "An", phone: "0901", normalizedPhone: "0901", type: "regular" as const,
  status: "active" as const, source: "manual" as const, createdBy: "u1", createdByName: "Nguyễn Admin", version: 0,
};

function repository(overrides: Record<string, unknown> = {}) {
  return {
    list: async () => [stored], count: async () => 1, nextSequence: async () => 1,
    findByPhone: async () => null, create: async (value: any) => ({ _id: stored._id, ...value }),
    findById: async () => stored, updateWithVersion: async () => ({ ...stored, version: 1 }),
    setStatus: async (_scope: any, _id: string, _version: number, status: string) => ({ ...stored, status, version: 1 }),
    ...overrides,
  } as any;
}

test("customer list defaults to active and escapes literal search", () => {
  const filter = buildCustomerListFilter(scope, { q: "A.+", page: 1, limit: 20 });
  assert.equal(filter.companyCode, "IGEN");
  assert.equal(filter.status, "active");
  assert.ok(String((filter.$or as any[])[0].customerCode).includes("A\\.\\+"));
});

test("customer list is company-wide and caps page size", async () => {
  let received: any;
  const service = createCustomerService(repository({ list: async (...args: any[]) => { received = args; return [stored]; } }));
  const result = await service.list(scope, { status: "inactive", type: "vat", page: 2, limit: 999 });
  assert.deepEqual(received.slice(1), [100, 100]);
  assert.deepEqual(received[0], { companyCode: "IGEN", status: "inactive", type: "vat" });
  assert.equal(result.limit, 100);
});

test("create allocates a permanent code and rejects duplicate phone", async () => {
  const service = createCustomerService(repository());
  const created = await service.create(scope, { name: "An", phone: "0901" }, actor);
  assert.equal(created.customerCode, "KH-IGEN-000001");
  assert.equal(created.companyCode, "IGEN");

  const duplicate = createCustomerService(repository({ findByPhone: async () => stored }));
  await assert.rejects(() => duplicate.create(scope, { name: "Bình", phone: "0901" }, actor), (error: any) => error.code === "CUSTOMER_PHONE_EXISTS");
});

test("update uses company and version and reports a stale write", async () => {
  let received: any;
  const service = createCustomerService(repository({ updateWithVersion: async (...args: any[]) => { received = args; return { ...stored, version: 3 }; } }));
  await service.update(scope, stored._id, { name: "An mới", phone: "0902" }, 2);
  assert.deepEqual(received.slice(0, 3), [scope, stored._id, 2]);

  const stale = createCustomerService(repository({ updateWithVersion: async () => null, findById: async () => stored }));
  await assert.rejects(() => stale.update(scope, stored._id, { name: "An", phone: "0901" }, 9), (error: any) => error.code === "CUSTOMER_VERSION_CONFLICT");
});

test("status transitions preserve the customer and increment version", async () => {
  let received: any;
  const service = createCustomerService(repository({ setStatus: async (...args: any[]) => { received = args; return { ...stored, status: args[3], version: 1 }; } }));
  const result = await service.setStatus(scope, stored._id, "inactive", 0);
  assert.deepEqual(received, [scope, stored._id, 0, "inactive"]);
  assert.equal(result.status, "inactive");
});

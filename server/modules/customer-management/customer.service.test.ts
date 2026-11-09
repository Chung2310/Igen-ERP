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

  const phoneFilter = buildCustomerListFilter(scope, { q: "+84 901-234-567" });
  assert.ok((phoneFilter.$or as any[]).some((entry) => String(entry.normalizedPhone).includes("0901234567")));
  assert.ok((phoneFilter.$or as any[]).some((entry) => String(entry.normalizedPhone).includes("84901234567")));
  const nameFilter = buildCustomerListFilter(scope, { q: "iPhone 15" });
  assert.equal((nameFilter.$or as any[]).filter((entry) => entry.normalizedPhone).length, 1);
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

test("create and update preserve extra facts without copying stored metadata into notes", async () => {
  let current: any = { ...stored, notes: "Khách thân thiết", legacyInternalFlag: "internal" };
  const service = createCustomerService(repository({
    findById: async () => current,
    updateWithVersion: async (_scope: any, _id: string, _version: number, values: any) => (current = { ...current, ...values, version: current.version + 1 }),
  }));
  const created = await service.create(scope, { name: "An", phone: "0901", "Ngân sách": "50 triệu" }, actor);
  assert.equal(created.notes, "Ngân sách: 50 triệu");
  const updated = await service.update(scope, stored._id, { "Giờ liên hệ": "Buổi chiều" }, 0);
  assert.equal(updated.notes, "Khách thân thiết\nGiờ liên hệ: Buổi chiều");
  const retried = await service.update(scope, stored._id, { "Giờ liên hệ": "Buổi chiều" }, 1);
  assert.equal(retried.notes, updated.notes);
  const supplemented = await service.update(scope, stored._id, { additionalNotes: "Ngân sách: 50 triệu\nGiờ liên hệ: Buổi chiều" }, 2);
  assert.equal(supplemented.notes, "Khách thân thiết\nGiờ liên hệ: Buổi chiều\nNgân sách: 50 triệu");
});

test("appending notes retries a concurrent edit and avoids a second write on replay", async () => {
  let current: any = { ...stored, notes: "Ghi chú cũ" };
  let writes = 0;
  const service = createCustomerService(repository({
    findById: async (receivedScope: any) => { assert.deepEqual(receivedScope, scope); return current; },
    updateWithVersion: async (_scope: any, _id: string, version: number, values: any) => {
      writes += 1;
      if (writes === 1) { current = { ...current, notes: "Ghi chú cũ\nNhân viên vừa cập nhật", version: 1 }; return null; }
      assert.equal(version, 1);
      assert.deepEqual(Object.keys(values), ["notes"]);
      return (current = { ...current, ...values, version: version + 1 });
    },
  }));
  const updated = await service.appendNotes(scope, stored._id, ["Ngân sách: 50 triệu", "Ngân sách: 50 triệu"]);
  assert.equal(updated.notes, "Ghi chú cũ\nNhân viên vừa cập nhật\nNgân sách: 50 triệu");
  await service.appendNotes(scope, stored._id, ["Ngân sách: 50 triệu"]);
  assert.equal(writes, 2);
});

test("appending notes cannot update another company's customer or ignore repeated version conflicts", async () => {
  let writes = 0;
  const missing = createCustomerService(repository({ findById: async () => null, updateWithVersion: async () => { writes += 1; } }));
  await assert.rejects(() => missing.appendNotes(scope, stored._id, ["Ghi chú"]), (error: any) => error.code === "CUSTOMER_NOT_FOUND");
  assert.equal(writes, 0);
  const stale = createCustomerService(repository({ updateWithVersion: async () => { writes += 1; return null; } }));
  await assert.rejects(() => stale.appendNotes(scope, stored._id, ["Ghi chú"]), (error: any) => error.code === "CUSTOMER_VERSION_CONFLICT");
  assert.equal(writes, 3);
});

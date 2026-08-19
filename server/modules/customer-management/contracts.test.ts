import assert from "node:assert/strict";
import test from "node:test";
import { createCustomerContracts } from "./contracts";

const customer = {
  _id: "c1", companyCode: "IGEN", customerCode: "KH-IGEN-000001", name: "An", phone: "0901",
  normalizedPhone: "0901", type: "regular", status: "active", source: "manual", createdBy: "u1", createdByName: "Admin", version: 0,
};

test("search contract returns compact active customer data", async () => {
  let received: any;
  const contracts = createCustomerContracts({
    list: async (...args: any[]) => { received = args; return { items: [customer], total: 1, page: 1, limit: 10 }; },
  } as any);
  const result = await contracts.searchActiveCustomers({ companyCode: "IGEN" }, " An ", 99);
  assert.deepEqual(received, [{ companyCode: "IGEN" }, { q: "An", status: "active", page: 1, limit: 20 }]);
  assert.deepEqual(result, [{ customerId: "c1", customerCode: "KH-IGEN-000001", name: "An", phone: "0901", type: "regular", status: "active" }]);
});

test("brief lookup hides inactive customers unless requested", async () => {
  const inactive = { ...customer, status: "inactive" };
  const contracts = createCustomerContracts({ detail: async () => inactive } as any);
  assert.equal(await contracts.getCustomerBrief({ companyCode: "IGEN" }, "c1"), null);
  assert.equal((await contracts.getCustomerBrief({ companyCode: "IGEN" }, "c1", { includeInactive: true }))?.customerId, "c1");
});

test("quick create uses the full customer creation service", async () => {
  let received: any;
  const contracts = createCustomerContracts({ create: async (...args: any[]) => { received = args; return customer; } } as any);
  const result = await contracts.quickCreateCustomer({ companyCode: "IGEN" }, { name: "An", phone: "0901" }, { id: "u1", name: "Admin" });
  assert.deepEqual(received, [{ companyCode: "IGEN" }, { name: "An", phone: "0901", source: "pos" }, { id: "u1", name: "Admin" }]);
  assert.equal(result.customerId, "c1");
});

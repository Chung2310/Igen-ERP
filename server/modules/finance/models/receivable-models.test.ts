import assert from "node:assert/strict";
import test from "node:test";
import { ReceivableEntryModel } from "./receivable-entry.model";
import { ReceivableModel } from "./receivable.model";

function hasIndex(model: any, keys: Record<string, number>, unique = false) {
  return model.schema.indexes().some(([actualKeys, options]: [Record<string, number>, any]) =>
    Object.entries(keys).every(([key, value]) => actualKeys[key] === value)
      && (!unique || options.unique === true));
}

test("receivable header carries source, customer, balance, status, and reminder state", () => {
  for (const path of [
    "companyCode", "branchId", "receivableCode", "customerId", "customerName", "sourceType", "sourceId",
    "sourceCode", "sourceEventId", "occurredAt", "dueDate", "originalAmount", "paidAmount", "adjustedAmount",
    "balance", "status", "daysOverdue", "lastReminderAt", "reminderCount", "reminderSuspendedUntil",
    "reminderSuspendReason",
  ]) assert.ok(ReceivableModel.schema.path(path), `${path} must exist`);

  assert.deepEqual((ReceivableModel.schema.path("status") as any).enumValues, ["open", "partially_paid", "settled", "void", "written_off"]);
});

test("receivable header has unique identities and hot query indexes", () => {
  assert.ok(hasIndex(ReceivableModel, { companyCode: 1, receivableCode: 1 }, true));
  assert.ok(hasIndex(ReceivableModel, { companyCode: 1, sourceEventId: 1 }, true));
  assert.ok(hasIndex(ReceivableModel, { companyCode: 1, sourceType: 1, sourceId: 1 }, true));
  assert.ok(hasIndex(ReceivableModel, { companyCode: 1, branchId: 1, status: 1, dueDate: 1 }));
  assert.ok(hasIndex(ReceivableModel, { companyCode: 1, customerId: 1, status: 1 }));
});

test("receivable entry is an append-only audit record with reversal protection", () => {
  for (const path of [
    "companyCode", "branchId", "receivableId", "customerId", "type", "amount", "balanceAfter", "reason",
    "paymentMethod", "reference", "sourceEventId", "idempotencyKey", "reversalOfEntryId", "previousDueDate", "newDueDate", "createdBy", "createdByName",
  ]) assert.ok(ReceivableEntryModel.schema.path(path), `${path} must exist`);

  assert.deepEqual((ReceivableEntryModel.schema.path("type") as any).enumValues, ["charge", "payment", "adjustment", "refund", "write_off", "reversal", "due_date_extension"]);
  assert.ok(hasIndex(ReceivableEntryModel, { companyCode: 1, idempotencyKey: 1 }, true));
  assert.ok(hasIndex(ReceivableEntryModel, { companyCode: 1, sourceEventId: 1 }, true));
  assert.ok(hasIndex(ReceivableEntryModel, { companyCode: 1, reversalOfEntryId: 1 }, true));
  assert.ok(hasIndex(ReceivableEntryModel, { companyCode: 1, receivableId: 1, createdAt: 1 }));
  for (const method of ["updateEntry", "deleteEntry", "removeEntry"]) {
    assert.equal(ReceivableEntryModel.schema.methods[method], undefined, `${method} must not mutate the append-only ledger`);
  }
});

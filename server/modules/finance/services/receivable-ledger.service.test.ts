import assert from "node:assert/strict";
import test from "node:test";
import { createReceivableLedgerService, type ReceivableLedgerRepository } from "./receivable-ledger.service";

type State = { receivables: any[]; entries: any[] };

function memoryRepository(initial?: State) {
  let state: State = structuredClone(initial || { receivables: [], entries: [] });
  let failNextEntry = false;
  let sequence = 0;
  const repository: ReceivableLedgerRepository = {
    async transaction(work) {
      const snapshot = structuredClone(state);
      try { return await work({}); }
      catch (error) { state = snapshot; throw error; }
    },
    async findBySourceEvent(scope, sourceEventId) {
      return state.receivables.find((item) => item.companyCode === scope.companyCode && item.branchId === scope.branchId && item.sourceEventId === sourceEventId) || null;
    },
    async findById(scope, id) {
      return state.receivables.find((item) => item._id === id && item.companyCode === scope.companyCode && item.branchId === scope.branchId) || null;
    },
    async findBySource(scope, sourceType, sourceId) {
      return state.receivables.find((item) => item.companyCode === scope.companyCode && item.branchId === scope.branchId && item.sourceType === sourceType && item.sourceId === sourceId) || null;
    },
    async createReceivable(values) {
      const item = { _id: `r${++sequence}`, ...structuredClone(values) };
      state.receivables.push(item); return item;
    },
    async updateReceivable(_scope, id, values) {
      const index = state.receivables.findIndex((item) => item._id === id);
      state.receivables[index] = { ...state.receivables[index], ...structuredClone(values) };
      return state.receivables[index];
    },
    async createEntry(values) {
      if (failNextEntry) { failNextEntry = false; throw new Error("entry insert failed"); }
      const item = { _id: `e${++sequence}`, ...structuredClone(values) };
      state.entries.push(item); return item;
    },
    async findEntry(scope, receivableId, entryId) {
      return state.entries.find((item) => item._id === entryId && item.receivableId === receivableId && item.companyCode === scope.companyCode) || null;
    },
    async findReversal(scope, receivableId, entryId) {
      return state.entries.find((item) => item.receivableId === receivableId && item.reversalOfEntryId === entryId && item.companyCode === scope.companyCode) || null;
    },
    async findByIdempotency(scope, idempotencyKey) {
      return state.entries.find((item) => item.companyCode === scope.companyCode && item.branchId === scope.branchId && item.idempotencyKey === idempotencyKey) || null;
    },
  };
  return {
    repository,
    snapshot: () => structuredClone(state),
    failEntry: () => { failNextEntry = true; },
  };
}

const scope = { companyCode: "ACME", branchId: "B1" };
const actor = { id: "u1", name: "Kế toán" };
const openInput = {
  receivableCode: "CN-0001", sourceType: "retail_order", sourceId: "o1", sourceCode: "DH-1",
  sourceEventId: "event-confirm-1", customerId: "c1", customerName: "Khách A", originalAmount: 100_000,
  occurredAt: new Date("2026-08-01T00:00:00.000Z"), dueDate: new Date("2026-08-10T00:00:00.000Z"),
};

test("opening creates the header and charge atomically while event replay returns the original", async () => {
  const memory = memoryRepository();
  const ledger = createReceivableLedgerService(memory.repository);
  const opened = await ledger.openFromEvent(scope, openInput, actor);
  const replay = await ledger.openFromEvent(scope, openInput, actor);
  const state = memory.snapshot();
  assert.equal(replay._id, opened._id);
  assert.equal(state.receivables.length, 1);
  assert.deepEqual(state.entries.map((entry) => [entry.type, entry.amount, entry.balanceAfter]), [["charge", 100_000, 100_000]]);
  assert.equal(state.receivables[0].balance, 100_000);
});

test("entry failure rolls the whole operation back", async () => {
  const memory = memoryRepository();
  memory.failEntry();
  await assert.rejects(() => createReceivableLedgerService(memory.repository).openFromEvent(scope, openInput, actor), /entry insert failed/);
  assert.deepEqual(memory.snapshot(), { receivables: [], entries: [] });
});

test("payment, adjustment, write-off, and reversal update caches without mutating original entries", async () => {
  const memory = memoryRepository();
  const ledger = createReceivableLedgerService(memory.repository);
  const opened = await ledger.openFromEvent(scope, openInput, actor);
  const payment = await ledger.collect(scope, opened._id, { amount: 30_000, paymentMethod: "transfer", idempotencyKey: "pay-1" }, actor);
  assert.equal(payment.receivable.status, "partially_paid");
  assert.equal(payment.receivable.paidAmount, 30_000);
  await assert.rejects(() => ledger.adjust(scope, opened._id, { amount: 5_000, direction: "increase", reason: "", idempotencyKey: "adj-bad" }, actor), /REASON_REQUIRED/);
  const adjustment = await ledger.adjust(scope, opened._id, { amount: 5_000, direction: "increase", reason: "Phí bổ sung", idempotencyKey: "adj-1" }, actor);
  assert.equal(adjustment.receivable.adjustedAmount, 5_000);
  const reversal = await ledger.reverse(scope, opened._id, adjustment.entry._id, { reason: "Nhập nhầm", idempotencyKey: "rev-1" }, actor);
  assert.equal(reversal.receivable.balance, 70_000);
  assert.equal(memory.snapshot().entries.find((entry) => entry._id === adjustment.entry._id).amount, 5_000);
  const writtenOff = await ledger.writeOff(scope, opened._id, { reason: "Được duyệt xóa nợ", idempotencyKey: "wo-1" }, actor);
  assert.equal(writtenOff.receivable.balance, 0);
  assert.equal(writtenOff.receivable.status, "written_off");
  await assert.rejects(() => ledger.reverse(scope, opened._id, adjustment.entry._id, { reason: "Lặp", idempotencyKey: "rev-2" }, actor), /ENTRY_ALREADY_REVERSED/);
});

test("reversing a payment restores paid cache without changing adjusted cache", async () => {
  const memory = memoryRepository();
  const ledger = createReceivableLedgerService(memory.repository);
  const opened = await ledger.openFromEvent(scope, openInput, actor);
  const payment = await ledger.collect(scope, opened._id, { amount: 30_000, paymentMethod: "cash", idempotencyKey: "pay-reverse" }, actor);
  const reversed = await ledger.reverse(scope, opened._id, payment.entry._id, { reason: "Thanh toán lỗi", idempotencyKey: "reverse-payment" }, actor);
  assert.equal(reversed.receivable.balance, 100_000);
  assert.equal(reversed.receivable.paidAmount, 0);
  assert.equal(reversed.receivable.adjustedAmount, 0);
  assert.equal(reversed.receivable.status, "open");
});

test("source event commands collect and void without deleting ledger history", async () => {
  const memory = memoryRepository();
  const ledger = createReceivableLedgerService(memory.repository);
  await ledger.openFromEvent(scope, openInput, actor);
  const paid = await ledger.settleFromEvent(scope, "retail_order", "o1", { amount: 30_000, paymentMethod: "retail", idempotencyKey: "evt-paid" }, actor);
  assert.equal(paid.receivable.balance, 70_000);
  const voided = await ledger.voidFromEvent(scope, "retail_order", "o1", { remainingDebt: 70_000, refundedAmount: 30_000, reason: "Hủy đơn", idempotencyKey: "evt-cancel" }, actor);
  assert.equal(voided.receivable.balance, 0);
  assert.equal(voided.receivable.status, "void");
  assert.deepEqual(memory.snapshot().entries.map((entry) => entry.type), ["charge", "payment", "reversal"]);
});

test("replaying a settling payment does not publish settled twice", async () => {
  const memory = memoryRepository();
  const settled: any[] = [];
  const ledger = createReceivableLedgerService(memory.repository, async (receivable) => { settled.push(receivable); });
  const opened = await ledger.openFromEvent(scope, openInput, actor);
  const command = { amount: 100_000, paymentMethod: "retail", idempotencyKey: "settle-once" };
  await ledger.collect(scope, opened._id, command, actor);
  await ledger.collect(scope, opened._id, command, actor);
  assert.equal(settled.length, 1);
  assert.equal(memory.snapshot().entries.length, 2);
});

test("reminder suspension updates only an active scoped receivable", async () => {
  const memory = memoryRepository();
  const ledger = createReceivableLedgerService(memory.repository);
  const opened = await ledger.openFromEvent(scope, openInput, actor);
  const until = new Date("2026-08-30T00:00:00.000Z");
  const suspended = await ledger.suspend(scope, opened._id, { until, reason: "Chờ đối soát" }, actor);
  assert.equal(suspended.reminderSuspendedUntil.toISOString(), until.toISOString());
  assert.equal(suspended.reminderSuspendReason, "Chờ đối soát");
});

test("legacy import writes header and chronological entries atomically and replays safely", async () => {
  const memory = memoryRepository();
  const ledger = createReceivableLedgerService(memory.repository);
  const candidate: any = {
    ...scope, receivableCode: "CN-LEGACY-DH1", sourceType: "retail_order", sourceId: "o1", sourceCode: "DH1",
    sourceEventId: "legacy:retail-order:o1", customerId: "c1", customerName: "Khách", occurredAt: new Date("2026-08-01"),
    dueDate: new Date("2026-08-20"), originalAmount: 100, paidAmount: 30, adjustedAmount: 0, balance: 70, status: "partially_paid",
    entries: [
      { type: "charge", amount: 100, idempotencyKey: "legacy:e1", createdBy: "u1", createdByName: "A" },
      { type: "payment", amount: -30, idempotencyKey: "legacy:e2", createdBy: "u1", createdByName: "A" },
    ],
  };
  const imported = await ledger.importLegacy(candidate);
  const replay = await ledger.importLegacy(candidate);
  assert.equal(replay._id, imported._id);
  assert.equal(memory.snapshot().receivables.length, 1);
  assert.deepEqual(memory.snapshot().entries.map((entry) => entry.balanceAfter), [100, 70]);
});

test("header balance equals the sum of entries after every operation in a deterministic 20-step sequence", async () => {
  const memory = memoryRepository();
  const ledger = createReceivableLedgerService(memory.repository);
  const opened = await ledger.openFromEvent(scope, { ...openInput, originalAmount: 1_000_000 }, actor);
  const adjustments: string[] = [];
  for (let step = 1; step <= 20; step += 1) {
    if (step % 4 === 0) {
      const entryId = adjustments.shift();
      if (entryId) await ledger.reverse(scope, opened._id, entryId, { reason: `Đảo ${step}`, idempotencyKey: `rev-${step}` }, actor);
    } else if (step % 2 === 0) {
      await ledger.collect(scope, opened._id, { amount: 1_000, paymentMethod: "cash", idempotencyKey: `pay-${step}` }, actor);
    } else {
      const result = await ledger.adjust(scope, opened._id, { amount: 2_000, direction: "increase", reason: `Điều chỉnh ${step}`, idempotencyKey: `adj-${step}` }, actor);
      adjustments.push(result.entry._id);
    }
    const state = memory.snapshot();
    const header = state.receivables[0];
    const sum = state.entries.reduce((total, entry) => total + entry.amount, 0);
    assert.equal(header.balance, sum, `balance mismatch after operation ${step}`);
  }
});

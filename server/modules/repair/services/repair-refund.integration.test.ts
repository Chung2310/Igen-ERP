import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepairTicketModel } from '../repair-ticket.model';
import { RepairRefundRequestModel } from '../repair-refund-request.model';
import { FinanceCashAccountModel, FinanceCashVoucherModel, FinanceClosedPeriodModel, FinancePostingGuardModel } from '../../finance/models/finance-treasury.model';
import { RetailCommissionAccountModel, RetailCommissionLedgerModel } from '../../retail/models/retail-commission.model';
import { CustomerModel } from '../../customer-management/models/customer.model';
import { RetailOrderModel } from '../../retail/models/retail-order.model';
import { RetailAfterSaleModel } from '../../retail/models/retail-after-sale.model';
import { postRepairRefund, reconcileRepairRefund, repairRefundSummary, repairRefundVouchers, revokeRepairRefund } from './repair-refund.service';
import { getCustomerTransactionDetail, getCustomerTransactions } from '../../customer-management/customer-transactions.service';
import { verifiedRepairRefunds } from './repair-refunds';
import { financeToday } from '../../finance/services/financial-calculations';
import { repairRevenueReport } from './repair-report.service';
import { RepairPaymentModel } from '../repair-payment.model';
import type { RepairRefundInput } from '../../../../shared/repair-refund';

const oid = () => new mongoose.Types.ObjectId().toString();
const scope = { companyCode: 'REPAIR_REFUNDS', branchId: 'branch-a' }, actor = { id: 'manager-a', name: 'Quản lý' };
const customerId = oid(), accountId = oid(), ticketId = oid(), partnerId = oid();
const day = financeToday(), completedAt = new Date(`${day}T00:00:00+07:00`);
const models = [RepairTicketModel, RepairPaymentModel, RepairRefundRequestModel, FinanceCashAccountModel, FinanceCashVoucherModel, FinanceClosedPeriodModel, FinancePostingGuardModel, RetailCommissionAccountModel, RetailCommissionLedgerModel, CustomerModel, RetailOrderModel, RetailAfterSaleModel];
let replica: MongoMemoryReplSet;
const request = (key = 'refund-request-001', amount = 80000, laborAmount = 40000): RepairRefundInput => ({ idempotencyKey: key, amount, laborAmount, reference: 'PC-001', reason: 'Hoàn phần dịch vụ theo thỏa thuận' });
async function voucher(key = 'PC-001', amount = 80000) {
  return FinanceCashVoucherModel.create({ ...scope, key, accountId, kind: 'payment', amount, occurredOn: day, description: 'Hoàn dịch vụ', reference: 'SC-001', status: 'posted', approvedBy: 'finance-a', approvedAt: new Date(), createdBy: 'finance-a' });
}
async function order(code = 'DH-001', id = oid()) {
  await RetailOrderModel.collection.insertOne({ _id: new mongoose.Types.ObjectId(id), ...scope, customerId, orderCode: code, status: 'completed', businessDate: day, completedAt, createdAt: completedAt, grandTotal: 300000, paidAmount: 300000, dueAmount: 0, items: [{ productName: 'Thiết bị công nghiệp', sku: 'SKU', quantity: 1, unitPrice: 300000, unitCost: 123456, lineTotal: 300000 }], payments: [{ amount: 300000, paidAt: completedAt, method: 'cash' }], refunds: [] });
  return id;
}
beforeAll(async () => { replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replica.getUri()); await Promise.all(models.map((model) => model.init())); }, 60000);
beforeEach(async () => {
  vi.restoreAllMocks();
  for (const model of models) await model.collection.deleteMany({});
  await CustomerModel.create({ _id: customerId, companyCode: scope.companyCode, customerCode: 'KH-001', name: 'Công ty khách hàng', phone: '0901000001', normalizedPhone: '0901000001', createdBy: actor.id, createdByName: actor.name });
  await RepairTicketModel.create({ _id: ticketId, ...scope, ticketCode: 'SC-001', customerId, customerName: 'Công ty khách hàng', customerPhone: '0901000001', device: { name: 'Máy bơm', condition: 'Đã kiểm tra', accessories: [] }, symptom: 'Kiểm tra vận hành', coverage: { costBearer: 'customer', checkedAt: completedAt }, status: 'delivered', laborFee: 100000, partRevenue: 100000, partCost: 25000, totalAmount: 200000, paidAmount: 200000, dueAmount: 0, paymentStatus: 'paid', receivedAt: completedAt, completedAt, deliveredAt: completedAt, createdBy: actor.id, createdByName: actor.name, feedbackToken: 'private-feedback-token' });
  await FinanceCashAccountModel.create({ _id: accountId, ...scope, name: 'Quỹ', kind: 'cash', openingOn: day, openingBalance: 1000000, balance: 920000 });
  await RetailCommissionLedgerModel.create({ ...scope, partnerId, sourceKey: `repair:${ticketId}:labor`, sourceType: 'repair', sourceId: ticketId, sourceCode: 'SC-001', businessDate: day, amount: 10000, baseAmount: 100000, ratePercent: 10, rateType: 'percent', rateValue: 10, policyId: oid() });
  await RetailCommissionAccountModel.create({ companyCode: scope.companyCode, partnerId, balance: 10000 });
  await voucher();
});
afterAll(async () => { await mongoose.disconnect(); await replica.stop(); });

describe('repair refund bookkeeping', () => {
  it('links an already posted voucher atomically without spending again or erasing the original receipt', async () => {
    const result = await postRepairRefund(scope, ticketId, request(), actor);
    expect(result).toMatchObject({ status: 'completed', summary: { refundedAmount: 80000, paidAmount: 200000, netCollected: 120000, remaining: 120000, remainingLabor: 60000, remainingOther: 60000 } });
    const ticket = await RepairTicketModel.findById(ticketId).lean();
    expect(ticket).toMatchObject({ totalAmount: 200000, paidAmount: 200000, dueAmount: 0, paymentStatus: 'paid' });
    expect((await FinanceCashAccountModel.findById(accountId).lean())?.balance).toBe(920000);
    expect((await FinanceCashVoucherModel.findOne({ key: 'PC-001' }).lean())?.sourceKey).toBe(`repair-refund:${ticketId}:refund-request-001`);
    expect((await RetailCommissionAccountModel.findOne({ partnerId }).lean())?.balance).toBe(6000);
    expect(await verifiedRepairRefunds(scope, completedAt, new Date(+completedAt + 86400000))).toHaveLength(1);
  });
  it('returns the same result on retries and rejects reuse with another payload, actor or branch', async () => {
    await postRepairRefund(scope, ticketId, request(), actor);
    expect((await postRepairRefund(scope, ticketId, request(), actor)).status).toBe('completed');
    expect((await reconcileRepairRefund(scope, ticketId, request(), actor)).status).toBe('completed');
    await expect(postRepairRefund(scope, ticketId, { ...request(), amount: 70000 }, actor)).rejects.toMatchObject({ code: 'REPAIR_REFUND_KEY_CONFLICT' });
    await expect(postRepairRefund(scope, ticketId, request(), { ...actor, id: 'someone-else' })).rejects.toMatchObject({ code: 'REPAIR_REFUND_KEY_CONFLICT' });
    await expect(postRepairRefund({ ...scope, branchId: 'branch-b' }, ticketId, request(), actor)).rejects.toMatchObject({ code: 'REPAIR_REFUND_KEY_CONFLICT' });
    expect(await RepairRefundRequestModel.countDocuments({ status: 'completed' })).toBe(1);
    expect((await RepairTicketModel.findById(ticketId).lean())?.commissionRefunds).toHaveLength(1);
  });
  it('fully reverses the original commission across partial refunds and caps money to what was collected', async () => {
    await postRepairRefund(scope, ticketId, request(), actor);
    await voucher('PC-002', 120000);
    await postRepairRefund(scope, ticketId, { ...request('refund-request-002', 120000, 60000), reference: 'PC-002' }, actor);
    expect(await repairRefundSummary(scope, ticketId)).toMatchObject({ remaining: 0, netCollected: 0, remainingLabor: 0, remainingOther: 0 });
    expect((await RetailCommissionAccountModel.findOne({ partnerId }).lean())?.balance).toBe(0);
    const reversals = await RetailCommissionLedgerModel.find({ ...scope, sourceType: 'repair-refund', sourceId: ticketId }).sort({ businessDate: 1, createdAt: 1 }).lean();
    expect(reversals.map((entry) => entry.baseAmount)).toEqual([-40000, -60000]);
    expect(reversals.reduce((sum, entry) => sum + entry.amount, 0)).toBe(-10000);
    await expect(postRepairRefund(scope, ticketId, request('refund-request-003', 1, 0), actor)).rejects.toMatchObject({ code: 'REPAIR_REFUND_EXCEEDS_BALANCE' });
  });
  it('allows only one of two concurrent over-refunds and never uses the same voucher twice', async () => {
    await voucher('PC-A', 150000); await voucher('PC-B', 150000);
    const results = await Promise.allSettled(['A', 'B'].map((key) => postRepairRefund(scope, ticketId, { ...request(`concurrent-${key}`, 150000, 75000), reference: `PC-${key}` }, actor)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await repairRefundSummary(scope, ticketId)).refundedAmount).toBe(150000);
  });
  it('blocks a late post after revocation and preserves completed refunds when revocation is retried', async () => {
    expect((await revokeRepairRefund(scope, ticketId, request(), actor)).status).toBe('revoked');
    expect((await postRepairRefund(scope, ticketId, request(), actor)).status).toBe('revoked');
    expect((await repairRefundSummary(scope, ticketId)).refundedAmount).toBe(0);
    await postRepairRefund(scope, ticketId, request('another-request'), actor);
    expect((await revokeRepairRefund(scope, ticketId, request('another-request'), actor)).status).toBe('completed');
  });
  it('never links one posted voucher to two refunds under concurrent keys', async () => {
    const results = await Promise.allSettled(['first-intent', 'second-intent'].map((key) => postRepairRefund(scope, ticketId, request(key), actor)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await RepairRefundRequestModel.countDocuments({ status: 'completed' })).toBe(1);
    expect((await repairRefundSummary(scope, ticketId)).refundedAmount).toBe(80000);
  });
  it('rejects fractional VND, invalid allocations and vouchers dated before completion', async () => {
    await expect(postRepairRefund(scope, ticketId, { ...request(), amount: 1.5 }, actor)).rejects.toMatchObject({ code: 'REPAIR_REFUND_INPUT_INVALID' });
    await expect(postRepairRefund(scope, ticketId, { ...request(), laborAmount: 80001 }, actor)).rejects.toMatchObject({ code: 'REPAIR_REFUND_INPUT_INVALID' });
    const previousDay = financeToday(new Date(+completedAt - 86400000));
    await FinanceCashVoucherModel.updateOne({ key: 'PC-001' }, { $set: { occurredOn: previousDay } });
    await expect(postRepairRefund(scope, ticketId, request(), actor)).rejects.toMatchObject({ code: 'REPAIR_REFUND_DATE_INVALID' });
  });
  it('reports refunds on the Finance posting date while retaining original revenue totals', async () => {
    await postRepairRefund(scope, ticketId, request(), actor);
    const report = await repairRevenueReport(scope, { from: day, to: day });
    expect(report.refunds).toMatchObject({ amount: 80000, laborAmount: 40000, count: 1 });
    expect(report.total).toMatchObject({ ticketCount: 1, revenue: 200000 });
    expect(report.refunds.netRevenue).toBe(120000);
  });
  it('uses the same Vietnam day for revenue boundaries and grouping as refund postings', async () => {
    const original = (await RepairTicketModel.findById(ticketId).lean())!;
    const end = new Date(`${day}T23:59:59.999+07:00`);
    await RepairTicketModel.create([
      { ...original, _id: oid(), feedbackToken: undefined, ticketCode: 'SC-BEFORE', totalAmount: 400000, completedAt: new Date(+completedAt - 1) },
      { ...original, _id: oid(), feedbackToken: undefined, ticketCode: 'SC-LAST', totalAmount: 300000, completedAt: end },
      { ...original, _id: oid(), feedbackToken: undefined, ticketCode: 'SC-AFTER', totalAmount: 500000, completedAt: new Date(+end + 1) },
    ]);
    const report = await repairRevenueReport(scope, { from: day, to: day }, { groupBy: 'day' });
    expect(report.total).toMatchObject({ ticketCount: 2, revenue: 500000 });
    expect(report.items).toHaveLength(1);
    expect(report.items[0]).toMatchObject({ key: day, ticketCount: 2, revenue: 500000 });
  });
  it('rejects nonexistent calendar dates rather than silently reporting the following month', async () => {
    await expect(repairRevenueReport(scope, { from: '2026-02-31', to: '2026-03-03' })).rejects.toMatchObject({ statusCode: 400 });
  });
  it.each([
    ['wrong-reference', { reference: 'SC-OTHER' }], ['wrong-amount', { amount: 70000 }], ['not-posted', { status: 'pending' }], ['already-linked', { sourceType: 'another-source' }], ['wrong-branch', { branchId: 'branch-b' }],
  ])('rejects a voucher with %s', async (_, patch) => {
    await FinanceCashVoucherModel.updateOne({ key: 'PC-001' }, { $set: patch });
    await expect(postRepairRefund(scope, ticketId, request(), actor)).rejects.toMatchObject({ code: 'REPAIR_REFUND_VOUCHER_INVALID' });
    expect((await RepairTicketModel.findById(ticketId).lean())?.commissionRefunds || []).toHaveLength(0);
    expect(await RepairRefundRequestModel.countDocuments({})).toBe(0);
  });
  it('blocks locked accounting periods and refunds before delivery', async () => {
    await FinanceClosedPeriodModel.create({ ...scope, month: day.slice(0, 7), status: 'closed' });
    await expect(postRepairRefund(scope, ticketId, request(), actor)).rejects.toThrow('đã chốt');
    await FinanceClosedPeriodModel.deleteMany({});
    await RepairTicketModel.updateOne({ _id: ticketId }, { $set: { status: 'done' } });
    expect(await repairRefundVouchers(scope, ticketId)).toEqual([]);
    await expect(postRepairRefund(scope, ticketId, request(), actor)).rejects.toMatchObject({ code: 'REPAIR_REFUND_NOT_DELIVERED' });
  });
  it('rolls back voucher ownership, request and ticket when commission posting fails', async () => {
    vi.spyOn(RetailCommissionLedgerModel, 'create').mockRejectedValueOnce(new Error('Injected ledger failure'));
    await expect(postRepairRefund(scope, ticketId, request(), actor)).rejects.toThrow('Injected ledger failure');
    expect((await FinanceCashVoucherModel.findOne({ key: 'PC-001' }).lean())?.sourceKey).toBeUndefined();
    expect((await RepairTicketModel.findById(ticketId).lean())?.commissionRefunds || []).toHaveLength(0);
    expect(await RepairRefundRequestModel.countDocuments({})).toBe(0);
    expect((await RetailCommissionAccountModel.findOne({ partnerId }).lean())?.balance).toBe(10000);
  });
  it('keeps unconfirmed requests and detects changed evidence without posting again', async () => {
    expect((await reconcileRepairRefund(scope, ticketId, request(), actor)).status).toBe('not_found');
    await postRepairRefund(scope, ticketId, request(), actor);
    await FinanceCashVoucherModel.updateOne({ key: 'PC-001' }, { $set: { reference: 'tampered' } });
    await expect(reconcileRepairRefund(scope, ticketId, request(), actor)).rejects.toMatchObject({ code: 'REPAIR_REFUND_PROOF_CONFLICT' });
  });
});

describe('customer unified transactions', () => {
  it('combines sale, repair and refunds once, with safe details and permission-filtered totals', async () => {
    const orderId = await order();
    await RetailOrderModel.updateOne({ _id: orderId }, { $set: { refunds: [{ method: 'cash', amount: 20000, refundedAt: completedAt, refundedBy: actor.id, refundedByName: actor.name, businessDate: day, reason: 'Trả hàng' }] } });
    await postRepairRefund(scope, ticketId, request(), actor);
    const result = await getCustomerTransactions(scope, customerId, {}, true);
    expect(result.total).toBe(4);
    expect(result.summary).toEqual({ charged: 500000, received: 500000, refunded: 100000, buybackPaid: 0, outstanding: 0 });
    expect(result.items.map((row) => row.kind).sort()).toEqual(['repair', 'repair_refund', 'sale', 'sale_refund']);
    expect(JSON.stringify(result)).not.toContain('feedbackToken');
    expect(JSON.stringify(result)).not.toContain('unitCost');
    const detail = await getCustomerTransactionDetail(scope, customerId, 'sale', orderId, '', true);
    expect(detail.lines[0]).toMatchObject({ name: 'Thiết bị công nghiệp', quantity: 1, total: 300000 });
    expect(JSON.stringify(detail)).not.toContain('123456');
    const restricted = await getCustomerTransactions(scope, customerId, {}, false);
    expect(restricted.total).toBe(2);
    expect(restricted.summary).toMatchObject({ charged: 300000, received: 300000, refunded: 20000 });
    await expect(getCustomerTransactionDetail(scope, customerId, 'repair', ticketId, '', false)).rejects.toMatchObject({ status: 403 });
  });
  it('filters and paginates in the database with stable ordering for identical dates', async () => {
    for (let i = 0; i < 22; i++) await order(`DH-${i}`);
    const first = await getCustomerTransactions(scope, customerId, { type: 'sale', page: 1, limit: 20, from: day, to: day }, true);
    const second = await getCustomerTransactions(scope, customerId, { type: 'sale', page: 2, limit: 20, from: day, to: day }, true);
    expect(first.total).toBe(22); expect(first.items).toHaveLength(20); expect(second.items).toHaveLength(2);
    expect(new Set([...first.items, ...second.items].map((row) => row.id)).size).toBe(22);
    expect((await getCustomerTransactions(scope, customerId, { type: 'refund' }, true)).total).toBe(0);
  });
  it('supports historical customer codes but never reads another customer, company or branch', async () => {
    await RepairTicketModel.updateOne({ _id: ticketId }, { $set: { customerId: 'KH-001' } });
    expect((await getCustomerTransactions(scope, customerId, { type: 'repair' }, true)).total).toBe(1);
    expect((await getCustomerTransactions({ ...scope, branchId: 'branch-b' }, customerId, {}, true)).total).toBe(0);
    await expect(getCustomerTransactions({ ...scope, companyCode: 'OTHER' }, customerId, {}, true)).rejects.toMatchObject({ status: 404 });
    const other = oid();
    await CustomerModel.create({ _id: other, companyCode: scope.companyCode, customerCode: 'KH-002', name: 'Khách khác', phone: '0902000002', normalizedPhone: '0902000002', createdBy: actor.id, createdByName: actor.name });
    await expect(getCustomerTransactionDetail(scope, other, 'repair', ticketId, '', true)).rejects.toMatchObject({ status: 404 });
  });
});

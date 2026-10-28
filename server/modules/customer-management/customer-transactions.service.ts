import Joi from 'joi';
import { Types, type PipelineStage } from 'mongoose';
import type { CustomerTransactionDetail, CustomerTransactionKind, CustomerTransactionRow, CustomerTransactionsResult } from '../../../shared/customer-transactions';
import { CustomerService } from './customer.service';
import { CustomerError } from './customer-errors';
import { RetailOrderModel } from '../retail/models/retail-order.model';
import { RepairTicketModel } from '../repair/repair-ticket.model';
import { RepairPaymentModel } from '../repair/repair-payment.model';
import { RetailAfterSaleModel } from '../retail/models/retail-after-sale.model';
import { FinanceCashVoucherModel } from '../finance/models/finance-treasury.model';
import { validDay } from '../finance/services/financial-calculations';

type Scope = { companyCode: string; branchId: string };
const fail = (message: string, status = 400) => new CustomerError('CUSTOMER_TRANSACTION_INVALID', message, status);
const querySchema = Joi.object({
  type: Joi.string().valid('all', 'sale', 'repair', 'refund', 'buyback').default('all'),
  from: Joi.string().allow('').default(''), to: Joi.string().allow('').default(''),
  page: Joi.number().integer().min(1).max(10000).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
}).unknown(false);
const num = (field: string) => ({ $ifNull: [field, 0] });
const textId = { $toString: '$_id' };
const date = (field: string, fallback: unknown = '$createdAt') => ({ $ifNull: [field, { $ifNull: [fallback, new Date(0)] }] });
const saleDate = { $ifNull: ['$completedAt', { $dateFromString: { dateString: '$businessDate', timezone: '+07:00', onError: '$createdAt', onNull: '$createdAt' } }] };
const base = { eventId: { $literal: '' }, parentCode: { $literal: '' }, charged: { $literal: 0 }, received: { $literal: 0 }, refunded: { $literal: 0 }, buybackPaid: { $literal: 0 }, outstanding: { $literal: 0 }, paidAmount: { $literal: 0 }, dueAmount: { $literal: 0 } };
const literal = (value: string) => ({ $literal: value });

function pipelines(scope: Scope, customerId: string, customerCode: string, repairsVisible: boolean): PipelineStage[] {
  const orderMatch = { ...scope, customerId };
  const repairMatch = { ...scope, customerId: { $in: [customerId, customerCode] } };
  const stages: PipelineStage[] = [
    { $match: orderMatch },
    { $project: { ...base, _id: 0, id: { $concat: ['sale:', textId] }, kind: literal('sale'), sourceId: textId, code: { $ifNull: ['$orderCode', 'Đơn chưa đánh số'] }, occurredAt: date('$completedAt', saleDate), status: 1, amount: num('$grandTotal'), paidAmount: num('$paidAmount'), dueAmount: { $cond: [{ $eq: ['$status', 'confirmed'] }, num('$dueAmount'), 0] }, description: { $ifNull: [{ $arrayElemAt: ['$items.productName', 0] }, 'Đơn mua hàng'] }, charged: { $cond: [{ $in: ['$status', ['confirmed', 'completed']] }, num('$grandTotal'), 0] }, received: { $cond: [{ $ne: ['$status', 'draft'] }, num('$paidAmount'), 0] }, outstanding: { $cond: [{ $eq: ['$status', 'confirmed'] }, num('$dueAmount'), 0] } } },
    { $unionWith: { coll: RetailOrderModel.collection.name, pipeline: [
      { $match: orderMatch }, { $unwind: { path: '$refunds', includeArrayIndex: 'refundIndex' } },
      { $project: { ...base, _id: 0, id: { $concat: ['sale_refund:', textId, ':', { $toString: '$refundIndex' }] }, kind: literal('sale_refund'), sourceId: textId, eventId: { $toString: '$refundIndex' }, code: { $ifNull: ['$orderCode', 'Hoàn đơn mua hàng'] }, parentCode: '$orderCode', occurredAt: date('$refunds.refundedAt'), status: literal('posted'), amount: num('$refunds.amount'), description: { $ifNull: ['$refunds.reason', 'Hoàn tiền mua hàng'] }, refunded: num('$refunds.amount') } },
    ] } },
    { $unionWith: { coll: RetailAfterSaleModel.collection.name, pipeline: [
      { $match: { ...scope, customerId, type: 'buyback', status: 'completed' } },
      { $project: { ...base, _id: 0, id: { $concat: ['buyback:', textId] }, kind: literal('buyback'), sourceId: textId, code: '$code', parentCode: '$orderCode', occurredAt: date('$createdAt'), status: 1, amount: num('$totalAmount'), description: { $ifNull: ['$reason', 'Thu mua lại hàng'] }, buybackPaid: num('$totalAmount') } },
    ] } },
  ];
  if (repairsVisible) stages.push(
    { $unionWith: { coll: RepairTicketModel.collection.name, pipeline: [
      { $match: repairMatch },
      { $project: { ...base, _id: 0, id: { $concat: ['repair:', textId] }, kind: literal('repair'), sourceId: textId, code: '$ticketCode', occurredAt: date('$receivedAt'), status: 1, amount: num('$totalAmount'), paidAmount: num('$paidAmount'), dueAmount: { $cond: [{ $in: ['$status', ['cancelled', 'returned']] }, 0, num('$dueAmount')] }, description: '$device.name', charged: { $cond: [{ $in: ['$status', ['done', 'delivered']] }, num('$totalAmount'), 0] }, received: num('$paidAmount'), outstanding: { $cond: [{ $in: ['$status', ['cancelled', 'returned']] }, 0, num('$dueAmount')] } } },
    ] } },
    { $unionWith: { coll: RepairTicketModel.collection.name, pipeline: [
      { $match: repairMatch }, { $unwind: '$commissionRefunds' }, { $match: { 'commissionRefunds.financeVoucherId': { $type: 'string' } } },
      { $project: { ...base, _id: 0, id: { $concat: ['repair_refund:', textId, ':', '$commissionRefunds.key'] }, kind: literal('repair_refund'), sourceId: textId, eventId: '$commissionRefunds.key', code: '$ticketCode', parentCode: '$ticketCode', occurredAt: '$commissionRefunds.at', status: literal('posted'), amount: '$commissionRefunds.amount', description: '$commissionRefunds.reason', refunded: '$commissionRefunds.amount' } },
    ] } },
  );
  return stages;
}
function publicRow(row: CustomerTransactionRow & { occurredAt: Date | string }): CustomerTransactionRow {
  return { id: row.id, kind: row.kind, sourceId: row.sourceId, ...(row.eventId ? { eventId: row.eventId } : {}), code: row.code, ...(row.parentCode ? { parentCode: row.parentCode } : {}), occurredAt: new Date(row.occurredAt).toISOString(), status: row.status, amount: row.amount || 0, paidAmount: row.paidAmount || 0, dueAmount: row.dueAmount || 0, description: row.description || '' };
}
async function customerFor(scope: Scope, customerId: string) {
  if (!scope.companyCode || !scope.branchId) throw fail('Chọn doanh nghiệp và chi nhánh để xem giao dịch.');
  return CustomerService.detail({ companyCode: scope.companyCode }, customerId);
}
export async function getCustomerTransactions(scope: Scope, customerId: string, rawQuery: unknown, repairsVisible: boolean): Promise<CustomerTransactionsResult> {
  const { value: query, error } = querySchema.validate(rawQuery);
  if (error) throw fail('Bộ lọc hoặc phân trang giao dịch không hợp lệ.');
  if (query.from) validDay(query.from);
  if (query.to) validDay(query.to);
  if (query.from && query.to && query.from > query.to) throw fail('Ngày bắt đầu phải trước ngày kết thúc.');
  const customer = await customerFor(scope, customerId);
  const pipeline = pipelines(scope, String(customer._id), customer.customerCode, repairsVisible);
  if (query.type !== 'all') pipeline.push({ $match: { kind: query.type === 'refund' ? { $in: ['sale_refund', 'repair_refund'] } : query.type } });
  if (query.from || query.to) pipeline.push({ $match: { occurredAt: { ...(query.from ? { $gte: new Date(`${query.from}T00:00:00+07:00`) } : {}), ...(query.to ? { $lte: new Date(`${query.to}T23:59:59.999+07:00`) } : {}) } } });
  pipeline.push({ $facet: {
    items: [{ $sort: { occurredAt: -1, id: -1 } }, { $skip: (query.page - 1) * query.limit }, { $limit: query.limit }],
    totals: [{ $group: { _id: null, total: { $sum: 1 }, charged: { $sum: '$charged' }, received: { $sum: '$received' }, refunded: { $sum: '$refunded' }, buybackPaid: { $sum: '$buybackPaid' }, outstanding: { $sum: '$outstanding' } } }],
  } });
  const [result] = await RetailOrderModel.aggregate(pipeline).option({ maxTimeMS: 15000 });
  const totals = result?.totals?.[0];
  return { items: (result?.items || []).map(publicRow), total: totals?.total || 0, page: query.page, limit: query.limit, repairsVisible, summary: { charged: totals?.charged || 0, received: totals?.received || 0, refunded: totals?.refunded || 0, buybackPaid: totals?.buybackPaid || 0, outstanding: totals?.outstanding || 0 } };
}

export async function getCustomerTransactionDetail(scope: Scope, customerId: string, kind: CustomerTransactionKind, sourceId: string, eventId: string, repairsVisible: boolean): Promise<CustomerTransactionDetail> {
  if (!['sale', 'repair', 'sale_refund', 'repair_refund', 'buyback'].includes(kind) || !Types.ObjectId.isValid(sourceId) || eventId.length > 120) throw fail('Mã giao dịch không hợp lệ.');
  if ((kind === 'repair' || kind === 'repair_refund') && !repairsVisible) throw fail('Bạn chưa có quyền xem sửa chữa.', 403);
  const customer = await customerFor(scope, customerId);
  const [row] = await RetailOrderModel.aggregate([...pipelines(scope, String(customer._id), customer.customerCode, repairsVisible), { $match: { kind, sourceId, ...(kind.endsWith('_refund') ? { eventId } : {}) } }, { $limit: 1 }]).option({ maxTimeMS: 15000 });
  if (!row) throw fail('Không tìm thấy giao dịch của khách hàng tại chi nhánh này.', 404);
  const detail: CustomerTransactionDetail = { item: publicRow(row), lines: [], payments: [], refunds: [] };
  if (kind === 'sale' || kind === 'sale_refund') {
    const order = await RetailOrderModel.findOne({ ...scope, _id: sourceId, customerId: String(customer._id) }).select('items payments refunds note orderDiscount taxAmount shippingFee paidAmount dueAmount status').lean();
    if (!order) throw fail('Giao dịch vừa thay đổi. Hãy tải lại.', 404);
    detail.lines = order.items.map((line) => ({ name: line.productName, sku: line.sku, quantity: line.quantity, unitPrice: line.unitPrice, total: line.lineTotal, serials: [...(line.serialNumbers || []), ...(line.internalBarcodes || [])] }));
    detail.payments = order.payments.map((p) => ({ at: p.paidAt?.toISOString(), amount: p.amount, method: p.method, reference: p.reference }));
    detail.refunds = (kind === 'sale_refund' ? order.refunds.filter((_, index) => String(index) === eventId) : order.refunds).map((p) => ({ at: p.refundedAt?.toISOString(), amount: p.amount, reason: p.reason, reference: p.reference }));
    detail.note = order.note;
    detail.item.paidAmount = order.paidAmount;
    detail.item.dueAmount = order.status === 'confirmed' ? order.dueAmount : 0;
    detail.adjustments = [{ label: 'Giảm giá toàn đơn', amount: -Number(order.orderDiscount || 0) }, { label: 'Thuế', amount: Number(order.taxAmount || 0) }, { label: 'Phí vận chuyển', amount: Number(order.shippingFee || 0) }].filter((item) => item.amount !== 0);
  } else if (kind === 'repair' || kind === 'repair_refund') {
    const ticket = await RepairTicketModel.findOne({ ...scope, _id: sourceId, customerId: { $in: [String(customer._id), customer.customerCode] } }).select('device symptom diagnosis laborFee partRevenue discountAmount commissionRefunds paidAmount paymentLedgerBaseline dueAmount status totalAmount').lean();
    if (!ticket) throw fail('Giao dịch vừa thay đổi. Hãy tải lại.', 404);
    detail.device = { name: ticket.device.name, serialNumber: ticket.device.serialNumber, condition: ticket.device.condition, symptom: ticket.symptom, diagnosis: ticket.diagnosis };
    detail.lines = [{ name: 'Tiền công', quantity: 1, unitPrice: ticket.laborFee, total: ticket.laborFee }, { name: 'Vật tư / hạng mục khác', quantity: 1, unitPrice: Number(ticket.partRevenue || 0), total: Number(ticket.partRevenue || 0) }];
    if (!ticket.laborFee && !ticket.partRevenue && ticket.totalAmount > 0) detail.lines = [{ name: 'Giá trị dịch vụ theo báo giá', quantity: 1, unitPrice: ticket.totalAmount, total: ticket.totalAmount }];
    detail.adjustments = ticket.discountAmount ? [{ label: 'Giảm giá dịch vụ', amount: -ticket.discountAmount }] : [];
    detail.item.paidAmount = ticket.paidAmount;
    detail.item.dueAmount = ['cancelled', 'returned'].includes(ticket.status) ? 0 : ticket.dueAmount;
    const payments = await RepairPaymentModel.find({ ...scope, ticketId: sourceId }).sort({ createdAt: 1, _id: 1 }).select('amount createdAt beforePaid').lean();
    const baseline = Number(ticket.paymentLedgerBaseline ?? (payments.length ? payments[0].beforePaid : ticket.paidAmount || 0));
    detail.payments = [...(baseline > 0 ? [{ amount: baseline, reference: 'Đã thu trước sổ chi tiết' }] : []), ...payments.map((p) => ({ at: p.createdAt.toISOString(), amount: p.amount }))];
    const refunds = (ticket.commissionRefunds || []).filter((r) => r.financeVoucherId && (kind === 'repair' || r.key === eventId));
    detail.refunds = refunds.map((r) => ({ at: new Date(r.at).toISOString(), amount: r.amount, reason: r.reason, reference: r.reference }));
    if (kind === 'repair_refund' && refunds[0]) {
      const voucher = await FinanceCashVoucherModel.findOne({ ...scope, _id: refunds[0].financeVoucherId, sourceId, sourceType: 'repair-refund', status: 'posted' }).select('key').lean();
      detail.financeVoucherCode = voucher?.key;
    }
  } else {
    const buyback = await RetailAfterSaleModel.findOne({ ...scope, _id: sourceId, customerId: String(customer._id), type: 'buyback' }).select('items reason').lean();
    if (!buyback) throw fail('Giao dịch vừa thay đổi. Hãy tải lại.', 404);
    detail.lines = buyback.items.map((line) => ({ name: line.productName, sku: line.sku, quantity: line.quantity, unitPrice: line.unitAmount, total: line.lineAmount, serials: line.serialNumbers }));
    detail.note = buyback.reason;
  }
  return detail;
}

import { InventoryLedgerEntryModel } from "../../../model/inventory-ledger-entry.model";
import { resolveReturnCost } from "./cost-resolution";
import { AssetDepreciationModel } from "../models/asset-depreciation.model";
import { RetailInvoiceModel } from "../../retail/models/retail-invoice.model";
import mongoose from "mongoose";
import { createHash, randomUUID } from "node:crypto";
import { RetailOrderModel } from "../../retail/models/retail-order.model";
import { RetailAfterSaleModel } from "../../retail/models/retail-after-sale.model";
import { GoodsReceiptModel } from "../../../model/goods-receipt.model";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { ProductPriceModel } from "../../../model/product-price.model";
import { SerialUnitModel } from "../../inventory/serials/serial-unit.model";
import { ReceivableModel } from "../models/receivable.model";
import { ReceivableEntryModel } from "../models/receivable-entry.model";
import { FinanceVoucherModel, FinancePayableModel, FinanceTaxModel, FinanceFollowupModel, FinanceManagementSettingsModel } from "../models/management.model";
import { FinanceDebtModel } from "../models/financial-reporting.model";
import type { FinanceBranchScope } from "../contracts";
import { businessDay, daysBetween, agingBand, breakEven, saleLines } from "./management-calculations";
import { validateManagement } from "../validations/management.validation";
function fail(message: string, status = 400): never { throw Object.assign(new Error(message), { status, expose: true }); }
const sum = (rows: any[], field: string) => rows.reduce((s, r) => s + Number(r[field] || 0), 0);
async function rows(query: any): Promise<any[]> { const result = await query.limit(10001).lean(); if (result.length > 10000)
    fail("Phạm vi có quá nhiều dữ liệu. Vui lòng thu hẹp kỳ báo cáo."); return result; }
export function reportRange(query: any) {
    const today = businessDay();
    const { from, to } = validateManagement("range", { from: query.from || `${today.slice(0, 7)}-01`, to: query.to || today });
    if (from > to || daysBetween(from, to) > 366)
        fail("Chọn kỳ báo cáo hợp lệ, tối đa 366 ngày.");
    return { from, to, today };
}
const inRange = (date: string, range: {
    from: string;
    to: string;
}) => date >= range.from && date <= range.to;
// Receipt debts are owned by FinanceTradeDebt; keep one balance for both finance screens.
const receiptDebtFilter = { direction: "payable", partyKind: "supplier", sourceReceiptId: { $type: "string" } } as const;
async function findReceiptDebt(scope: FinanceBranchScope, id: string, session: mongoose.ClientSession | null = null) {
    const debt = await FinanceDebtModel.findOne({ ...scope, ...receiptDebtFilter, _id: id }).session(session).lean();
    if (!debt || !await GoodsReceiptModel.exists({ ...scope, _id: debt.sourceReceiptId, status: "confirmed" }).session(session)
        || await FinancePayableModel.exists({ ...scope, receiptId: debt.sourceReceiptId }).session(session)) return null;
    return debt;
}
async function payReceiptDebt(scope: FinanceBranchScope, id: string, amount: number, key: string, date: string,
    actorId: string, session: mongoose.ClientSession, originalKey?: string) {
    const debt = await findReceiptDebt(scope, id, session);
    if (!debt || (amount < 0 && !debt.payments.some(p => p.key === originalKey && p.amount === -amount))) return null;
    return FinanceDebtModel.findOneAndUpdate({ ...scope, ...receiptDebtFilter, _id: id,
        version: debt.version, balance: amount > 0 ? { $gte: amount } : { $lte: debt.amount + amount }, "payments.key": { $ne: key } },
        { $inc: { balance: -amount, version: 1 }, $push: { payments: { key, amount, at: new Date(date + "T00:00:00+07:00"), reference: key, actorId } } },
        { session, returnDocument: "after" });
}
export async function financeDebts(scope: FinanceBranchScope) {
    const [receivables, manualPayables, receipts, followups, receiptDebts] = await Promise.all([
        rows(ReceivableModel.find({ ...scope, balance: { $gt: 0 }, status: { $in: ["open", "partially_paid"] } })),
        rows(FinancePayableModel.find(scope)), rows(GoodsReceiptModel.find({ ...scope, status: "confirmed" }).select("receiptCode supplierId supplierName subtotal receivedAt")), rows(FinanceFollowupModel.find(scope)),
        rows(FinanceDebtModel.find({ ...scope, ...receiptDebtFilter })),
    ]);
    const receiptById = new Map(receipts.map(r => [String(r._id), r]));
    const manualReceiptIds = new Set(manualPayables.map(p => p.receiptId));
    const payables = [...manualPayables, ...receiptDebts.flatMap(d => {
        const receipt = receiptById.get(d.sourceReceiptId);
        if (!receipt || manualReceiptIds.has(d.sourceReceiptId)) return [];
        return [{ ...d, receiptId: d.sourceReceiptId, receiptCode: receipt.receiptCode,
            supplierId: receipt.supplierId, supplierName: receipt.supplierName,
            originalAmount: receipt.subtotal, openingPaid: receipt.subtotal - d.amount,
            paidAmount: receipt.subtotal - d.balance, dueDate: d.dueOn }];
    })];
    const today = businessDay();
    const enrich = (r: any, targetType: string) => { const dueDate = typeof r.dueDate === "string" ? r.dueDate : businessDay(r.dueDate); return { ...r, _id: String(r._id), dueDate, aging: agingBand(dueDate, today), daysUntil: daysBetween(today, dueDate), followup: followups.find(f => f.targetType === targetType && f.targetId === String(r._id)) }; };
    return { receivables: receivables.map(r => enrich(r, "receivable")), payables: payables.map(r => enrich(r, "payable")), unregisteredReceipts: receipts.filter(r => !payables.some(p => p.receiptId === String(r._id))) };
}
export async function financeReport(scope: FinanceBranchScope, query: any) {
    const range = reportRange(query);
    const dates = { $gte: range.from, $lte: range.to };
    const [orders, aftersales, vouchers, debts, balances, serials, receipts, prices, taxes, settingsRows, invoices, depreciation] = await Promise.all([
        rows(RetailOrderModel.find({ ...scope, status: { $in: ["confirmed", "completed"] }, businessDate: dates })),
        rows(RetailAfterSaleModel.find({ ...scope, businessDate: dates })),
        rows(FinanceVoucherModel.find({ ...scope, date: dates }).sort({ date: -1, createdAt: -1 })), financeDebts(scope),
        rows(InventoryBalanceModel.find(scope)), rows(SerialUnitModel.find({ ...scope, status: "in_stock" })),
        rows(GoodsReceiptModel.find({ ...scope, status: "confirmed" })), rows(ProductPriceModel.find({ ...scope, status: "active" })),
        rows(FinanceTaxModel.find({ ...scope, date: dates })), rows(FinanceManagementSettingsModel.find({ ...scope, period: { $gte: range.from.slice(0, 7), $lte: range.to.slice(0, 7) } })),
        rows(RetailInvoiceModel.find({ ...scope, status: "issued", "snapshot.businessDate": dates })),
        rows(AssetDepreciationModel.find({ ...scope, status: "posted", period: { $gte: range.from.slice(0, 7), $lte: range.to.slice(0, 7) } })),
    ]);
    const settings = settingsRows.find(s => s.period === range.from.slice(0, 7));
    const variantIds = [...new Set(orders.flatMap(o => o.items.map((i: any) => String(i.variantId || i.productId))))];
    const returnOrderIds = [...new Set(aftersales.filter(a => a.type === "return").map(a => a.orderId))];
    const issues = variantIds.length || returnOrderIds.length ? await rows(InventoryLedgerEntryModel.find({ ...scope, $or: [{ variantId: { $in: variantIds } }, { productId: { $in: variantIds } }, { sourceType: "retail-order", sourceId: { $in: returnOrderIds } }] })) : [];
    const serialIds = orders.flatMap(o => o.items.flatMap((i: any) => i.serialNumbers || []));
    const barcodeIds = orders.flatMap(o => o.items.flatMap((i: any) => i.internalBarcodes || []));
    const otherSales = serialIds.length || barcodeIds.length ? await rows(RetailOrderModel.find({ ...scope, status: { $in: ["confirmed", "completed"] }, $or: [{ "items.serialNumbers": { $in: serialIds } }, { "items.internalBarcodes": { $in: barcodeIds } }] }).select("companyCode branchId confirmedAt completedAt createdAt items")) : [];
    const acquisitions = variantIds.length ? await rows(RetailAfterSaleModel.find({ ...scope, $or: [{ "items.variantId": { $in: variantIds } }, { "items.productId": { $in: variantIds } }] })) : [];
    const lines = orders.flatMap(o => saleLines(o, issues, receipts, otherSales, acquisitions));
    // Buybacks are purchases, not negative sales. Returns carry their source costs.
    for (const a of aftersales.filter(a => a.type === "return"))
        for (const item of a.items) {
            const returnCost = resolveReturnCost(a, item, issues);
            lines.push({ ...item, orderId: a.orderId, orderCode: a.orderCode, branchId: a.branchId, salespersonName: "Hoàn hàng", salespersonId: "", date: a.businessDate, quantity: -item.quantity, revenue: -item.lineAmount, cost: returnCost === null ? null : -returnCost, grossProfit: returnCost === null ? null : -item.lineAmount + returnCost, costBasis: returnCost === null ? "missing" : "return_snapshot" });
        }
    const missingCostCount = lines.filter(l => l.cost === null).length;
    const revenue = sum(lines, "revenue"), cost = missingCostCount ? null : sum(lines, "cost"), grossProfit = cost === null ? null : revenue - cost;
    const expenses = vouchers.filter(v => v.expenseClass !== "none" && (v.kind === "payment" || v.reversalOf)).map(v => ({ ...v, amount: v.reversalOf ? -v.amount : v.amount }));
    for (const d of depreciation) {
        const start = d.period + "-01";
        const [year, month] = d.period.split("-").map(Number);
        const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
        const overlapStart = range.from > start ? range.from : start;
        const overlapEnd = range.to < last ? range.to : last;
        const amount = Math.round(d.amount * (daysBetween(overlapStart, overlapEnd) + 1) / (daysBetween(start, last) + 1));
        expenses.push({ date: overlapEnd, category: "depreciation", expenseClass: "fixed", amount, note: "Khấu hao đã ghi sổ, phân bổ theo ngày trong kỳ", source: "depreciation" });
    }
    const expense = sum(expenses, "amount"), netProfit = grossProfit === null ? null : grossProfit - expense;
    const cash: any[] = vouchers.map(v => ({ ...v, source: "finance" }));
    const paymentOrders = await rows(RetailOrderModel.find({ ...scope, $or: [{ "payments.businessDate": dates }, { "refunds.businessDate": dates }] }).select("orderCode payments refunds financeSettlementEventId"));
    for (const order of paymentOrders) {
        for (const p of order.payments || [])
            if (inRange(p.businessDate, range))
                cash.push({ code: order.orderCode, kind: "receipt", category: "retail", amount: p.amount, date: p.businessDate, method: p.method, source: "retail", createdByName: p.receivedByName });
        for (const p of order.refunds || [])
            if (inRange(p.businessDate, range))
                cash.push({ code: order.orderCode, kind: "payment", category: "refund", amount: p.amount, date: p.businessDate, method: p.method, source: "retail", createdByName: p.refundedByName });
    }
    // Finance-origin payments do not enter retail payment arrays. Exclude imported retail events and legacy entries.
    const nonRetail = await rows(ReceivableModel.find(scope).select("customerName sourceType"));
    const entries = await rows(ReceivableEntryModel.find({ ...scope, receivableId: { $in: nonRetail.map(r => String(r._id)) }, type: { $in: ["payment", "reversal"] } }));
    for (const e of entries) {
        const original = e.type === "reversal" ? entries.find(o => String(o._id) === e.reversalOfEntryId) : e;
        if (!original || original.type !== "payment" || original.paymentMethod === "retail" || String(original.idempotencyKey).startsWith("legacy:") || !inRange(businessDay(e.createdAt), range))
            continue;
        cash.push({ code: e.reference || String(e._id), kind: e.amount < 0 ? "receipt" : "payment", amount: Math.abs(e.amount), date: businessDay(e.createdAt), method: e.paymentMethod || original.paymentMethod, counterparty: nonRetail.find(d => String(d._id) === e.receivableId)?.customerName, source: "receivable", category: "debt", createdByName: e.createdByName });
    }
    for (const a of aftersales.filter(a => a.type === "buyback"))
        cash.push({ code: a.code, kind: "payment", amount: a.totalAmount, date: a.businessDate, method: a.paymentMethod, source: "buyback", category: "inventory", counterparty: a.customerName, createdByName: a.createdByName });
    cash.sort((a, b) => b.date.localeCompare(a.date));
    const inventory = serials.map(s => {
        const matches = (i: any) => (i.serialNumbers || []).includes(s.serialNumber) || (i.unitDetails || []).some((u: any) => u.serialNumber === s.serialNumber || u.internalBarcode === s.internalBarcode);
        const receipt = receipts.filter(r => r.items.some(matches)).sort((a, b) => +new Date(b.receivedAt || b.createdAt) - +new Date(a.receivedAt || a.createdAt))[0];
        const item = receipt?.items.find(matches);
        const price = prices.find(p => p.variantId === s.variantId)?.sellingPrice;
        const days = daysBetween(businessDay(receipt?.receivedAt || s.createdAt), range.today);
        return { productName: s.productName, sku: s.sku, serialNumber: s.serialNumber, cost: item?.unitCost ?? null, price: price ?? null, days, band: days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "over90", risk: price !== undefined && item ? Math.max(0, item.unitCost - price) : null };
    });
    const trends = new Map<string, any>();
    for (const l of lines) {
        const t = trends.get(l.date) || { date: l.date, revenue: 0, cost: 0, expense: 0 };
        t.revenue += l.revenue;
        t.cost = t.cost === null || l.cost === null ? null : t.cost + l.cost;
        trends.set(l.date, t);
    }
    for (const e of expenses) {
        const t = trends.get(e.date) || { date: e.date, revenue: 0, cost: 0, expense: 0 };
        t.expense += e.amount;
        trends.set(e.date, t);
    }
    const taxOutput = sum(taxes.filter(t => t.direction === "output"), "vat"), taxInput = sum(taxes.filter(t => t.direction === "input" && t.deductible), "vat");
    const carry = settings?.vatCarryforward || 0;
    const budgetMonths = new Set(settingsRows.map(s => s.period));
    const fixed = sum(settingsRows, "fixedCostBudget") + sum(expenses.filter(v => v.expenseClass === "fixed" && !budgetMonths.has(v.date.slice(0, 7))), "amount");
    const variable = sum(expenses.filter(v => v.expenseClass === "variable"), "amount");
    const hasFixedCosts = Boolean(settingsRows.length) || expenses.some(v => v.expenseClass === "fixed");
    return { range, summary: { missingCostCount, revenue, cost, grossProfit, expense, netProfit, inventoryValue: balances.reduce((s, b) => s + b.quantity * b.averageCost, 0), receivable: sum(debts.receivables, "balance"), overdue: sum(debts.receivables.filter(d => d.daysUntil < 0), "balance"), payable: sum(debts.payables, "balance"), payableSoon: sum(debts.payables.filter(d => d.daysUntil >= 0 && d.daysUntil <= 5), "balance"), cashIn: sum(cash.filter(c => c.kind === "receipt"), "amount"), cashOut: sum(cash.filter(c => c.kind === "payment"), "amount") }, lines, expenses, cash, debts, inventory, trends: [...trends.values()].sort((a, b) => a.date.localeCompare(b.date)), taxes, invoiceCandidates: invoices.filter(i => !taxes.some(t => t.sourceInvoiceId === String(i._id))).map(i => ({ id: String(i._id), invoiceNo: i.invoiceNo, date: i.snapshot.businessDate, counterparty: i.snapshot.customerName, vat: i.snapshot.taxAmount, taxId: i.snapshot.store?.taxCode })), vat: { input: taxInput, output: taxOutput, carryforward: carry, payable: Math.max(0, taxOutput - taxInput - carry), nextCarryforward: Math.max(0, taxInput + carry - taxOutput), retailTaxReference: sum(orders, "taxAmount") }, settings, breakeven: { ...breakEven(hasFixedCosts ? revenue : 0, grossProfit, fixed, variable, Math.max(1, daysBetween(range.from, range.today) + 1), Math.max(0, daysBetween(range.today, range.to))), fixedCosts: fixed, variableCosts: variable }, warnings: ["Lãi ròng quản trị gồm chi phí đã ghi nhận và khấu hao đã ghi sổ (phân bổ theo ngày); chưa gồm chi phí chưa nhập và thuế thu nhập. Chi phí cố định dùng ngân sách tháng đã cấu hình, hoặc chi phí đã ghi nhận nếu chưa có ngân sách.", "Giá vốn ưu tiên số đã chốt trên đơn hoặc phiếu xuất. Máy theo IMEI/mã được đối chiếu phiếu nhập hoặc phiếu thu mua lại; hàng không theo IMEI dùng bình quân từ lịch sử nhập/xuất tại kho trước lúc bán. Thiếu hoặc không xác định duy nhất nguồn thì không tính lợi nhuận.", "VAT tổng hợp từ chứng từ tài chính đã nhập. Thuế trên đơn bán lẻ chỉ là số đối chiếu.", ...(debts.unregisteredReceipts.length ? [`Có ${debts.unregisteredReceipts.length} phiếu nhập chưa xác nhận công nợ; tổng phải trả chưa bao gồm các phiếu này.`] : [])] };
}
export async function createPayable(scope: FinanceBranchScope, input: any, actor: any) {
    const receipt = await GoodsReceiptModel.findOne({ ...scope, _id: input.receiptId, status: "confirmed" }).lean();
    if (!receipt)
        fail("Không tìm thấy phiếu nhập đã xác nhận trong chi nhánh.", 404);
    if (await FinanceDebtModel.exists({ ...scope, ...receiptDebtFilter, sourceReceiptId: String(receipt._id) }))
        fail("Phiếu nhập đã được tự động ghi nhận công nợ. Vui lòng tải lại danh sách.", 409);
    if (input.openingPaid > receipt.subtotal)
        fail("Tiền đã trả không được vượt giá trị phiếu nhập.");
    return FinancePayableModel.create({ ...scope, ...input, payableCode: `GN-${businessDay().replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`, receiptCode: receipt.receiptCode, supplierId: receipt.supplierId, supplierName: receipt.supplierName, originalAmount: receipt.subtotal, paidAmount: input.openingPaid, balance: receipt.subtotal - input.openingPaid, createdBy: actor.id });
}
export async function createVoucher(scope: FinanceBranchScope, input: any, actor: any) {
    if ((input.category === "supplier") !== Boolean(input.payableId))
        fail("Phiếu trả nhà cung cấp cần liên kết khoản phải trả.");
    if (input.payableId && (input.kind !== "payment" || input.expenseClass !== "none"))
        fail("Trả nhà cung cấp là dòng tiền chi, không ghi thêm chi phí vào lãi lỗ.");
    if (input.kind === "receipt" && input.expenseClass !== "none")
        fail("Phiếu thu không phải chi phí.");
    const expenseCategories = ["rent", "salary", "marketing", "utilities", "repair", "other_expense"];
    if (expenseCategories.includes(input.category) && (input.kind !== "payment" || input.expenseClass === "none"))
        fail("Danh mục chi phí cần là phiếu chi và được phân loại cố định hoặc biến đổi.");
    if (["capital", "other_receipt"].includes(input.category) && input.expenseClass !== "none")
        fail("Vốn và khoản thu khác không được tính thành chi phí.");
    if (input.category === "other_receipt" && input.kind !== "receipt")
        fail("Danh mục thu khác cần là phiếu thu.");
    const fingerprint = createHash("sha256").update(JSON.stringify(Object.keys(input).sort().map(k => [k, input[k]]))).digest("hex");
    const session = await mongoose.startSession();
    try {
        let result: any;
        await session.withTransaction(async () => {
            const existing = await FinanceVoucherModel.findOne({ ...scope, idempotencyKey: input.idempotencyKey }).session(session);
            if (existing) {
                if (existing.fingerprint !== fingerprint)
                    fail("Yêu cầu trùng mã nhưng khác nội dung.", 409);
                result = existing;
                return;
            }
            if (input.payableId) {
                const payable = await FinancePayableModel.findOneAndUpdate({ ...scope, _id: input.payableId, balance: { $gte: input.amount } }, { $inc: { balance: -input.amount, paidAmount: input.amount } }, { returnDocument: "after", session })
                    || await payReceiptDebt(scope, input.payableId, input.amount, `voucher:${input.idempotencyKey}`, input.date, actor.id, session);
                if (!payable)
                    fail("Khoản phải trả không tồn tại hoặc số tiền vượt dư nợ.", 409);
            }
            [result] = await FinanceVoucherModel.create([{ ...scope, ...input, fingerprint, code: `${input.kind === "receipt" ? "PT" : "PC"}-${randomUUID()}`, createdBy: actor.id, createdByName: actor.name || actor.displayName }], { session });
        });
        return result;
    }
    finally {
        await session.endSession();
    }
}
export async function saveFollowup(scope: FinanceBranchScope, input: any, actor: any) {
    const model: any = input.targetType === "receivable" ? ReceivableModel : FinancePayableModel;
    if (!await model.exists({ ...scope, _id: input.targetId }) && !(input.targetType === "payable" && await findReceiptDebt(scope, input.targetId)))
        fail("Không tìm thấy khoản nợ trong chi nhánh.", 404);
    return FinanceFollowupModel.findOneAndUpdate({ ...scope, targetType: input.targetType, targetId: input.targetId }, { $set: { ...input, updatedBy: actor.id } }, { upsert: true, returnDocument: "after", runValidators: true });
}
export async function importInvoiceTax(scope: FinanceBranchScope, id: string, actor: any) {
    if (!mongoose.isValidObjectId(id))
        fail("Hóa đơn không hợp lệ.");
    const invoice = await RetailInvoiceModel.findOne({ ...scope, _id: id, status: "issued" }).lean();
    if (!invoice)
        fail("Không tìm thấy hóa đơn đã phát hành trong chi nhánh.", 404);
    const snap = invoice.snapshot;
    const input = validateManagement("tax", { direction: "output", invoiceNumber: invoice.invoiceNo, taxId: snap.store?.taxCode, counterparty: snap.customerName, date: snap.businessDate, base: Number(snap.subtotal) - Number(snap.orderDiscount), rate: snap.taxRate, vat: snap.taxAmount, deductible: false, sourceOrderId: invoice.orderId, note: "Đối chiếu từ hóa đơn bán lẻ" });
    return FinanceTaxModel.create({ ...scope, ...input, sourceInvoiceId: String(invoice._id), createdBy: actor.id });
}

export async function reverseVoucher(scope: FinanceBranchScope, id: string, input: any, actor: any) {
    if (!mongoose.isValidObjectId(id)) fail("Mã phiếu không hợp lệ.");
    const session = await mongoose.startSession();
    try {
        let result: any;
        await session.withTransaction(async () => {
            const fingerprint = createHash("sha256").update(JSON.stringify([id, input.date, input.reason])).digest("hex");
            const prior = await FinanceVoucherModel.findOne({ ...scope, idempotencyKey: input.idempotencyKey }).session(session);
            if (prior) {
                if (prior.reversalOf !== id || prior.fingerprint !== fingerprint) fail("Mã yêu cầu đã dùng cho giao dịch khác.", 409);
                result = prior; return;
            }
            const original = await FinanceVoucherModel.findOne({ ...scope, _id: id }).session(session);
            if (!original || original.reversalOf || original.reversedBy) fail("Phiếu không tồn tại hoặc đã được đảo.", 409);
            if (input.date < original.date || input.date > businessDay()) fail("Ngày đảo phải từ ngày phiếu gốc đến hôm nay.");
            const reversalId = new mongoose.Types.ObjectId();
            const locked = await FinanceVoucherModel.updateOne({ ...scope, _id: id, reversedBy: { $exists: false } }, { $set: { reversedBy: String(reversalId) } }, { session });
            if (locked.modifiedCount !== 1) fail("Phiếu đã được đảo.", 409);
            if (original.payableId) {
                const updated = await FinancePayableModel.findOneAndUpdate({ ...scope, _id: original.payableId, paidAmount: { $gte: original.amount } },
                  { $inc: { balance: original.amount, paidAmount: -original.amount } }, { session, returnDocument: "after" })
                    || await payReceiptDebt(scope, original.payableId, -original.amount, `voucher-reversal:${id}`, input.date, actor.id, session, `voucher:${original.idempotencyKey}`);
                if (!updated) fail("Không thể khôi phục dư nợ; cần đối chiếu phiếu gốc.", 409);
            }
            [result] = await FinanceVoucherModel.create([{ _id: reversalId, ...scope, code: "DC-" + randomUUID(),
                kind: original.kind === "payment" ? "receipt" : "payment", category: original.category,
                expenseClass: original.expenseClass, amount: original.amount, date: input.date, method: original.method,
                counterparty: original.counterparty, payableId: original.payableId, reversalOf: id, reversalReason: input.reason,
                note: "Đảo phiếu " + original.code + ": " + input.reason, idempotencyKey: input.idempotencyKey, fingerprint,
                createdBy: actor.id, createdByName: actor.name || actor.displayName }], { session });
        });
        return result;
    } finally { await session.endSession(); }
}

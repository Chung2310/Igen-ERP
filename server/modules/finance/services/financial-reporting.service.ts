import { FinanceCashVoucherModel } from "../models/finance-treasury.model";
﻿import { Types } from "mongoose";
import type { FinanceBranchScope } from "../contracts";
import { FinanceDebtModel, FinanceMonthlyPlanModel, FinanceVatInvoiceModel, FinanceVatPeriodModel } from "../models/financial-reporting.model";
import { ReceivableModel } from "../models/receivable.model";
import { RetailOrderModel } from "../../retail/models/retail-order.model";
import { RetailAfterSaleModel } from "../../retail/models/retail-after-sale.model";
import { RepairTicketModel } from "../../repair/repair-ticket.model";
import { repairCompletionFilter } from "../../repair/services/repair-completion";
import { verifiedRepairRefunds, repairRefundReportingNote } from "../../repair/services/repair-refunds";
import { RetailCommissionLedgerModel } from "../../retail/models/retail-commission.model";
import { RetailPartnerModel } from "../../retail/models/retail-partner.model";
import { GoodsReceiptModel } from "../../../model/goods-receipt.model";
import { OperatingExpenseModel } from "../../../model/operating-expense.model";
import { loadAuthoritativePayrollLines } from "../../../service/payroll-effective-line.service";
import { PayrollRunModel } from "../../../model/payroll-run.model";
import { StockLogModel } from "../../../model/stock-log.model";
import { AssetDepreciationModel } from "../models/asset-depreciation.model";
import { retailFinancialMovements, breakEven, debtAging, financeRange, financeToday, invalid, moneyInput, profitTotals, validDay, type FinanceMovement } from "./financial-calculations";
import { vatTotals } from "./financial-calculations";
const text = (value: unknown, label: string) => { const v = String(value || "").trim(); if (!v || v.length > 240) throw invalid(`${label} là bắt buộc, tối đa 240 ký tự.`); return v; };
const id = (value: unknown) => { if (!Types.ObjectId.isValid(String(value))) throw invalid("Mã chứng từ không hợp lệ."); return String(value); };
const conflict = () => invalid("Dữ liệu đã thay đổi hoặc không tồn tại. Vui lòng tải lại.", 409);
const inside = (date: string, range: { from: string; to: string }) => date >= range.from && date <= range.to;

export const financialReportingService = {
  async document(scope: FinanceBranchScope, source: string, sourceId: string) {
    const models: Record<string, any> = { retail: RetailOrderModel, shipping: RetailOrderModel, cancellation: RetailOrderModel, return: RetailAfterSaleModel, repair: RepairTicketModel, "repair-refund": FinanceCashVoucherModel, inventory: StockLogModel, expense: OperatingExpenseModel, payroll: PayrollRunModel, commission: RetailCommissionLedgerModel, depreciation: AssetDepreciationModel };
    const model = Object.hasOwn(models, source) ? models[source] : undefined; if (!model) throw invalid("Nguồn chứng từ không hợp lệ.");
    const row = await model.findOne({ ...scope, _id: id(sourceId) }).lean(); if (!row) throw invalid("Không tìm thấy chứng từ trong chi nhánh.", 404);
    if (source === "repair-refund") {
      if (row.sourceType !== "repair-refund" || row.status !== "posted" || row.kind !== "payment") throw invalid("Không tìm thấy phiếu chi hoàn sửa chữa.", 404);
      return { source, id: sourceId, code: row.key, status: row.status, description: row.description, partyName: "", date: row.occurredOn, amount: -row.amount, items: [] };
    }
    return { source, id: sourceId, code: row.orderCode || row.code || row.ticketCode || row.sourceCode || row.periodKey || row.period || sourceId, status: row.status || row.kind || "", description: row.description || row.reason || "", partyName: row.customerName || "", date: row.incurredOn || row.confirmedAt || row.completedAt || row.createdAt, amount: row.grandTotal ?? row.totalAmount ?? row.amount ?? row.totals?.grossPay, items: (row.items || []).map((i: any) => ({ name: i.productName || i.sku || "", quantity: i.quantity, unitCost: i.unitCost, lineTotal: i.lineTotal })) };
  },
  async debts(scope: FinanceBranchScope, query: any = {}) {
    const asOf = financeToday(); // Current balances must not be presented as historical balances.
    const warningDays = Number(query.warningDays || 5);
    if (![3, 4, 5].includes(warningDays)) throw invalid("Cảnh báo trước hạn phải từ 3 đến 5 ngày.");
    const [manual, receivables, partners, orders, repairs, receipts] = await Promise.all([
      FinanceDebtModel.find({ ...scope, balance: { $gt: 0 } }).lean(),
      ReceivableModel.find({ ...scope, balance: { $gt: 0 }, status: { $in: ["open", "partially_paid"] } }).lean(),
      RetailPartnerModel.find({ companyCode: scope.companyCode }).select("customerId name roles").lean(),
      RetailOrderModel.find({ ...scope, status: "confirmed", dueAmount: { $gt: 0 } }).select("orderCode customerId customerName dueAmount dueDate confirmedAt").lean(),
      RepairTicketModel.find({ ...scope, status: { $in: ["done", "delivered"] }, dueAmount: { $gt: 0 } }).select("ticketCode customerId customerName dueAmount deliveredAt completedAt").lean(),
      GoodsReceiptModel.find({ ...scope, status: "confirmed" }).select("receiptCode supplierId supplierName subtotal receivedAt").lean(),
    ]);
    const party = (customerId: string) => { const partner = partners.find(p => p.customerId === customerId); return partner?.roles.includes("dealer") ? "dealer" : partner?.roles.includes("collaborator") ? "collaborator" : "customer"; };
    const rows: any[] = manual.map(row => ({ ...row, id: String(row._id), source: "manual" }));
    for (const row of receivables) rows.push({ id: String(row._id), source: "receivable", direction: "receivable", partyKind: party(row.customerId), partyName: row.customerName, reference: row.sourceCode || row.receivableCode, amount: row.originalAmount, balance: row.balance, dueOn: row.dueDate ? financeToday(row.dueDate) : undefined });
    const existing = new Set(receivables.map(row => `${row.sourceType}:${row.sourceId}`));
    for (const row of orders) if (!existing.has(`retail_order:${row._id}`)) rows.push({ id: String(row._id), source: "retail", direction: "receivable", partyKind: party(row.customerId || ""), partyName: row.customerName || "Khách hàng", reference: row.orderCode, balance: row.dueAmount, dueOn: row.dueDate ? financeToday(row.dueDate) : undefined });
    for (const row of repairs) if (!existing.has(`repair_ticket:${row._id}`)) rows.push({ id: String(row._id), source: "repair", direction: "receivable", partyKind: party(row.customerId), partyName: row.customerName, reference: row.ticketCode, balance: row.dueAmount });
    const items = rows.map(row => { const aging = debtAging(row.dueOn, asOf); return { ...row, ...aging, alert: row.direction === "payable" ? aging.daysUntilDue != null && aging.daysUntilDue <= warningDays : (aging.daysOverdue || 0) > 0 }; }).sort((a, b) => (a.dueOn || "9999").localeCompare(b.dueOn || "9999"));
    const recorded = new Set((await FinanceDebtModel.find({ ...scope, sourceReceiptId: { $exists: true } }).select("sourceReceiptId").lean()).map(row => row.sourceReceiptId));
    const totals = { receivable: 0, payable: 0, overdueReceivable: 0, upcomingPayable: 0 };
    const aging: Record<string, Record<string, number>> = {};
    for (const row of items) {
      if (row.direction === "receivable") { totals.receivable += row.balance; if (row.daysOverdue > 0) totals.overdueReceivable += row.balance; }
      else { totals.payable += row.balance; if (row.alert) totals.upcomingPayable += row.balance; }
      aging[row.partyKind] ||= {}; aging[row.partyKind][row.bucket] = (aging[row.partyKind][row.bucket] || 0) + row.balance;
    }
    return { asOf, warningDays, items, totals, aging, unrecordedReceipts: receipts.filter(row => !recorded.has(String(row._id))) };
  },
  async createDebt(scope: FinanceBranchScope, input: any, actor: string) {
    if (!["receivable", "payable"].includes(input.direction) || !["customer", "dealer", "collaborator", "supplier"].includes(input.partyKind) || (input.direction === "payable") !== (input.partyKind === "supplier")) throw invalid("Loại công nợ không hợp lệ.");
    const occurredOn = validDay(input.occurredOn), dueOn = validDay(input.dueOn);
    if (dueOn < occurredOn) throw invalid("Hạn trả không được trước ngày ghi nhận.");
    let partyName = text(input.partyName, "Tên đối tượng"), reference = text(input.reference, "Số chứng từ"), amount = moneyInput(input.amount), sourceReceiptId: string | undefined;
    let partyId: string | undefined;
    if (input.sourceReceiptId) {
      const receipt = await GoodsReceiptModel.findOne({ ...scope, _id: id(input.sourceReceiptId), status: "confirmed" }).lean();
      if (!receipt || input.direction !== "payable") throw invalid("Phiếu nhập không hợp lệ.");
      sourceReceiptId = String(receipt._id); partyId = receipt.supplierId; partyName = receipt.supplierName; reference = receipt.receiptCode;
      if (amount > receipt.subtotal) throw invalid("Nợ ghi nhận không được vượt giá trị phiếu nhập. VAT bổ sung cần chứng từ riêng.");
    }
    if (amount <= 0 && !sourceReceiptId) throw invalid("Công nợ phải lớn hơn 0.");
    return FinanceDebtModel.create({ ...scope, direction: input.direction, partyKind: input.partyKind, partyName, partyId, reference, sourceReceiptId, amount, balance: amount, occurredOn, dueOn, createdBy: actor });
  },
  async payDebt(scope: FinanceBranchScope, debtId: string, input: any, actor: string) {
    const amount = moneyInput(input.amount), key = text(input.key, "Khóa giao dịch");
    if (amount <= 0 || !Number.isSafeInteger(input.version)) throw invalid("Số tiền hoặc phiên bản không hợp lệ.");
    const filter = { ...scope, _id: id(debtId) };
    const replay = await FinanceDebtModel.findOne({ ...filter, "payments.key": key }).lean();
    if (replay) { if (replay.payments.find(p => p.key === key)?.amount !== amount) throw conflict(); return replay; }
    const paid = await FinanceDebtModel.findOneAndUpdate({ ...filter, version: input.version, balance: { $gte: amount }, "payments.key": { $ne: key } }, { $inc: { balance: -amount, version: 1 }, $push: { payments: { key, amount, at: new Date(), reference: String(input.reference || "").slice(0, 240), actorId: actor } } }, { returnDocument: "after" });
    if (!paid) throw conflict(); return paid;
  },
  async vat(scope: FinanceBranchScope, query: any) {
    if (!/^\d{4}-(\d{2}|Q[1-4])$/.test(String(query.period))) throw invalid("VAT cần chọn tháng hoặc quý.");
    const range = financeRange(query);
    const [items, settings, adjustmentOptions] = await Promise.all([FinanceVatInvoiceModel.find({ ...scope, issuedOn: { $gte: range.from, $lte: range.to } }).sort({ issuedOn: 1, _id: 1 }).lean(), FinanceVatPeriodModel.findOne({ ...scope, period: query.period }).lean(), FinanceVatInvoiceModel.find(scope).select("invoiceNumber series issuedOn partyName direction").sort({ issuedOn: -1 }).lean()]);
    return { range, items, adjustmentOptions, totals: vatTotals(items, settings?.openingCredit || 0), settings: settings || { period: query.period, openingCredit: 0, version: 0 }, openingCreditConfirmed: Boolean(settings), method: "deduction" };
  },
  async createInvoice(scope: FinanceBranchScope, input: any, actor: string) {
    if (!["input", "output"].includes(input.direction)) throw invalid("Loại hóa đơn không hợp lệ.");
    const taxableAmount = moneyInput(input.taxableAmount, true), vatAmount = moneyInput(input.vatAmount, true), deductibleVat = input.direction === "input" ? moneyInput(input.deductibleVat, true) : 0;
    const adjustmentOf = input.adjustmentOf ? id(input.adjustmentOf) : undefined;
    if (!adjustmentOf && (taxableAmount < 0 || vatAmount < 0 || deductibleVat < 0)) throw invalid("Số âm chỉ dành cho hóa đơn điều chỉnh giảm.");
    if (vatAmount * deductibleVat < 0 || Math.abs(deductibleVat) > Math.abs(vatAmount) || (vatAmount === 0 && deductibleVat !== 0)) throw invalid("VAT khấu trừ phải cùng dấu và không vượt VAT đầu vào.");
    const issuedOn = validDay(input.issuedOn), taxId = input.direction === "input" ? text(input.taxId, "Mã số thuế") : String(input.taxId || "").trim().slice(0, 50);
    if (adjustmentOf) {
      const original = await FinanceVatInvoiceModel.findOne({ ...scope, _id: adjustmentOf, direction: input.direction, taxId }).lean();
      if (!original || original.issuedOn > issuedOn) throw invalid("Hóa đơn gốc không hợp lệ hoặc có ngày sau hóa đơn điều chỉnh.");
    }
    return FinanceVatInvoiceModel.create({ ...scope, direction: input.direction, invoiceNumber: text(input.invoiceNumber, "Số hóa đơn"), series: text(input.series, "Ký hiệu hóa đơn"), partyName: text(input.partyName, "Đối tác"), taxId, issuedOn, taxableAmount, vatAmount, deductibleVat, adjustmentOf, note: String(input.note || "").slice(0, 1000), createdBy: actor });
  },
  async saveVatPeriod(scope: FinanceBranchScope, input: any, actor: string) {
    if (!/^\d{4}-(\d{2}|Q[1-4])$/.test(String(input.period))) throw invalid("Kỳ VAT không hợp lệ.");
    financeRange(input);
    if (!Number.isSafeInteger(input.version) || input.version < 0) throw conflict();
    const row = await FinanceVatPeriodModel.findOneAndUpdate({ ...scope, period: input.period, version: input.version }, { $set: { openingCredit: moneyInput(input.openingCredit), updatedBy: actor }, $inc: { version: 1 } }, { upsert: input.version === 0, returnDocument: "after" });
    if (!row) throw conflict(); return row;
  },
  async createExpense(scope: FinanceBranchScope, input: any, actor: string) {
    if (!["rent", "utilities", "marketing", "other", "income_tax", "payroll_manual"].includes(input.category)) throw invalid("Nhóm chi phí không hợp lệ.");
    const amount = moneyInput(input.amount); if (amount <= 0) throw invalid("Chi phí phải lớn hơn 0.");
    const idempotencyKey = text(input.key, "Khóa giao dịch"), description = text(input.description, "Nội dung chi"), incurredOn = new Date(`${validDay(input.incurredOn)}T12:00:00+07:00`);
    const existing = await OperatingExpenseModel.findOne({ ...scope, idempotencyKey }).lean();
    if (existing) { if (existing.amount !== amount || existing.category !== input.category || existing.description !== description || +existing.incurredOn !== +incurredOn) throw conflict(); return existing; }
    return OperatingExpenseModel.create({ ...scope, idempotencyKey, category: input.category, description, amount, incurredOn, status: "confirmed", createdBy: actor });
  },
  async plan(scope: FinanceBranchScope, month: string) {
    if (!/^\d{4}-\d{2}$/.test(month)) throw invalid("Tháng không hợp lệ."); financeRange({ period: month });
    return await FinanceMonthlyPlanModel.findOne({ ...scope, month }).lean() || { month, rent: 0, payroll: 0, otherFixed: 0, expectedUnitPrice: 0, expectedUnitCost: 0, variableCostPerUnit: 0, expectedCommissionPerUnit: 0, version: 0 };
  },
  async savePlan(scope: FinanceBranchScope, input: any, actor: string) {
    await this.plan(scope, input.month);
    if (!Number.isSafeInteger(input.version) || input.version < 0) throw conflict();
    const values = Object.fromEntries(["rent", "payroll", "otherFixed", "expectedUnitPrice", "expectedUnitCost", "variableCostPerUnit", "expectedCommissionPerUnit"].map(key => [key, moneyInput(input[key] ?? 0)]));
    const salesMix = Array.isArray(input.salesMix) ? input.salesMix.map((r: any) => ({ segment: String(r.segment), weight: Number(r.weight), price: moneyInput(r.price), cost: moneyInput(r.cost), variable: moneyInput(r.variable), commission: moneyInput(r.commission) })) : [];
    if (salesMix.length && (salesMix.length > 3 || new Set(salesMix.map((r: any) => r.segment)).size !== salesMix.length || salesMix.some((r: any) => !["phone", "accessory", "repair"].includes(r.segment) || !Number.isFinite(r.weight) || r.weight <= 0 || r.weight > 100) || Math.abs(salesMix.reduce((sum: number, r: any) => sum + r.weight, 0) - 100) > 0.000001)) throw invalid("Cơ cấu bán phải gồm các nhóm riêng biệt với tỷ trọng dương, tổng 100%.");
    const row = await FinanceMonthlyPlanModel.findOneAndUpdate({ ...scope, month: input.month, version: input.version }, { $set: { ...values, salesMix, updatedBy: actor }, $inc: { version: 1 } }, { upsert: input.version === 0, returnDocument: "after" });
    if (!row) throw conflict(); return row;
  },
  async profit(scope: FinanceBranchScope, query: any) {
    const range = financeRange(query), dateFilter = { $gte: range.start, $lte: range.end };
    const [orders, returns, repairs, legacy, expenses, payrolls, commissions, depreciation] = await Promise.all([
      RetailOrderModel.find({ ...scope, confirmedAt: { $exists: true }, $or: [{ confirmedAt: dateFilter }, { cancelledAt: dateFilter }] }).lean(),
      RetailAfterSaleModel.find({ ...scope, type: "return", createdAt: dateFilter }).lean(),
      RepairTicketModel.find({ ...scope, ...repairCompletionFilter(range.start, range.end) }).lean(),
      StockLogModel.find({ ...scope, type: "xuất", purpose: "bán", refType: { $ne: "retail-order" }, createdAt: dateFilter }).lean(),
      OperatingExpenseModel.find({ ...scope, status: "confirmed", incurredOn: dateFilter }).lean(),
      PayrollRunModel.find({ ...scope, status: { $in: ["closed", "paid"] }, periodKey: { $gte: range.from.slice(0, 7), $lte: range.to.slice(0, 7) } }).lean(),
      RetailCommissionLedgerModel.find({ ...scope, businessDate: { $gte: range.from, $lte: range.to } }).lean(),
      AssetDepreciationModel.find({ ...scope, status: "posted", period: { $gte: range.from.slice(0, 7), $lte: range.to.slice(0, 7) } }).lean(),
    ]);
    const movements: FinanceMovement[] = [], warnings: string[] = [];
    const push = (date: Date | string, source: string, code: string, revenue: number, cost: number, units = 0, sourceId?: string, composition?: { segment: string; quantity: number }[]) => { const day = typeof date === "string" && date.length === 10 ? date : financeToday(new Date(date)); if (inside(day, range)) movements.push({ date: day, source, sourceId, composition, code, revenue: Math.round(revenue), cost: Math.round(cost), units, grossProfit: Math.round(revenue - cost) }); };
    const additionalOrders = await RetailOrderModel.find({ ...scope, _id: { $in: returns.map(row => row.orderId).filter(orderId => !orders.some(order => String(order._id) === orderId)) } }).lean();
    const allOrders = [...orders, ...additionalOrders].filter(order => {
      const valid = [order.grandTotal, order.taxAmount, order.totalCost].every(Number.isFinite) && order.items.every(item => [item.lineTotal, item.quantity, item.unitCost].every(Number.isFinite));
      if (!valid) warnings.push(`Đơn ${order.orderCode}: thiếu giá bán/giá vốn gốc, chưa tính vào báo cáo.`);
      return valid;
    });
    const priorReturns = await RetailAfterSaleModel.find({ ...scope, type: "return", orderId: { $in: orders.filter(order => order.cancelledAt && inside(financeToday(order.cancelledAt), range)).map(order => String(order._id)) }, createdAt: { $lt: range.start } }).lean();
    movements.push(...retailFinancialMovements(allOrders, [...returns, ...priorReturns], range));
    for (const row of returns) if (!allOrders.some(order => String(order._id) === row.orderId)) warnings.push(`Thiếu đơn gốc cho trả hàng ${row.code}.`);
    for (const repair of repairs) { if (![repair.totalAmount, repair.partCost].every(Number.isFinite)) { warnings.push(`Phiếu sửa ${repair.ticketCode}: thiếu doanh thu/giá vốn, chưa tính vào báo cáo.`); continue; } push(repair.completedAt ?? repair.deliveredAt!, "repair", repair.ticketCode, repair.totalAmount, repair.partCost, 0, String(repair._id), [{ segment: "repair", quantity: 1 }]); }
    if (repairs.length) warnings.push("Doanh thu sửa chữa dùng tổng tiền phiếu; phiếu hiện chưa tách VAT riêng.");
    const refunds = await verifiedRepairRefunds(scope, range.start, range.end);
    for (const row of refunds) push(row.refund.at, "repair-refund", `${row.ticketCode} / ${row.refund.reference}`, -row.refund.amount, 0, 0, row.refund.financeVoucherId, [{ segment: "repair", quantity: 0 }]);
    if (repairs.length || refunds.length) warnings.push(repairRefundReportingNote);
    for (const log of legacy) for (const item of log.items || []) {
      if (![item.lineTotal, item.unitCost, item.quantity].every(Number.isFinite)) { warnings.push(`Phiếu kho ${log._id}: thiếu giá bán/giá vốn, chưa tính vào báo cáo.`); continue; }
      push(log.createdAt!, "inventory", String(log._id), item.lineTotal, item.unitCost * item.quantity, 0, String(log._id));
    }
    if (legacy.length) warnings.push("Bán trực tiếp từ kho dùng giá trị phiếu; phiếu hiện chưa tách VAT riêng.");
    const expenseRows = expenses.map(e => ({ category: e.category === "payroll_manual" ? "payroll" : e.category, amount: e.amount, sourceId: String(e._id), source: "expense", reference: e.description, date: financeToday(e.incurredOn) }));
    const prorata = (month: string, amount: number) => { const r = financeRange({ period: month }); const start = Math.max(+new Date(range.from), +new Date(r.from)), end = Math.min(+new Date(range.to), +new Date(r.to)); return Math.round(amount * Math.max(0, (end - start) / 86400000 + 1) / ((+new Date(r.to) - +new Date(r.from)) / 86400000 + 1)); };
    for (const run of payrolls) {
      try {
        const loaded = await loadAuthoritativePayrollLines(scope, run as any);
        const employerCost = loaded.effectiveLines.reduce((sum: number, line: any) => sum + Number(line.vietnam?.employerCost ?? line.calculation?.gross), 0);
        if (!Number.isFinite(employerCost) || (!loaded.effectiveLines.length && Number(run.totals?.grossPay) > 0)) throw new Error("Missing payroll lines");
        expenseRows.push({ category: "payroll", amount: prorata(run.periodKey, employerCost), sourceId: String(run._id), source: "payroll", reference: `Lương ${run.periodKey}`, date: run.periodKey + "-01" });
      } catch { warnings.push(`Bảng lương ${run.periodKey}: chưa xác minh được dữ liệu đã chốt, chưa tính chi phí; cần đối soát bảng lương.`); }
    }
    for (const row of depreciation) expenseRows.push({ category: "depreciation", amount: prorata(row.period, row.amount), sourceId: String(row._id), source: "depreciation", reference: `Khấu hao ${row.period}`, date: row.period + "-01" });
    for (const row of commissions) expenseRows.push({ category: "commission", amount: row.amount, sourceId: String(row._id), source: "commission", reference: row.sourceCode || row.reason, date: row.businessDate });
    if (!payrolls.length) warnings.push("Chưa có bảng lương đã chốt trong kỳ. Chi phí lương chỉ gồm khoản được ghi nhận thủ công (nếu có).");
    warnings.push("Lương đã chốt và khấu hao đã ghi sổ được phân bổ theo ngày trong tháng. Thuế TNDN chỉ tính khi có chi phí thuế được ghi nhận.");
    const issues = warnings.filter(w => !w.startsWith("Lương đã chốt và khấu hao"));
    if (!expenseRows.some(e => e.category === "rent")) issues.push("Chưa ghi nhận chi phí mặt bằng trong kỳ; cần xác nhận nếu không phát sinh.");
    const completeness = { status: issues.length ? "incomplete" : "provisional", label: issues.length ? "Chưa đủ dữ liệu để kết luận lợi nhuận" : "Số liệu tạm tính — cần đối soát chứng từ", issues };
    return { range, completeness, expenseDetails: expenseRows, totals: profitTotals(movements, expenseRows), movements: movements.sort((a, b) => a.date.localeCompare(b.date)), expenses, commissions, lossSales: movements.filter(row => row.source !== "return" && row.source !== "cancellation" && row.source !== "repair-refund" && row.revenue - row.cost < 0), warnings: [...new Set(warnings)] };
  },
  async breakeven(scope: FinanceBranchScope, month: string) {
    const plan = await this.plan(scope, month), report = await this.profit(scope, { period: month });
    const contributions = [...report.movements, ...report.commissions.map(c => ({ date: c.businessDate, source: "commission", code: c.sourceCode || "", revenue: 0, cost: c.amount, units: 0 }))];
    return { month, plan, actualExpenses: { rent: report.totals.rent, payroll: report.totals.payroll, otherFixed: report.totals.otherExpenses }, completeness: report.completeness, configured: Boolean((plan as any)._id), result: breakEven(plan, contributions), warnings: report.warnings };
  },
};

import mongoose from "mongoose";
import { connectDB } from "../config/database";
import { ReceivableModel } from "../modules/finance/models/receivable.model";
import { ReceivableLedgerService } from "../modules/finance/services/receivable-ledger.service";
import { RetailOrderModel } from "../modules/retail/models/retail-order.model";
import { RetailReceivableEntryModel } from "../modules/retail/models/retail-receivable-entry.model";
import { reconcileReceivableTotals } from "../modules/finance/services/receivable-reconciliation.service";

export type FinanceBackfillOptions = { mode: "dry-run" | "apply" | "reconcile"; companyCode: string; branchId: string };

function option(args: string[], name: string) {
  const exact = args.indexOf(name); if (exact >= 0) return args[exact + 1];
  return args.find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function parseFinanceBackfillOptions(args: string[]): FinanceBackfillOptions {
  const modes = (["dry-run", "apply", "reconcile"] as const).filter((mode) => args.includes(`--${mode}`));
  if (modes.length !== 1) throw new Error("Chọn đúng một chế độ --dry-run, --apply hoặc --reconcile.");
  const companyCode = String(option(args, "--company") || "").trim().toUpperCase();
  const branchId = String(option(args, "--branch") || "").trim();
  if (!companyCode || !branchId) throw new Error("--company và --branch là bắt buộc.");
  return { mode: modes[0], companyCode, branchId };
}

export function mapLegacyReceivable(order: any, rawEntries: any[]) {
  const orderId = String(order?._id || "").trim();
  const customerId = String(order?.customerId || "").trim();
  const orderCode = String(order?.orderCode || "").trim();
  if (!orderId || !customerId || !orderCode) throw new Error("LEGACY_SOURCE_OR_CUSTOMER_REQUIRED");
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) throw new Error("LEGACY_LEDGER_REQUIRED");
  const entries = [...rawEntries].sort((a, b) => new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf()).map((entry) => {
    const amount = Number(entry.signedAmount);
    if (!Number.isSafeInteger(amount) || amount === 0) throw new Error("LEGACY_INVALID_VND");
    return {
      legacyId: String(entry._id), type: String(entry.type), amount, reason: entry.reason,
      idempotencyKey: `legacy:retail-entry:${entry._id}`, createdAt: new Date(entry.createdAt),
      reversalOfLegacyId: entry.reversesEntryId ? String(entry.reversesEntryId) : undefined,
      createdBy: String(entry.createdBy || "system:backfill"), createdByName: String(entry.createdByName || "Finance backfill"),
    };
  });
  const balance = entries.reduce((sum, entry) => sum + entry.amount, 0);
  if (!Number.isSafeInteger(Number(order.dueAmount)) || balance !== Number(order.dueAmount) || balance < 0) throw new Error("LEGACY_BALANCE_MISMATCH");
  const originalAmount = entries.filter((entry) => entry.type === "charge").reduce((sum, entry) => sum + entry.amount, 0);
  const paidAmount = -entries.filter((entry) => entry.type === "payment").reduce((sum, entry) => sum + entry.amount, 0);
  const adjustedAmount = entries.filter((entry) => entry.type === "adjustment" || entry.type === "reversal").reduce((sum, entry) => sum + entry.amount, 0);
  return {
    companyCode: String(order.companyCode).toUpperCase(), branchId: String(order.branchId), receivableCode: `CN-LEGACY-${orderCode}`,
    sourceType: "retail_order", sourceId: orderId, sourceCode: orderCode, sourceEventId: `legacy:retail-order:${orderId}`,
    customerId, customerName: String(order.customerName || ""), occurredAt: new Date(order.confirmedAt || entries[0].createdAt),
    dueDate: new Date(order.dueDate), originalAmount, paidAmount, adjustedAmount, balance,
    status: balance === 0 ? "settled" : paidAmount > 0 ? "partially_paid" : "open", entries,
  };
}

type Dependencies = {
  scan(options: FinanceBackfillOptions): Promise<Array<{ order: any; entries: any[] }>>;
  exists(sourceEventId: string, options: FinanceBackfillOptions): Promise<boolean>;
  apply(candidate: any): Promise<void>;
  reconcile(options: FinanceBackfillOptions): Promise<any>;
};

export async function runFinanceReceivableBackfill(options: FinanceBackfillOptions, dependencies: Dependencies) {
  if (options.mode === "reconcile") return dependencies.reconcile(options);
  const rows = await dependencies.scan(options);
  const summary = { scanned: rows.length, convertible: 0, created: 0, skipped: 0, errors: [] as Array<{ sourceId: string; error: string }>, writes: 0 };
  for (const row of rows) {
    let candidate: any;
    try { candidate = mapLegacyReceivable(row.order, row.entries); summary.convertible += 1; }
    catch (error) { summary.errors.push({ sourceId: String(row.order?._id || ""), error: (error as Error).message }); continue; }
    if (options.mode === "dry-run") continue;
    if (await dependencies.exists(candidate.sourceEventId, options)) { summary.skipped += 1; continue; }
    await dependencies.apply(candidate); summary.created += 1; summary.writes += 1;
  }
  return summary;
}

async function defaultDependencies(): Promise<Dependencies> {
  return {
    async scan(options) {
      const orders = await RetailOrderModel.find({ companyCode: options.companyCode, branchId: options.branchId, customerId: { $type: "string" }, orderCode: { $type: "string" } }).lean();
      return Promise.all(orders.map(async (order: any) => ({ order, entries: await RetailReceivableEntryModel.find({ companyCode: options.companyCode, branchId: options.branchId, orderId: String(order._id) }).sort({ createdAt: 1 }).lean() })));
    },
    exists: (sourceEventId, options) => ReceivableModel.exists({ companyCode: options.companyCode, branchId: options.branchId, sourceEventId }).then(Boolean),
    apply: (candidate) => ReceivableLedgerService.importLegacy(candidate).then(() => undefined),
    async reconcile(options) {
      const [orders, receivables] = await Promise.all([
        RetailOrderModel.find({ companyCode: options.companyCode, branchId: options.branchId, customerId: { $type: "string" }, orderCode: { $type: "string" } }).select({ companyCode: 1, branchId: 1, customerId: 1, dueAmount: 1 }).lean(),
        ReceivableModel.find({ companyCode: options.companyCode, branchId: options.branchId, sourceType: "retail_order" }).select({ companyCode: 1, branchId: 1, customerId: 1, sourceId: 1, balance: 1 }).lean(),
      ]);
      return reconcileReceivableTotals(
        orders.map((row: any) => ({ companyCode: row.companyCode, branchId: row.branchId, customerId: row.customerId, sourceId: String(row._id), balance: row.dueAmount })),
        receivables.map((row: any) => ({ companyCode: row.companyCode, branchId: row.branchId, customerId: row.customerId, sourceId: row.sourceId, balance: row.balance })),
      );
    },
  };
}

async function main() {
  const options = parseFinanceBackfillOptions(process.argv.slice(2)); await connectDB();
  try { console.log(JSON.stringify(await runFinanceReceivableBackfill(options, await defaultDependencies()), null, 2)); }
  finally { await mongoose.disconnect(); }
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/backfill-finance-receivables.ts")) void main().catch((error) => { console.error(error); process.exitCode = 1; });

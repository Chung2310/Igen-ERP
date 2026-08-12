import mongoose from "mongoose";
import { RetailOrderModel } from "../modules/retail/models/retail-order.model";
import { RetailReceivableEntryModel } from "../modules/retail/models/retail-receivable-entry.model";

export function parseBackfillOptions(args: string[]) { return { apply: args.includes("--apply") }; }

export function buildReceivableBackfillCandidates(orders: any[]) {
  return orders.filter((order) => ["confirmed", "completed"].includes(order.status) && order.customerId && Number(order.dueAmount) > 0).map((order) => ({
    type: "charge" as const, customerId: String(order.customerId), orderId: String(order._id), amount: Number(order.dueAmount), signedAmount: Number(order.dueAmount), idempotencyKey: `retail-order:${order._id}:debt-charge`,
  }));
}

export async function runRetailReceivableBackfill({ apply, companyCode, branchId }: { apply: boolean; companyCode: string; branchId: string }) {
  if (!companyCode || !branchId) throw new Error("--company and --branch are required");
  const scope = { companyCode, branchId };
  const orders = await RetailOrderModel.find({ ...scope, status: { $in: ["confirmed", "completed"] }, customerId: { $type: "string" }, dueAmount: { $gt: 0 } }).lean();
  const candidates = buildReceivableBackfillCandidates(orders);
  if (!apply) return { mode: "dry-run", candidates: candidates.length, created: 0 };
  let created = 0;
  for (const candidate of candidates) {
    const result = await RetailReceivableEntryModel.updateOne({ companyCode, idempotencyKey: candidate.idempotencyKey }, { $setOnInsert: { ...scope, ...candidate, createdBy: "system:backfill", createdByName: "Retail receivable backfill" } }, { upsert: true });
    created += result.upsertedCount || 0;
  }
  return { mode: "apply", candidates: candidates.length, created };
}

async function main() {
  const args = process.argv.slice(2);
  const value = (prefix: string) => args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || "";
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/igen-erp");
  try { console.log(await runRetailReceivableBackfill({ ...parseBackfillOptions(args), companyCode: value("--company="), branchId: value("--branch=") })); }
  finally { await mongoose.disconnect(); }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/backfill-retail-receivables.ts")) void main().catch((error) => { console.error(error); process.exitCode = 1; });

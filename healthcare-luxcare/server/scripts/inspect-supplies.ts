/** Explicit read-only inspection. Does not load .env or alter business records. */
import mongoose from "mongoose";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { SupplyModel } from "../model/supply.model";
import { SupplyTransactionModel } from "../model/supply-transaction.model";
import { inspectSupplySnapshot } from "../service/supply/inspection";

async function main() {
  const companyAt = process.argv.indexOf("--company");
  const companyCode = companyAt >= 0 ? process.argv[companyAt + 1]?.trim() : "";
  const uri = process.env.SUPPLY_INSPECT_MONGODB_URI;
  if (!companyCode || !uri)
    throw new Error("Required: SUPPLY_INSPECT_MONGODB_URI and --company COMPANY. No .env fallback.");
  const startedAt = new Date();
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  const supplyCount = await SupplyModel.countDocuments({ companyCode });
  const transactionCount = await SupplyTransactionModel.countDocuments({ companyCode });
  if (supplyCount > 100000 || transactionCount > 1000000)
    throw new Error("Snapshot exceeds inspection memory limit; use a streaming inspection before migration.");
  const supplies = await SupplyModel.find({ companyCode }).lean();
  const transactions = await SupplyTransactionModel.find({ companyCode }).sort({ createdAt: 1, _id: 1 }).lean();
  const report = {
    companyCode,
    startedAt,
    completedAt: new Date(),
    transactionCapable: Boolean(hello.setName || hello.msg === "isdbgrid"),
    ...inspectSupplySnapshot(supplies, transactions),
  };
  const directory = path.resolve("tmp", "supply-inspection");
  await mkdir(directory, { recursive: true });
  const output = path.join(directory, `inspection-${Date.now()}.json`);
  await writeFile(output, JSON.stringify(report, null, 2), "utf8");
  console.log(
    JSON.stringify({
      output,
      supplies: supplyCount,
      transactions: transactionCount,
      transactionCapable: report.transactionCapable,
      issueCounts: Object.fromEntries(Object.entries(report.issues).map(([k, v]) => [k, v.count])),
    }),
  );
}
main()
  .catch(() => {
    console.error(
      "Supply inspection failed. Check the explicitly supplied database, company and snapshot limits; no business data was modified.",
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

/** Explicit index provisioning only: never activates V2 or modifies stock. */
import mongoose from "mongoose";
import { inspectInventoryIndexes } from "../service/supply/inventory-indexes";

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply")) throw new Error("Only --apply is supported.");
  const uri = process.env.SUPPLY_PROVISION_MONGODB_URI;
  if (!uri) throw new Error("SUPPLY_PROVISION_MONGODB_URI is required; no .env fallback.");
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid") throw new Error("Transaction-capable MongoDB is required.");
  const before = await inspectInventoryIndexes(false);
  console.log(JSON.stringify({ mode: args.includes("--apply") ? "apply" : "dry-run", indexes: before }));
  if (args.includes("--apply")) console.log(JSON.stringify({ indexes: await inspectInventoryIndexes(true) }));
}
main()
  .catch((error) => {
    console.error(
      "Inventory provisioning failed:",
      error?.code || "Check explicit URI, topology and index compatibility.",
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

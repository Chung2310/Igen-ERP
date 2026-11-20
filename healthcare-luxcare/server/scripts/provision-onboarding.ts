/** Additive metadata provisioning. Never assigns or migrates existing users. */
import mongoose from "mongoose";
import { onboardingModels } from "../model/onboarding.model";
import { CompanyModel } from "../model/company.model";
import { BranchModel } from "../model/branch.model";
async function main() {
  const args = process.argv.slice(2);
  if (args.some(v => v !== "--apply")) throw new Error("Only --apply is supported.");
  const uri = process.env.ONBOARDING_PROVISION_MONGODB_URI;
  if (!uri) throw new Error("ONBOARDING_PROVISION_MONGODB_URI is required; no .env fallback.");
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid") throw new Error("Transaction-capable MongoDB is required.");
  const apply = args.includes("--apply");
  for (const entry of [...onboardingModels, CompanyModel, BranchModel]) {
    if (apply) { await entry.createCollection(); await entry.createIndexes(); }
    const indexes = await entry.collection.listIndexes().toArray().catch((error: any) => {
      if (error.code === 26) return []; throw error;
    });
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", collection: entry.collection.name,
      indexes: indexes.map(v => ({ name: v.name, key: v.key, unique: v.unique, partial: v.partialFilterExpression })) }));
  }
  console.log(JSON.stringify({ legacyMembershipModified: false, transactionsSupported: true }));
}
main().catch((error: any) => {
  console.error("Onboarding provisioning failed:", error?.code || "Check explicit URI, topology and index compatibility.");
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());

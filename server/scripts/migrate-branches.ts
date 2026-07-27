import "dotenv/config";
import mongoose from "mongoose";
import { CompanyModel } from "../model/company.model";
import { UserModel } from "../model/user.model";
import { BranchModel } from "../model/branch.model";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/igen-erp");
  const companies = await CompanyModel.find({}).select("code name").lean();
  let created = 0;
  for (const company of companies) {
    const branch = await BranchModel.findOneAndUpdate(
      { companyCode: company.code, code: "MAIN" },
      { $setOnInsert: { companyCode: company.code, code: "MAIN", name: `${company.name} - Main`, isActive: true } },
      { upsert: true, new: true }
    ).lean();
    if (branch) created += 1;
    await UserModel.updateMany({ companyCode: company.code, $or: [{ branchId: { $exists: false } }, { branchId: "" }] }, { $set: { branchId: String(branch._id) } });
  }
  console.log(`Branch migration complete: ${created} default branches checked.`);
  await mongoose.disconnect();
}

main().catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exitCode = 1; });

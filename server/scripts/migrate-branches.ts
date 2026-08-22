import "dotenv/config";
import mongoose from "mongoose";
import { CompanyModel } from "../model/company.model";
import { UserModel } from "../model/user.model";
import { BranchModel } from "../model/branch.model";
import { ProductModel } from "../model/product.model";
import { CategoryModel } from "../model/category.model";
import { StockLogModel } from "../model/stock-log.model";
import { ProjectModel } from "../model/project.model";
import { KanbanTaskModel } from "../model/kanban-task.model";
import { WorkflowModel } from "../model/workflow.model";
import { ChatRoomModel } from "../model/chat-room.model";
import { ResourceItemModel } from "../model/resource-item.model";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/igen-erp");
  const companies = await CompanyModel.find({}).select("code name").lean();
  let created = 0;
  for (const company of companies) {
    const branch = await BranchModel.findOneAndUpdate(
      { companyCode: company.code, code: "MAIN" },
      { $setOnInsert: { companyCode: company.code, code: "MAIN", name: `${company.name} - Main`, isActive: true } },
      { upsert: true, returnDocument: 'after' }
    ).lean();
    if (branch) created += 1;
    const missingBranch = { $or: [{ branchId: { $exists: false } }, { branchId: "" }] };
    const branchId = String(branch._id);
    await Promise.all([
      UserModel.updateMany({ companyCode: company.code, ...missingBranch }, { $set: { branchId } }),
      ProductModel.updateMany({ companyCode: company.code, ...missingBranch }, { $set: { branchId } }),
      CategoryModel.updateMany({ companyCode: company.code, ...missingBranch }, { $set: { branchId } }),
      StockLogModel.updateMany({ companyCode: company.code, ...missingBranch }, { $set: { branchId } }),
      ProjectModel.updateMany({ companyCode: company.code, ...missingBranch }, { $set: { branchId } }),
      KanbanTaskModel.updateMany({ companyCode: company.code, ...missingBranch }, { $set: { branchId } }),
      WorkflowModel.updateMany({ companyCode: company.code, ...missingBranch }, { $set: { branchId } }),
      ChatRoomModel.updateMany({ companyCode: company.code, ...missingBranch }, { $set: { branchId } }),
      ResourceItemModel.updateMany({ companyCode: company.code, ...missingBranch }, { $set: { branchId } }),
    ]);
  }
  console.log(`Branch migration complete: ${created} default branches checked.`);
  await mongoose.disconnect();
}

main().catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exitCode = 1; });

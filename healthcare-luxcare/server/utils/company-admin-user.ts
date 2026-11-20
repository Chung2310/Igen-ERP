import { logger } from "../config/logger";
import bcrypt from "bcryptjs";
import { UserModel } from "../model/user.model";
import { BranchModel } from "../model/branch.model";

export interface CreateCompanyAdminUserInput {
  companyCode: string;
  companyName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}

/**
 * Tạo tài khoản admin đầu tiên của một doanh nghiệp (dùng chung cho luồng đăng ký công khai
 * `registerCompanyAndAdmin` và luồng super-admin `TenantManagementService.create`).
 * Không kiểm tra trùng companyCode/ownerEmail — caller chịu trách nhiệm kiểm tra trước khi gọi.
 */
export async function createCompanyAdminUser(input: CreateCompanyAdminUserInput) {
  const { companyCode, companyName, ownerName, ownerEmail, ownerPassword } = input;
  const hashedPassword = await bcrypt.hash(ownerPassword, 10);
  const adminUser = new UserModel({
    email: ownerEmail.toLowerCase().trim(),
    password: hashedPassword,
    displayName: ownerName.trim(),
    role: "admin",
    createdAt: new Date(),
    companyCode,
    companyName: companyName.trim(),
    jobTitle: "CEO",
    department: "Ban Giám Đốc",
    division: "Ban Giám Đốc",
    level: 1,
    status: "offline",
    photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(ownerName.trim())}&background=random&color=fff`,
  });
  await adminUser.save();

  // Tự động khởi tạo chi nhánh MAIN (Trụ sở chính) với người quản lý cao nhất là Admin/CEO
  try {
    let mainBranch = await BranchModel.findOne({ companyCode, code: "MAIN" });
    if (!mainBranch) {
      mainBranch = await BranchModel.create({
        companyCode,
        code: "MAIN",
        name: "Trụ sở chính",
        isActive: true,
        managerId: String(adminUser._id),
      });
    } else if (!mainBranch.managerId) {
      mainBranch.managerId = String(adminUser._id);
      await BranchModel.updateOne({ _id: mainBranch._id }, { $set: { managerId: String(adminUser._id) } });
    }

    if (mainBranch && !adminUser.branchId) {
      adminUser.branchId = String(mainBranch._id);
      await UserModel.updateOne({ _id: adminUser._id }, { $set: { branchId: String(mainBranch._id) } });
    }
  } catch (error) {
    logger.error("[createCompanyAdminUser] Error ensuring MAIN branch:", error);
  }

  return adminUser;
}

import bcrypt from "bcryptjs";
import { UserModel } from "../model/user.model";

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
  return adminUser;
}

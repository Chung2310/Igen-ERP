import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { UserModel } from "../model/user.model";
import { auditService } from "./audit.service";

const fields = "_id email displayName createdAt isActive superAdminSecurity.totpEnabled";

export const superAdminAccountService = {
  async list() {
    return UserModel.find({ role: "superadmin" }).select(fields).sort({ createdAt: -1 }).lean();
  },
  async create(input: { displayName: string; email: string; password: string }, actorSuperAdminId: string) {
    const email = input.email.trim().toLowerCase();
    if (await UserModel.exists({ email })) {
      const error: any = new Error("Email đã được sử dụng."); error.statusCode = 409; throw error;
    }
    const account = await UserModel.create({
      displayName: input.displayName.trim(), email, password: await bcrypt.hash(input.password, 12),
      role: "superadmin", companyCode: "SYSTEM", status: "offline", isActive: true,
      superAdminSecurity: { totpEnabled: false, recoveryCodeHashes: [], failedTotpAttempts: 0 },
    });
    await auditService.record({ actionType: "platform.superadmin.create", actorSuperAdminId: new Types.ObjectId(actorSuperAdminId), result: "success", riskClass: "sensitive", entityType: "user", entityId: String(account._id), metadata: { email: account.email } });
    return UserModel.findById(account._id).select(fields).lean();
  },
};

import { Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  password?: string;
  displayName: string;
  role: string;
  centerId?: string;
  companyCode?: string;
  createdBy?: string;
  bankAccountNo?: string;
  bankId?: string;
  bankAccountName?: string;
  bankQrEnabled?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  smtpSandboxEmail?: string;
  businessType?: "driving" | "language" | "general";
  isActive?: boolean;
  maxUsersLimit?: number;
  permissions?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

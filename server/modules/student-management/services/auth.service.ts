import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";
import { IUser } from "../interfaces/user.interface";
import { logger } from "../config/logger";
import { SmsSettingsPayload, SmsSettingsService } from "./sms-settings.service";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "your_jwt_access_secret_key_should_be_long_and_secure_12345";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your_jwt_refresh_secret_key_should_be_long_and_secure_67890";

interface RegisterData {
  email: string;
  password: string;
  displayName: string;
  gasUrl?: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface ManagedUserCreateData extends RegisterData {
  role: "admin" | "user";
  centerId?: string;
  bankAccountNo?: string;
  bankId?: string;
  businessType?: "driving" | "language" | "general";
  maxUsersLimit?: number;
  permissions?: string[];
}

export class AuthService {
  private static serializeUser(user: IUser) {
    return {
      uid: user._id.toString(),
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      centerId: user.centerId,
      createdBy: user.createdBy,
      bankAccountNo: user.bankAccountNo,
      bankId: user.bankId,
      bankAccountName: user.bankAccountName,
      smtpHost: user.smtpHost,
      smtpPort: user.smtpPort,
      smtpSecure: user.smtpSecure,
      smtpUser: user.smtpUser,
      smtpPass: user.smtpPass,
      smtpFrom: user.smtpFrom,
      smtpSandboxEmail: user.smtpSandboxEmail,
      isActive: user.isActive !== false,
      businessType: user.businessType || "driving",
      maxUsersLimit: user.maxUsersLimit,
      permissions: user.permissions || [],
    };
  }

  static async register(data: RegisterData): Promise<IUser> {
    logger.info(`[Auth] Registration attempt for email: ${data.email}`);
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      logger.warn(`[Auth] Registration failed - Email already exists: ${data.email}`);
      throw new Error("Email này đã được sử dụng cho một tài khoản khác.");
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const newUser = new User({
      ...data,
      password: hashedPassword,
      role: "admin",
      centerId: "",
      createdBy: "",
    }) as unknown as IUser;
    newUser.centerId = newUser._id.toString();
    const savedUser = await newUser.save();
    logger.info(`[Auth] User registered successfully: email=${savedUser.email}, uid=${savedUser._id}`);
    return savedUser;
  }

  static async login(data: LoginData) {
    logger.info(`[Auth] Login attempt for email: ${data.email}`);
    const user = await User.findOne({ email: data.email }) as unknown as IUser | null;
    if (!user) {
      logger.warn(`[Auth] Login failed - User not found: ${data.email}`);
      throw new Error("Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.");
    }
    if (user.isActive === false) {
      logger.warn(`[Auth] Login failed - Account locked: ${data.email}`);
      throw new Error("Tài khoản của bạn đã bị khoá. Vui lòng liên hệ quản trị viên.");
    }
    const isPasswordValid = await bcrypt.compare(data.password, user.password!);
    if (!isPasswordValid) {
      logger.warn(`[Auth] Login failed - Invalid password for email: ${data.email}`);
      throw new Error("Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.");
    }

    const accessToken = jwt.sign(
      { uid: user._id, email: user.email, role: user.role, centerId: user.centerId },
      ACCESS_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { uid: user._id, email: user.email, role: user.role, centerId: user.centerId },
      REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    logger.info(`[Auth] User logged in successfully: email=${user.email}, uid=${user._id}`);

    return {
      user: this.serializeUser(user),
      accessToken,
      refreshToken,
    };
  }

  static async verifyRefreshToken(token: string) {
    try {
      const decoded = jwt.verify(token, REFRESH_SECRET) as {
        uid: string;
        email: string;
        role: "superadmin" | "admin" | "user";
        centerId: string;
      };
      logger.info(`[Auth] Verifying refresh token for email: ${decoded.email}`);
      const user = await User.findById(decoded.uid) as unknown as IUser | null;
      if (!user) {
        logger.warn(`[Auth] Refresh token verification failed - User not found for uid: ${decoded.uid}`);
        throw new Error("Người dùng không tồn tại.");
      }
      if (user.isActive === false) {
        throw new Error("Tài khoản của bạn đã bị khoá. Vui lòng liên hệ quản trị viên.");
      }

      const accessToken = jwt.sign(
        { uid: user._id, email: user.email, role: user.role, centerId: user.centerId },
        ACCESS_SECRET,
        { expiresIn: "15m" }
      );

      logger.info(`[Auth] Refresh token verified successfully for email: ${user.email}`);

      return {
        accessToken,
        user: this.serializeUser(user)
      };
    } catch (error) {
      logger.error(`[Auth] Refresh token verification failed: ${error instanceof Error ? error.message : error}`);
      throw new Error("Refresh token không hợp lệ hoặc đã hết hạn.", { cause: error });
    }
  }

  static async updateBankSettings(uid: string, data: { bankAccountNo?: string; bankId?: string; bankAccountName?: string; bankQrEnabled?: boolean }): Promise<IUser | null> {
    logger.info(`[Auth] Updating bank settings for uid: ${uid}`);
    return await User.findByIdAndUpdate(
      uid,
      {
        $set: {
          bankAccountNo: data.bankAccountNo || "",
          bankId: data.bankId ? data.bankId.trim().toLowerCase() : "",
          bankAccountName: data.bankAccountName || "",
          bankQrEnabled: data.bankQrEnabled !== undefined ? data.bankQrEnabled : true,
        },
      },
      { new: true }
    );
  }

  static async updateBusinessSettings(uid: string, data: { businessType: "driving" | "language" | "general" }): Promise<IUser | null> {
    logger.info(`[Auth] Updating business settings for uid: ${uid} to ${data.businessType}`);
    return await User.findByIdAndUpdate(
      uid,
      {
        $set: {
          businessType: data.businessType,
        },
      },
      { new: true }
    );
  }

  static async updateSmtpSettings(uid: string, data: Partial<IUser>): Promise<IUser | null> {
    logger.info(`[Auth] Updating SMTP settings for uid: ${uid}`);
    return await User.findByIdAndUpdate(
      uid,
      {
        $set: {
          smtpHost: data.smtpHost || "",
          smtpPort: data.smtpPort !== undefined ? data.smtpPort : 587,
          smtpSecure: data.smtpSecure !== undefined ? data.smtpSecure : false,
          smtpUser: data.smtpUser || "",
          smtpPass: data.smtpPass || "",
          smtpFrom: data.smtpFrom || "",
          smtpSandboxEmail: data.smtpSandboxEmail || "",
        },
      },
      { new: true }
    );
  }

  static async getUserProfile(uid: string): Promise<IUser | null> {
    return await User.findById(uid);
  }

  static async listUsers(requester: { uid: string; role: string; centerId: string }) {
    if (requester.role === "user") {
      throw new Error("Ban khong co quyen xem danh sach nguoi dung.");
    }

    const query = requester.role === "superadmin" ? {} : { centerId: requester.centerId };
    const users = await User.find(query).sort({ createdAt: -1 });
    return users.map((user) => this.serializeUser(user));
  }

  static async createManagedUser(
    requester: { uid: string; role: string; centerId: string },
    data: ManagedUserCreateData
  ) {
    if (requester.role === "user") {
      throw new Error("Ban khong co quyen tao nguoi dung.");
    }

    if (requester.role === "admin") {
      if (data.role !== "user") {
        throw new Error("Admin chi duoc tao user trong trung tam cua minh.");
      }
      const adminUser = await User.findById(requester.uid) as unknown as IUser | null;
      const limit = adminUser?.maxUsersLimit ?? 10;
      const centerIdToCheck = requester.centerId || requester.uid;
      const currentUserCount = await User.countDocuments({ centerId: centerIdToCheck, role: "user" });
      if (currentUserCount >= limit) {
        throw new Error(`Trung tâm của bạn đã đạt giới hạn tối đa ${limit} tài khoản nhân viên.`);
      }
    }

    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new Error("Email nay da duoc su dung cho mot tai khoan khac.");
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const newUser = new User({
      email: data.email,
      password: hashedPassword,
      displayName: data.displayName,
      bankAccountNo: data.bankAccountNo || "",
      bankId: data.bankId || "",
      role: data.role,
      centerId: requester.role === "admin" ? (requester.centerId || requester.uid) : (data.centerId || ""),
      createdBy: requester.uid,
      businessType: data.businessType || "driving",
      permissions: data.permissions || [],
    }) as unknown as IUser;

    if (requester.role === "superadmin" && data.maxUsersLimit !== undefined) {
      newUser.maxUsersLimit = data.maxUsersLimit;
    }

    if (data.role === "admin") {
      newUser.centerId = newUser._id.toString();
    } else if (requester.role === "superadmin" && !newUser.centerId) {
      throw new Error("Superadmin tao user can chi dinh centerId.");
    }

    const savedUser = await newUser.save();
    return this.serializeUser(savedUser);
  }

  static async updateManagedUser(
    requester: { uid: string; role: string; centerId: string },
    userId: string,
    data: {
      displayName?: string;
      email?: string;
      password?: string;
      isActive?: boolean;
      role?: "admin" | "user";
      centerId?: string;
      bankAccountNo?: string;
      bankId?: string;
      businessType?: "driving" | "language" | "general";
      maxUsersLimit?: number;
      permissions?: string[];
    }
  ) {
    if (requester.role === "user") {
      throw new Error("Bạn không có quyền sửa thông tin người dùng.");
    }

    const userToEdit = await User.findById(userId) as unknown as IUser | null;
    if (!userToEdit) {
      throw new Error("Người dùng không tồn tại.");
    }

    // Role checks
    if (requester.role === "admin") {
      if (userToEdit.centerId !== requester.centerId) {
        throw new Error("Bạn không có quyền sửa người dùng ngoài trung tâm.");
      }
      if (userToEdit.role !== "user") {
        throw new Error("Bạn chỉ có quyền sửa nhân viên thuộc trung tâm của mình.");
      }
    }

    // Prepare updates
    const updates: Record<string, unknown> = {};
    if (data.displayName !== undefined) updates.displayName = data.displayName;
    if (data.email !== undefined) {
      // Check if email already taken
      const existing = await User.findOne({ email: data.email, _id: { $ne: userId } });
      if (existing) {
        throw new Error("Email này đã được sử dụng bởi người dùng khác.");
      }
      updates.email = data.email;
    }
    if (data.password) {
      updates.password = await bcrypt.hash(data.password, 10);
    }
    if (data.isActive !== undefined) {
      // Cannot block oneself
      if (userId === requester.uid && !data.isActive) {
        throw new Error("Bạn không thể tự khóa tài khoản của chính mình.");
      }
      updates.isActive = data.isActive;
    }
    if (data.bankAccountNo !== undefined) updates.bankAccountNo = data.bankAccountNo;
    if (data.bankId !== undefined) updates.bankId = data.bankId;
    if (data.businessType !== undefined) updates.businessType = data.businessType;
    if (data.permissions !== undefined) {
      if (requester.role === "superadmin" || (requester.role === "admin" && userToEdit.role === "user")) {
        updates.permissions = data.permissions;
      }
    }

    // Superadmin is allowed to change role, center & user limit
    if (requester.role === "superadmin") {
      if (data.role !== undefined) updates.role = data.role;
      if (data.centerId !== undefined) {
        updates.centerId = data.role === "admin" ? userId : data.centerId;
      }
      if (data.maxUsersLimit !== undefined) {
        updates.maxUsersLimit = data.maxUsersLimit;
      }
    }

    const updated = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true });
    if (!updated) throw new Error("Cập nhật thất bại.");
    return this.serializeUser(updated);
  }

  static async deleteManagedUser(
    requester: { uid: string; role: string; centerId: string },
    userId: string
  ) {
    if (requester.role === "user") {
      throw new Error("Bạn không có quyền xóa người dùng.");
    }

    const userToDelete = await User.findById(userId) as unknown as IUser | null;
    if (!userToDelete) {
      throw new Error("Người dùng không tồn tại.");
    }

    // Cannot delete oneself
    if (userId === requester.uid) {
      throw new Error("Bạn không thể tự xóa tài khoản của chính mình.");
    }

    // Role checks
    if (requester.role === "admin") {
      if (userToDelete.centerId !== requester.centerId) {
        throw new Error("Bạn không có quyền xóa người dùng ngoài trung tâm.");
      }
      if (userToDelete.role !== "user") {
        throw new Error("Bạn chỉ có quyền xóa nhân viên thuộc trung tâm của mình.");
      }
    }

    await User.findByIdAndDelete(userId);
    return { success: true };
  }


  static async getSmsSettings(uid: string) {
    return await SmsSettingsService.getByOwnerId(uid);
  }

  static async updateSmsSettings(uid: string, data: SmsSettingsPayload) {
    logger.info(`[Auth] Updating SMS settings for uid: ${uid}`);
    return await SmsSettingsService.upsertByOwnerId(uid, data);
  }

  static async seedAdmin() {
    // 1. Seed Superadmin
    const superadminEmail = process.env.SUPERADMIN_EMAIL || "superadmin@studentmanagement.com";
    const superadminPassword = process.env.SUPERADMIN_PASSWORD || "SuperAdminPass123";
    const superadminDisplayName = process.env.SUPERADMIN_DISPLAY_NAME || "Super Admin";

    try {
      const existingSuper = await User.findOne({ email: superadminEmail }) as unknown as IUser | null;
      if (!existingSuper) {
        const hashedPassword = await bcrypt.hash(superadminPassword, 10);
        const superUser = new User({
          email: superadminEmail,
          password: hashedPassword,
          displayName: superadminDisplayName,
          role: "superadmin",
          centerId: "superadmin",
          createdBy: "",
        });
        await superUser.save();
        logger.info(`>>> Seeded superadmin account successfully: ${superadminEmail}`);
      } else {
        if (existingSuper.role !== "superadmin" || existingSuper.centerId !== "superadmin") {
          existingSuper.role = "superadmin";
          existingSuper.centerId = "superadmin";
          await existingSuper.save();
        }
        logger.info(`>>> Superadmin account already exists: ${superadminEmail}`);
      }
    } catch (error) {
      logger.error(">>> Error seeding superadmin account:", error);
    }

    // 2. Seed Admin
    const adminEmail = process.env.ADMIN_EMAIL || "admin@studentmanagement.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "AdminPass123";
    const adminDisplayName = process.env.ADMIN_DISPLAY_NAME || "Admin Hệ Thống";

    try {
      const existingAdmin = await User.findOne({ email: adminEmail }) as unknown as IUser | null;
      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const adminUser = new User({
          email: adminEmail,
          password: hashedPassword,
          displayName: adminDisplayName,
          role: "admin",
          centerId: "system_admin",
          createdBy: "",
        });
        await adminUser.save();
        logger.info(`>>> Seeded admin account successfully: ${adminEmail}`);
      } else {
        if (!existingAdmin.centerId || existingAdmin.centerId === "undefined") {
          existingAdmin.centerId = "system_admin";
          await existingAdmin.save();
          logger.info(`>>> Updated existing admin account centerId to 'system_admin'`);
        } else {
          logger.info(`>>> Admin account already exists: ${adminEmail}`);
        }
      }
    } catch (error) {
      logger.error(">>> Error seeding admin account:", error);
    }

    // 3. Self-healing migration for missing or invalid centerId
    try {
      const adminsToFix = await User.find({
        $and: [
          {
            $or: [
              { role: "admin" },
              { role: { $exists: false } },
              { role: null },
            ]
          },
          {
            $or: [
              { centerId: { $exists: false } },
              { centerId: null },
              { centerId: "" },
              { centerId: "undefined" },
            ]
          }
        ]
      }) as unknown as IUser[];
      for (const admin of adminsToFix) {
        if (!admin.role) {
          admin.role = "admin";
        }
        admin.centerId = admin._id.toString();
        await admin.save();
        logger.info(`>>> Migrated admin user ${admin.email} centerId to ${admin.centerId}`);
      }

      const superadminsToFix = await User.find({
        role: "superadmin",
        $or: [
          { centerId: { $exists: false } },
          { centerId: null },
          { centerId: "" },
          { centerId: "undefined" },
          { centerId: { $ne: "superadmin" } },
        ],
      }) as unknown as IUser[];
      for (const sa of superadminsToFix) {
        sa.centerId = "superadmin";
        await sa.save();
        logger.info(`>>> Migrated superadmin user ${sa.email} centerId to superadmin`);
      }

      // Migrating staff users (role "user") with mismatched centerId
      const staffUsers = await User.find({ role: "user" }) as unknown as IUser[];
      for (const staff of staffUsers) {
        let targetCenterId = staff.centerId;
        
        // If created by an admin, align centerId with the admin's centerId
        if (staff.createdBy) {
          const creator = await User.findById(staff.createdBy) as unknown as IUser | null;
          if (creator && creator.role === "admin") {
            targetCenterId = creator.centerId;
          }
        }
        
        // If it's a known string code like "tuna" or "system_admin", map to the corresponding admin's centerId
        if (targetCenterId === "tuna") {
          const tunaAdmin = await User.findOne({ email: "tuna@gmail.com" }) as unknown as IUser | null;
          if (tunaAdmin) targetCenterId = tunaAdmin.centerId;
        } else if (targetCenterId === "system_admin") {
          const sysAdmin = await User.findOne({ email: "admin@studentmanagement.com" }) as unknown as IUser | null;
          if (sysAdmin) targetCenterId = sysAdmin.centerId;
        }
        
        if (staff.centerId !== targetCenterId) {
          logger.info(`>>> Migrated staff user ${staff.email} centerId from '${staff.centerId}' to '${targetCenterId}'`);
          staff.centerId = targetCenterId;
          await staff.save();
        }
      }
    } catch (error) {
      logger.error(">>> Error running centerId self-healing migration:", error);
    }
  }
}

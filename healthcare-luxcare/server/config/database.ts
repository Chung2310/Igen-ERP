import { logger } from "./logger";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { UserModel } from "../model/user.model";
import { CompanyModel } from "../model/company.model";
import { reconcilePermissions } from "./permission-reconciliation";
import { dropLegacyPayrollRunPeriodKeyUniqueIndex } from "../model/payroll-run-index-migration";
import {
  dropLegacyAttendancePeriodResultUniqueIndex,
  dropLegacyPayrollOperationJobIdempotencyIndex,
} from "../model/payroll-branch-index-migration";
import { backfillPaidHolidayAttendance } from "../service/paid-holiday-attendance.service";

async function reconcileCompanyModules() {
  try {
    const result = await CompanyModel.updateMany(
      { enabledModules: { $exists: true, $nin: ["supply"] }, modulePolicyManaged: { $ne: true } },
      { $addToSet: { enabledModules: "supply" } }
    );
    if (result.modifiedCount > 0) {
      logger.info(`[Backend Database] Đã tự động kích hoạt module 'supply' cho ${result.modifiedCount} doanh nghiệp.`);
    }
  } catch (error) {
    logger.error("[Backend Database] Lỗi khi đồng bộ module doanh nghiệp:", error);
  }
}


/**
 * Tự động tạo tài khoản Super Admin nếu chưa tồn tại
 */
async function seedSuperAdmin() {
  try {
    // Đọc SUPERADMIN_* (tên cũ VITE_SUPERADMIN_* vẫn được chấp nhận để tương thích,
    // nhưng không nên dùng: tiền tố VITE_ khiến biến có nguy cơ bị đưa vào bundle frontend).
    const saEmail = (process.env.SUPERADMIN_EMAIL || process.env.VITE_SUPERADMIN_EMAIL || "").toLowerCase().trim();
    const saPassword = process.env.SUPERADMIN_PASSWORD || process.env.VITE_SUPERADMIN_PASSWORD || "";
    const saName = process.env.SUPERADMIN_NAME || process.env.VITE_SUPERADMIN_NAME || "Super Admin";

    if (!saEmail || !saPassword) {
      logger.warn("[Backend Database] Bỏ qua seed Super Admin: chưa cấu hình SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD.");
      return;
    }

    // 1. Kiểm tra xem đã có bất kỳ tài khoản superadmin nào trong hệ thống chưa
    const existingSA = await UserModel.findOne({ role: "superadmin" });
    if (existingSA) {
      logger.info("[Backend Database] Super Admin đã tồn tại trong database.");
      return;
    }

    // 2. Nếu chưa có superadmin, kiểm tra xem có tài khoản trùng email cấu hình chưa
    const userWithEmail = await UserModel.findOne({ email: saEmail });
    if (userWithEmail) {
      logger.info(`[Backend Database] Tìm thấy tài khoản trùng email ${saEmail}. Nâng cấp lên Super Admin...`);
      userWithEmail.role = "superadmin";
      await userWithEmail.save();
      logger.info("[Backend Database] Nâng cấp tài khoản lên Super Admin thành công.");
      return;
    }

    // 3. Nếu chưa có cả hai, tiến hành tạo mới tài khoản superadmin
    const hashedPassword = await bcrypt.hash(saPassword, 10);
    const superAdmin = new UserModel({
      email: saEmail,
      password: hashedPassword,
      displayName: saName,
      role: "superadmin",
      createdAt: new Date(),
      status: "offline",
    });

    await superAdmin.save();
    logger.info(`[Backend Database] Khởi tạo tài khoản Super Admin thành công: ${saEmail}`);
  } catch (error) {
    logger.error("[Backend Database] Lỗi khi tự động khởi tạo Super Admin:", error);
  }
}

/**
 * Cho phép cấu hình nhiều tài khoản Super Admin (xóa index unique cũ nếu có)
 */
async function allowMultipleSuperAdmins() {
  try {
    await UserModel.collection.dropIndex("unique_superadmin_role");
    logger.info("[Backend Database] Đã gỡ giới hạn một tài khoản Super Admin.");
  } catch (error: any) {
    if (error?.codeName !== "IndexNotFound" && error?.code !== 27) throw error;
  }
}

/**
 * Khởi tạo kết nối cơ sở dữ liệu MongoDB
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://mongodb/lux-care";
  const user = process.env.MONGODB_USER;
  const pass = process.env.MONGODB_PASSWORD;
  const authSource = process.env.MONGODB_AUTH_SOURCE || "admin";

  let connectionUri = uri;
  if (user && pass) {
    const protocol = uri.startsWith("mongodb+srv://") ? "mongodb+srv://" : "mongodb://";
    const uriWithoutProtocol = uri.replace(protocol, "");

    if (!uriWithoutProtocol.includes("@")) {
      connectionUri = `${protocol}${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${uriWithoutProtocol}`;
    }

    if (authSource && !connectionUri.includes("authSource=")) {
      const separator = connectionUri.includes("?") ? "&" : "?";
      connectionUri = `${connectionUri}${separator}authSource=${authSource}`;
    }
  }

  // Log URI ẩn mật khẩu để dễ debug cấu hình trên VPS
  const redactedUri = connectionUri.replace(/:([^:@]+)@/, ":******@");
  logger.info(`[Backend Database] Đang kết nối tới MongoDB qua URI: ${redactedUri}`);

  try {
    mongoose.set("returnDocument", "after");
    await mongoose.connect(connectionUri);
    logger.info(
      `[Backend Database] Kết nối MongoDB thành công. db=${mongoose.connection.name || "unknown"} host=${mongoose.connection.host || "unknown"} instance=${process.env.INSTANCE_ID || process.env.HOSTNAME || "local"} pid=${process.pid}`,
    );
async function backfillSupplyInspectionDates() {
  try {
    const { SupplyModel } = await import("../model/supply.model");
    await SupplyModel.updateMany(
      { $or: [{ inspectionDate: { $exists: false } }, { inspectionDate: null }] },
      { $set: { inspectionDate: new Date() } }
    );
  } catch (error) {
    logger.error("[Backend Database] Lỗi khi backfill inspectionDate cho vật tư:", error);
  }
}

    // Chạy các seeder dữ liệu hệ thống
    await allowMultipleSuperAdmins();
    await dropLegacyPayrollRunPeriodKeyUniqueIndex();
    await dropLegacyPayrollOperationJobIdempotencyIndex();
    await dropLegacyAttendancePeriodResultUniqueIndex();
    await seedSuperAdmin();
    await reconcilePermissions();
    await reconcileCompanyModules();
    await backfillPaidHolidayAttendance();
    await backfillSupplyInspectionDates();
  } catch (error) {
    logger.error("[Backend Database] Lỗi kết nối MongoDB:", error);
    process.exit(1);
  }
}



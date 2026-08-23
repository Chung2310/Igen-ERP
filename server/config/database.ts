import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { UserModel } from "../model/user.model";
import { PermissionModel } from "../model/permission.model";
import { PERMISSION_CATALOG, PERMISSION_CODES } from "./permission-catalog";
import { dropLegacyPayrollRunPeriodKeyUniqueIndex } from "../model/payroll-run-index-migration";
import { migrateLegacyPayrollRunStatuses } from "../model/payroll-run-status-migration";
import {
  dropLegacyAttendancePeriodResultUniqueIndex,
  dropLegacyPayrollOperationJobIdempotencyIndex,
} from "../model/payroll-branch-index-migration";
import { dropLegacyStudentAttendanceUniqueIndex } from "../model/student-attendance-index-migration";
import { dropLegacyWorkerAttendanceLogIndexes } from "../model/worker-attendance-index-migration";
import { resetPermissionsForRegistryVersion } from "../model/permission-registry-reset";

/**
 * Tự động tạo tài khoản Super Admin nếu chưa tồn tại
 */
async function seedSuperAdmin() {
  try {
    // Đọc SUPERADMIN_* (tên cũ VITE_SUPERADMIN_* vẫn được chấp nhận để tương thích,
    // nhưng không nên dùng: tiền tố VITE_ khiến biến có nguy cơ bị đưa vào bundle frontend).
    const saEmail = (process.env.SUPERADMIN_EMAIL || process.env.VITE_SUPERADMIN_EMAIL || "")
      .toLowerCase()
      .trim();
    const saPassword = process.env.SUPERADMIN_PASSWORD || process.env.VITE_SUPERADMIN_PASSWORD || "";
    const saName = process.env.SUPERADMIN_NAME || process.env.VITE_SUPERADMIN_NAME || "Super Admin";

    if (!saEmail || !saPassword) {
      console.warn(
        "[Backend Database] Bỏ qua seed Super Admin: chưa cấu hình SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD."
      );
      return;
    }

    // 1. Kiểm tra xem đã có bất kỳ tài khoản superadmin nào trong hệ thống chưa
    const existingSA = await UserModel.findOne({ role: "superadmin" });
    if (existingSA) {
      console.log("[Backend Database] Super Admin đã tồn tại trong database.");
      return;
    }

    // 2. Nếu chưa có superadmin, kiểm tra xem có tài khoản trùng email cấu hình chưa
    const userWithEmail = await UserModel.findOne({ email: saEmail });
    if (userWithEmail) {
      console.log(`[Backend Database] Tìm thấy tài khoản trùng email ${saEmail}. Nâng cấp lên Super Admin...`);
      userWithEmail.role = "superadmin";
      await userWithEmail.save();
      console.log("[Backend Database] Nâng cấp tài khoản lên Super Admin thành công.");
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
    console.log(`[Backend Database] Khởi tạo tài khoản Super Admin thành công: ${saEmail}`);
  } catch (error) {
    console.error("[Backend Database] Lỗi khi tự động khởi tạo Super Admin:", error);
  }
}

/**
 * Tự động seed danh sách mã quyền hệ thống ban đầu
 */
async function allowMultipleSuperAdmins() {
  try {
    await UserModel.collection.dropIndex("unique_superadmin_role");
    console.log("[Backend Database] Đã gỡ giới hạn một tài khoản Super Admin.");
  } catch (error: any) {
    if (error?.codeName !== "IndexNotFound" && error?.code !== 27) throw error;
  }
}

async function seedPermissions() {
  try {
    const catalogPermissions = PERMISSION_CATALOG.map((entry) => ({
      code: entry.code,
      name: entry.label,
      module: entry.feature,
      group: entry.group,
      action: entry.action,
      description: entry.description,
    }));
    for (const perm of catalogPermissions) {
      const result = await PermissionModel.updateOne({ code: perm.code }, { $set: perm }, { upsert: true });
      if (result.upsertedCount) console.log(`[Backend Database] Khởi tạo mã quyền mặc định: ${perm.code}`);
    }

    await PermissionModel.deleteMany({ code: { $nin: PERMISSION_CODES } });
  } catch (error) {
    console.error("[Backend Database] Lỗi khi tự động khởi tạo mã quyền:", error);
  }
}

/**
 * Khởi tạo kết nối cơ sở dữ liệu MongoDB
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://mongodb/igen-erp";
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

  // Local MongoDB standalone deployments do not support retryable writes.
  // Always normalize the option, including when the supplied URI already
  // contains retryWrites=true.
  if (/[?&]retryWrites=[^&]*/i.test(connectionUri)) {
    connectionUri = connectionUri.replace(/([?&])retryWrites=[^&]*/i, "$1retryWrites=false");
  } else {
    connectionUri += (connectionUri.includes("?") ? "&" : "?") + "retryWrites=false";
  }

  // Log URI ẩn mật khẩu để dễ debug cấu hình trên VPS
  const redactedUri = connectionUri.replace(/:([^:@]+)@/, ":******@");
  console.log(`[Backend Database - v2] Đang kết nối tới MongoDB qua URI: ${redactedUri}`);

  try {
    await mongoose.connect(connectionUri, { retryWrites: false });
    console.log(`[Backend Database] Kết nối MongoDB thành công. db=${mongoose.connection.name || "unknown"} host=${mongoose.connection.host || "unknown"} instance=${process.env.INSTANCE_ID || process.env.HOSTNAME || "local"} pid=${process.pid}`);
    // Chạy các seeder dữ liệu hệ thống
    await allowMultipleSuperAdmins();
    await dropLegacyPayrollRunPeriodKeyUniqueIndex();
    const payrollStatusMigration = await migrateLegacyPayrollRunStatuses();
    if (payrollStatusMigration.overpaidAnomalies) {
      console.warn(`[Backend Database] Payroll status migration found ${payrollStatusMigration.overpaidAnomalies} overpaid run(s) requiring manual review.`);
    }
    await dropLegacyPayrollOperationJobIdempotencyIndex();
    await dropLegacyAttendancePeriodResultUniqueIndex();
    await dropLegacyStudentAttendanceUniqueIndex();
    await dropLegacyWorkerAttendanceLogIndexes();
    await seedSuperAdmin();
    await seedPermissions();
    const permissionReset = await resetPermissionsForRegistryVersion();
    if (permissionReset.applied) {
      console.warn(`[Backend Database] Permission registry clean-break reset applied: ${permissionReset.rolesReset} role(s), ${permissionReset.usersReset} user(s). Administrators must configure permissions again.`);
    }
  } catch (error) {
    console.error("[Backend Database] Lỗi kết nối MongoDB:", error);
    process.exit(1);
  }
}

/**
 * Helper để chạy logic trong Transaction nếu DB hỗ trợ (Replica Set),
 * ngược lại chạy bình thường (dành cho môi trường Local DB Standalone).
 */
export async function runInTransaction<T>(callback: (session?: mongoose.ClientSession) => Promise<T>): Promise<T> {
  const topologyInfo = await mongoose.connection.db?.admin().command({ hello: 1 });
  const isReplicaSet = Boolean(topologyInfo?.setName) || topologyInfo?.msg === "isdbgrid";
  
  if (!isReplicaSet) {
    // Standalone fallback: chạy không có transaction
    return callback(undefined);
  }

  const session = await mongoose.startSession();
  try {
    let result: T;
    await session.withTransaction(async (s) => {
      result = await callback(s);
    });
    return result!;
  } finally {
    await session.endSession();
  }
}

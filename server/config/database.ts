import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { UserModel } from "../model/user.model";
import { PermissionModel } from "../model/permission.model";
import { RolePermissionModel } from "../model/role-permission.model";
import { PERMISSION_CATALOG } from "./permission-catalog";
import { dropLegacyPayrollRunPeriodKeyUniqueIndex } from "../model/payroll-run-index-migration";

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
    const defaultPermissions = [
      { code: "user:read", name: "Xem thông tin nhân sự", module: "user", description: "Xem danh sách và sơ đồ nhân sự doanh nghiệp" },
      { code: "user:manage", name: "Quản trị nhân sự", module: "user", description: "Thêm, sửa, xóa tài khoản thành viên trong doanh nghiệp" },
      { code: "kanban:read", name: "Xem Kanban Task", module: "kanban", description: "Xem bảng công việc Kanban" },
      { code: "kanban:manage", name: "Quản trị Kanban Task", module: "kanban", description: "Tạo, cập nhật, phân công, kéo thả và xóa Kanban task" },
      { code: "project:read", name: "Xem Dự án", module: "project", description: "Xem danh sách dự án trong công ty" },
      { code: "project:manage", name: "Quản trị/Thiết lập Dự án", module: "project", description: "Tạo mới, chỉnh sửa thông tin dự án" },
      { code: "stock:read", name: "Xem Nhật ký Kho", module: "stock", description: "Xem lịch sử xuất nhập kho" },
      { code: "stock:manage", name: "Quản trị Kho", module: "stock", description: "Tạo phiếu nhập xuất kho hàng" },
      { code: "hr:read", name: "Xem trang tổng quan Nhân sự", module: "hr", description: "Xem thẻ và biểu đồ nhân sự trên trang Tổng quan" },
      { code: "timekeeping:read", name: "Xem chấm công (Tổng quan)", module: "hr", description: "Xem thẻ chấm công trên trang Tổng quan" },
      { code: "timekeeping:manage", name: "Quản lý & duyệt chấm công", module: "hr", description: "Duyệt đơn xin nghỉ, chỉnh sửa bản ghi chấm công và cấu hình vị trí/ca làm việc" },
      { code: "payroll:read", name: "Xem bảng lương", module: "hr", description: "Xem bảng lương sau khi đã được tính" },
      { code: "payroll:manage", name: "Quản lý & tính lương", module: "hr", description: "Đồng bộ công, khóa công, tính lương, duyệt và chốt kỳ lương" },
      { code: "company-email:manage", name: "Quản lý email chúc mừng", module: "hr", description: "Cấu hình mẫu và theo dõi email sinh nhật, lễ Tết của công ty" },
      { code: "recruitment:manage", name: "Quản lý tuyển dụng", module: "hr", description: "Quản lý tin tuyển dụng, ứng viên, quy trình và phỏng vấn theo chi nhánh" },
      { code: "student:read", name: "Xem học viên/khách hàng", module: "student", description: "Xem thẻ học viên/khách hàng và học phí trên trang Tổng quan" },
      { code: "student:manage", name: "Quản lý học viên/khách hàng", module: "student", description: "Thêm, sửa, xóa học viên, khóa học, lớp, đối tác..." },
      { code: "partner:read", name: "Xem đối tác & cộng tác viên", module: "partner", description: "Xem danh sách, chi tiết, số liệu giới thiệu và hoa hồng đối tác" },
      { code: "partner:manage", name: "Quản lý đối tác & hoa hồng", module: "partner", description: "Thêm, sửa, xóa, nhập Excel, cấu hình level và ghi nhận chi trả hoa hồng" },
      { code: "chat:read", name: "Xem trò chuyện (Tổng quan)", module: "chat", description: "Xem thẻ trò chuyện trên trang Tổng quan" },
      { code: "resource:read", name: "Xem tài nguyên (Tổng quan)", module: "resource", description: "Xem thẻ tài nguyên trên trang Tổng quan" },
      { code: "resource:manage", name: "Quản lý tài nguyên & kết nối Drive", module: "resource", description: "Kết nối/ngắt kết nối Google Drive doanh nghiệp và quản lý thư viện tài nguyên" }
    ];

    // Xóa các quyền cũ không còn sử dụng trong dự án
    await PermissionModel.deleteMany({
      code: { $in: ["crm:read", "crm:manage", "marketing:post"] }
    });

    const catalogPermissions = PERMISSION_CATALOG.map((entry) => ({
      code: entry.code,
      name: entry.label,
      module: entry.code.split(":")[0],
      description: entry.description,
    }));
    const permissionsByCode = new Map([...defaultPermissions, ...catalogPermissions].map((permission) => [permission.code, permission]));

    for (const perm of permissionsByCode.values()) {
      const result = await PermissionModel.updateOne({ code: perm.code }, { $setOnInsert: perm }, { upsert: true });
      if (result.upsertedCount) console.log(`[Backend Database] Khởi tạo mã quyền mặc định: ${perm.code}`);
    }

    await RolePermissionModel.updateMany(
      { role: "admin" },
      { $addToSet: { permissions: { $each: ["custom-field:manage", "student-settings:manage", "company-smtp:manage"] } } },
    );
    await RolePermissionModel.updateMany(
      { role: "manager" },
      { $addToSet: { permissions: "custom-field:manage" } },
    );
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

  // Log URI ẩn mật khẩu để dễ debug cấu hình trên VPS
  const redactedUri = connectionUri.replace(/:([^:@]+)@/, ":******@");
  console.log(`[Backend Database] Đang kết nối tới MongoDB qua URI: ${redactedUri}`);

  try {
    await mongoose.connect(connectionUri);
    console.log(`[Backend Database] Kết nối MongoDB thành công. db=${mongoose.connection.name || "unknown"} host=${mongoose.connection.host || "unknown"} instance=${process.env.INSTANCE_ID || process.env.HOSTNAME || "local"} pid=${process.pid}`);
    // Chạy các seeder dữ liệu hệ thống
    await allowMultipleSuperAdmins();
    await dropLegacyPayrollRunPeriodKeyUniqueIndex();
    await seedSuperAdmin();
    await seedPermissions();
  } catch (error) {
    console.error("[Backend Database] Lỗi kết nối MongoDB:", error);
    process.exit(1);
  }
}

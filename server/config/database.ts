import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { UserModel } from "../model/user.model";
import { PermissionModel } from "../model/permission.model";

/**
 * Tự động tạo tài khoản Super Admin nếu chưa tồn tại
 */
async function seedSuperAdmin() {
  try {
    const saEmail = (process.env.VITE_SUPERADMIN_EMAIL || "superadmin@igen.com").toLowerCase().trim();
    const saPassword = process.env.VITE_SUPERADMIN_PASSWORD || "superadmin123";
    const saName = process.env.VITE_SUPERADMIN_NAME || "Super Admin";

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
async function seedPermissions() {
  try {
    const defaultPermissions = [
      { code: "user:read", name: "Xem thông tin nhân sự", module: "user", description: "Xem danh sách và sơ đồ nhân sự doanh nghiệp" },
      { code: "user:manage", name: "Quản trị nhân sự", module: "user", description: "Thêm, sửa, xóa tài khoản thành viên trong doanh nghiệp" },
      { code: "crm:read", name: "Xem CRM Ticket", module: "crm", description: "Xem danh sách và chi tiết các cơ hội bán hàng CRM" },
      { code: "crm:manage", name: "Quản trị CRM Ticket", module: "crm", description: "Thêm, sửa, cập nhật trạng thái, xóa cơ hội bán hàng CRM" },
      { code: "kanban:read", name: "Xem Kanban Task", module: "kanban", description: "Xem bảng công việc Kanban" },
      { code: "kanban:manage", name: "Quản trị Kanban Task", module: "kanban", description: "Tạo, cập nhật, phân công, kéo thả và xóa Kanban task" },
      { code: "project:read", name: "Xem Dự án", module: "project", description: "Xem danh sách dự án trong công ty" },
      { code: "project:manage", name: "Quản trị/Thiết lập Dự án", module: "project", description: "Tạo mới, chỉnh sửa thông tin dự án" },
      { code: "stock:read", name: "Xem Nhật ký Kho", module: "stock", description: "Xem lịch sử xuất nhập kho" },
      { code: "stock:manage", name: "Quản trị Kho", module: "stock", description: "Tạo phiếu nhập xuất kho hàng" },
      { code: "marketing:post", name: "Đăng bài và liên kết MXH", module: "marketing", description: "Đăng bài Facebook/TikTok, liên kết tài khoản MXH" }
    ];

    for (const perm of defaultPermissions) {
      const existing = await PermissionModel.findOne({ code: perm.code });
      if (!existing) {
        await new PermissionModel(perm).save();
        console.log(`[Backend Database] Khởi tạo mã quyền mặc định: ${perm.code}`);
      }
    }
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
    await seedSuperAdmin();
    await seedPermissions();
  } catch (error) {
    console.error("[Backend Database] Lỗi kết nối MongoDB:", error);
    process.exit(1);
  }
}

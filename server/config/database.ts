import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { UserModel } from "../model/user.model";

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
 * Khởi tạo kết nối cơ sở dữ liệu MongoDB
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://mongodb/igen-erp";
  const user = process.env.MONGODB_USER;
  const pass = process.env.MONGODB_PASSWORD;
  const authSource = process.env.MONGODB_AUTH_SOURCE || "admin";

  const options: mongoose.ConnectOptions = {};

  if (user && pass) {
    options.user = user;
    options.pass = pass;
    options.authSource = authSource;
  }

  // Log URI ẩn mật khẩu để dễ debug cấu hình trên VPS
  const redactedUri = uri.replace(/:([^:@]+)@/, ":******@");
  console.log(`[Backend Database] Đang kết nối tới MongoDB qua URI: ${redactedUri}`);

  try {
    await mongoose.connect(uri, options);
    console.log("[Backend Database] Kết nối MongoDB thành công.");
    // Chạy seeder Super Admin
    await seedSuperAdmin();
  } catch (error) {
    console.error("[Backend Database] Lỗi kết nối MongoDB:", error);
    process.exit(1);
  }
}

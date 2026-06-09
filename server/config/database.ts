import mongoose from "mongoose";

/**
 * Khởi tạo kết nối cơ sở dữ liệu MongoDB
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/igen-erp";
  const user = process.env.MONGODB_USER;
  const pass = process.env.MONGODB_PASSWORD;
  const authSource = process.env.MONGODB_AUTH_SOURCE || "admin";

  const options: mongoose.ConnectOptions = {};

  if (user && pass) {
    options.user = user;
    options.pass = pass;
    options.authSource = authSource;
  }

  try {
    await mongoose.connect(uri, options);
    console.log("[Backend Database] Kết nối MongoDB thành công.");
  } catch (error) {
    console.error("[Backend Database] Lỗi kết nối MongoDB:", error);
    process.exit(1);
  }
}

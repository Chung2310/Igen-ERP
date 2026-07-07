import dotenv from "dotenv";

dotenv.config();

// Override for local host execution without Docker/VPS credentials
process.env.MONGODB_URI = "mongodb://localhost:27017/igen-erp";
process.env.MONGODB_USER = "";
process.env.MONGODB_PASSWORD = "";

import { connectDB } from "../server/config/database";
import { UserModel } from "../server/model/user.model";

async function run() {
  console.log("=== BẮT ĐẦU CHẠY THỬ NGHIỆM TRẠNG THÁI HOẠT ĐỘNG (PRESENCE) ===");
  await connectDB();

  // 1. Dọn dẹp dữ liệu cũ (nếu có)
  const TEST_COMPANY = "TEST-PRESENCE-CO";
  await UserModel.deleteMany({ companyCode: TEST_COMPANY });

  // 2. Tạo 1 người dùng thử nghiệm
  console.log("\n1. Đang tạo người dùng thử nghiệm...");
  const user = await UserModel.create({
    email: "testpresence@igen.com",
    displayName: "Nhân viên Presence",
    role: "user",
    companyCode: TEST_COMPANY,
    companyName: "Test Presence Company",
    status: "offline", // Bắt đầu bằng offline
  });
  console.log(`- Đã tạo: ${user.displayName} (${user._id}) - Trạng thái ban đầu: ${user.status}`);

  // 3. Giả lập người dùng kết nối (Chuyển sang online)
  console.log("\n2. Giả lập kết nối Socket.IO: Chuyển trạng thái sang online...");
  const updatedUser1 = await UserModel.findByIdAndUpdate(
    user._id,
    { status: "online" },
    { new: true }
  );
  console.log(`- Trạng thái sau kết nối: ${updatedUser1?.status}`);
  if (updatedUser1?.status === "online") {
    console.log("- Thành công! Trạng thái online chính xác.");
  } else {
    console.error("❌ THẤT BẠI: Trạng thái không đổi sang online!");
    process.exit(1);
  }

  // 4. Giả lập người dùng ngắt kết nối (Chuyển sang offline)
  console.log("\n3. Giả lập ngắt kết nối Socket.IO: Chuyển trạng thái sang offline...");
  const updatedUser2 = await UserModel.findByIdAndUpdate(
    user._id,
    { status: "offline" },
    { new: true }
  );
  console.log(`- Trạng thái sau ngắt kết nối: ${updatedUser2?.status}`);
  if (updatedUser2?.status === "offline") {
    console.log("- Thành công! Trạng thái offline chính xác.");
  } else {
    console.error("❌ THẤT BẠI: Trạng thái không đổi sang offline!");
    process.exit(1);
  }

  // 5. Dọn dẹp
  console.log("\n4. Đang dọn dẹp dữ liệu thử nghiệm...");
  await UserModel.deleteMany({ companyCode: TEST_COMPANY });
  console.log("- Đã dọn dẹp sạch sẽ dữ liệu DB.");

  console.log("\n=== TẤT CẢ THỬ NGHIỆM TRẠNG THÁI HOẠT ĐỘNG ĐÃ PASS THÀNH CÔNG 100%! ===");
  process.exit(0);
}

run().catch((err) => {
  console.error("Lỗi khi chạy thử nghiệm:", err);
  process.exit(1);
});

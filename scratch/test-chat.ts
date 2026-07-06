import dotenv from "dotenv";

dotenv.config();

// Override for local host execution without Docker/VPS credentials
process.env.MONGODB_URI = "mongodb://localhost:27017/igen-erp";
process.env.MONGODB_USER = "";
process.env.MONGODB_PASSWORD = "";

import { connectDB } from "../server/config/database";
import { UserModel } from "../server/model/user.model";
import { ChatRoomModel } from "../server/model/chat-room.model";
import { ChatMessageModel } from "../server/model/chat-message.model";
import { chatService } from "../server/service/chat.service";

async function run() {
  console.log("=== BẮT ĐẦU CHẠY THỬ NGHIỆM CHAT SERVICE ===");
  await connectDB();

  // 1. Dọn dẹp dữ liệu cũ (nếu có)
  const TEST_COMPANY_1 = "TEST-CO-1";
  const TEST_COMPANY_2 = "TEST-CO-2";
  await UserModel.deleteMany({ companyCode: { $in: [TEST_COMPANY_1, TEST_COMPANY_2] } });

  // 2. Tạo 3 người dùng thử nghiệm
  console.log("\n1. Đang tạo người dùng thử nghiệm...");
  const user1 = await UserModel.create({
    email: "user1@testco1.com",
    displayName: "Nhân viên 1 Co1",
    role: "user",
    companyCode: TEST_COMPANY_1,
    companyName: "Test Company 1",
  });

  const user2 = await UserModel.create({
    email: "user2@testco1.com",
    displayName: "Nhân viên 2 Co1",
    role: "manager",
    companyCode: TEST_COMPANY_1,
    companyName: "Test Company 1",
  });

  const user3 = await UserModel.create({
    email: "user3@testco2.com",
    displayName: "Nhân viên 3 Co2",
    role: "user",
    companyCode: TEST_COMPANY_2,
    companyName: "Test Company 2",
  });

  console.log(`- Đã tạo: ${user1.displayName} (${user1._id}) - Company: ${user1.companyCode}`);
  console.log(`- Đã tạo: ${user2.displayName} (${user2._id}) - Company: ${user2.companyCode}`);
  console.log(`- Đã tạo: ${user3.displayName} (${user3._id}) - Company: ${user3.companyCode}`);

  // 3. Test chat 1-1 giữa 2 người cùng công ty
  console.log("\n2. Thử nghiệm lấy hoặc tạo phòng chat 1-1 cùng công ty...");
  const room1 = await chatService.getOrCreatePrivateRoom(
    user1._id.toString(),
    user2._id.toString(),
    TEST_COMPANY_1
  );
  console.log(`- Thành công! Đã tạo phòng chat 1-1 ID: ${room1._id}`);
  console.log(`- Số lượng thành viên: ${room1.members.length}`);

  // 4. Test cách ly: Thử chat 1-1 với người khác công ty (Phải lỗi)
  console.log("\n3. Thử nghiệm cách ly: Chat với người khác công ty (Kỳ vọng ném lỗi)...");
  try {
    await chatService.getOrCreatePrivateRoom(
      user1._id.toString(),
      user3._id.toString(),
      TEST_COMPANY_1
    );
    console.error("❌ THẤT BẠI: Lẽ ra phải báo lỗi vì khác công ty!");
    process.exit(1);
  } catch (error: any) {
    console.log(`- Thành công! Hệ thống đã ném lỗi như kỳ vọng: "${error.message}"`);
  }

  // 5. Thử nghiệm gửi tin nhắn
  console.log("\n4. Thử nghiệm gửi tin nhắn 1-1...");
  const msg1 = await chatService.sendMessage(
    room1._id.toString(),
    user1._id.toString(),
    "Chào bạn! Đây là tin nhắn thử nghiệm đầu tiên.",
    [],
    TEST_COMPANY_1
  );
  console.log(`- Đã gửi tin nhắn: "${msg1.content}" từ ${msg1.senderName}`);

  // Kiểm tra lastMessage của phòng chat được cập nhật
  const updatedRoom1 = await ChatRoomModel.findById(room1._id);
  if (updatedRoom1?.lastMessage?.toString() === msg1._id.toString()) {
    console.log("- Thành công! lastMessage của phòng chat đã tự động cập nhật khớp với tin nhắn vừa gửi.");
  } else {
    console.error("❌ THẤT BẠI: lastMessage không khớp!");
    process.exit(1);
  }

  // 6. Thử nghiệm tạo Group Chat
  console.log("\n5. Thử nghiệm tạo nhóm chat mới...");
  const groupRoom = await chatService.createGroupRoom(
    user1._id.toString(),
    "Nhóm Nghiên cứu AI",
    [user2._id.toString()],
    TEST_COMPANY_1
  );
  console.log(`- Thành công! Đã tạo phòng chat nhóm ID: ${groupRoom._id}, Tên: "${groupRoom.name}"`);
  console.log(`- Admin của nhóm là: ${groupRoom.creatorId.toString()}`);

  // 7. Thử nghiệm lấy lịch sử tin nhắn
  console.log("\n6. Thử nghiệm lấy lịch sử tin nhắn...");
  const history = await chatService.getMessages(
    room1._id.toString(),
    user2._id.toString(),
    TEST_COMPANY_1
  );
  console.log(`- Đã lấy được ${history.length} tin nhắn lịch sử.`);
  if (history[0].content === "Chào bạn! Đây là tin nhắn thử nghiệm đầu tiên.") {
    console.log("- Thành công! Nội dung tin nhắn lịch sử chính xác.");
  } else {
    console.error("❌ THẤT BẠI: Tin nhắn lịch sử sai lệch!");
    process.exit(1);
  }

  // 8. Đánh dấu đã đọc
  console.log("\n7. Thử nghiệm đánh dấu đã đọc...");
  await chatService.markAsRead(room1._id.toString(), user2._id.toString(), TEST_COMPANY_1);
  const readMsg = await ChatMessageModel.findById(msg1._id);
  if (readMsg?.readBy.map(id => id.toString()).includes(user2._id.toString())) {
    console.log("- Thành công! Tin nhắn đã được đánh dấu là đọc bởi user2.");
  } else {
    console.error("❌ THẤT BẠI: Chưa cập nhật danh sách readBy!");
    process.exit(1);
  }

  // 9. Dọn dẹp dữ liệu thử nghiệm
  console.log("\n8. Đang dọn dẹp dữ liệu thử nghiệm...");
  await ChatMessageModel.deleteMany({ roomId: { $in: [room1._id, groupRoom._id] } });
  await ChatRoomModel.deleteMany({ _id: { $in: [room1._id, groupRoom._id] } });
  await UserModel.deleteMany({ companyCode: { $in: [TEST_COMPANY_1, TEST_COMPANY_2] } });
  console.log("- Đã dọn dẹp sạch sẽ dữ liệu DB.");

  console.log("\n=== TẤT CẢ THỬ NGHIỆM CHAT SERVICE ĐÃ PASS THÀNH CÔNG 100%! ===");
  process.exit(0);
}

run().catch((err) => {
  console.error("Lỗi khi chạy thử nghiệm:", err);
  process.exit(1);
});

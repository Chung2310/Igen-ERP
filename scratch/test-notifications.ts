import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { notificationService } from "../server/service/notification.service";
import { NotificationModel } from "../server/model/notification.model";
import { UserModel } from "../server/model/user.model";

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/igen-erp";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // 1. Lấy một user bất kỳ trong DB để làm người nhận test
    const testUser = await UserModel.findOne().lean();
    if (!testUser) {
      console.log("Không tìm thấy user nào trong DB để test. Vui lòng tạo user trước.");
      return;
    }

    const recipientUid = testUser._id.toString();
    const companyCode = testUser.companyCode || "TEST_COMPANY";

    console.log(`Bắt đầu chạy test cho user ${testUser.email} (ID: ${recipientUid}, Company: ${companyCode})`);

    // Dọn dẹp các thông báo test cũ nếu có
    await NotificationModel.deleteMany({ recipientUid });

    // 2. Test tạo thông báo thủ công
    console.log("\n--- Test 1: Tạo thông báo thủ công ---");
    const manualNotif = await notificationService.createNotification({
      title: "Test thông báo thủ công",
      body: "Đây là nội dung thông báo test được tạo thủ công.",
      type: "he-thong",
      companyCode,
      recipientUid,
      read: false,
    });
    console.log("Đã tạo thành công thông báo thủ công. ID:", manualNotif._id);

    // 3. Test Cảnh báo Tồn kho (Low Stock Trigger)
    console.log("\n--- Test 2: Trigger cảnh báo tồn kho ---");
    // Giả lập sản phẩm hết hàng
    const product = {
      companyCode,
      name: "Gạch xây dựng Tuynel",
      stock: 5,
      sku: "G-TYNEL-01",
    };
    // Sẽ tạo thông báo cho tất cả admin & manager cùng công ty
    await notificationService.notifyLowStock(product);
    console.log("Đã kích hoạt notifyLowStock.");

    // 4. Test Giao việc mới (Task Assigned Trigger)
    console.log("\n--- Test 3: Trigger giao việc mới ---");
    const task = {
      companyCode,
      title: "Thiết kế layout Dashboard Admin",
      assigneeUid: recipientUid,
      assignee: testUser.displayName,
      creatorUid: "642b1234567890abcdef1234", // Khác assigneeUid để không bị chặn gửi cho chính mình
    };
    await notificationService.notifyTaskAssigned(task);
    console.log("Đã kích hoạt notifyTaskAssigned.");

    // 5. Test lấy danh sách thông báo
    console.log("\n--- Test 4: Lấy danh sách thông báo ---");
    const notifList = await notificationService.getNotifications(recipientUid, companyCode, {
      page: 1,
      limit: 10,
    });
    console.log(`Tổng số thông báo: ${notifList.total}`);
    console.log(`Số lượng thông báo chưa đọc: ${notifList.unreadCount}`);
    console.log("Danh sách thông báo chi tiết:");
    notifList.items.forEach((item) => {
      console.log(`- [${item.type}] [Đã đọc: ${item.read}] ${item.title}: ${item.body}`);
    });

    // Xác nhận có ít nhất 1 thông báo
    if (notifList.total < 1) {
      throw new Error("Lỗi: Không tìm thấy thông báo nào trong DB.");
    }

    // 6. Test Đánh dấu đã đọc một thông báo
    console.log("\n--- Test 5: Đánh dấu đã đọc một thông báo ---");
    const firstNotif = notifList.items[0];
    const updatedNotif = await notificationService.markAsRead(firstNotif._id.toString(), recipientUid);
    console.log(`Thông báo "${updatedNotif.title}" đã được đánh dấu là đọc: ${updatedNotif.read}`);
    if (!updatedNotif.read) {
      throw new Error("Lỗi: Đánh dấu đã đọc không thành công.");
    }

    // 7. Test Đánh dấu đọc tất cả
    console.log("\n--- Test 6: Đánh dấu đọc tất cả ---");
    await notificationService.markAllAsRead(recipientUid, companyCode);
    const afterMarkAll = await notificationService.getNotifications(recipientUid, companyCode, {
      read: false,
    });
    console.log(`Số thông báo chưa đọc sau khi markAllAsRead: ${afterMarkAll.unreadCount}`);
    if (afterMarkAll.unreadCount !== 0) {
      throw new Error("Lỗi: markAllAsRead không đánh dấu hết là đã đọc.");
    }

    // Dọn dẹp dữ liệu test
    await NotificationModel.deleteMany({ recipientUid });
    console.log("\n--- Test hoàn thành thành công 100% và đã dọn dẹp dữ liệu test ---");

  } catch (error) {
    console.error("Test thất bại với lỗi:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

run();

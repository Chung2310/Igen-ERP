import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { chatService } from "../server/service/chat.service";
import { ChatRoomModel } from "../server/model/chat-room.model";
import { ChatMessageModel } from "../server/model/chat-message.model";

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/igen-erp";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // Lấy một phòng chat thực tế trong DB
    const room = await ChatRoomModel.findOne().populate("members.userId").exec();
    if (!room) {
      console.log("No rooms found in DB. Test aborted.");
      return;
    }

    const roomId = room._id.toString();
    const companyCode = room.companyCode;
    const member = room.members[0];
    if (!member) {
      console.log("No members in room. Test aborted.");
      return;
    }
    const userId = (member.userId as any)._id ? (member.userId as any)._id.toString() : member.userId.toString();

    console.log(`Testing search in room: ${roomId}, user: ${userId}, company: ${companyCode}`);

    // Gửi một tin nhắn mẫu để tìm kiếm
    const testMsgContent = "Xin chào, đây là tin nhắn test tìm kiếm link https://google.com và file bao-cao.pdf";
    
    const testMsg = await chatService.sendMessage(
      roomId,
      userId,
      testMsgContent,
      [
        { url: "https://cloudinary.com/pdf.pdf", name: "bao-cao.pdf", type: "application/pdf", size: 10240 }
      ],
      companyCode
    );
    console.log("Saved test message ID:", testMsg._id);

    // 1. Tìm kiếm type text
    const textResults = await chatService.searchMessages(roomId, userId, companyCode, "test tìm kiếm", "text");
    console.log("Text search results count:", textResults.length);
    if (textResults.length > 0) {
      console.log("Text match content:", textResults[0].content);
    }

    // 2. Tìm kiếm type link
    const linkResults = await chatService.searchMessages(roomId, userId, companyCode, "google", "link");
    console.log("Link search results count:", linkResults.length);
    if (linkResults.length > 0) {
      console.log("Link match content:", linkResults[0].content);
    }

    // 3. Tìm kiếm type file
    const fileResults = await chatService.searchMessages(roomId, userId, companyCode, "bao-cao", "file");
    console.log("File search results count:", fileResults.length);
    if (fileResults.length > 0) {
      console.log("File match name:", fileResults[0].attachments?.[0]?.name);
    }

    // Dọn dẹp tin nhắn test
    await ChatMessageModel.findByIdAndDelete(testMsg._id);
    console.log("Cleaned up test message successfully");

  } catch (error) {
    console.error("Test failed with error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

run();

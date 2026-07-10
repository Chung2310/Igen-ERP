import dotenv from "dotenv";
import { connectDB } from "../server/config/database";
import { UserModel } from "../server/model/user.model";
import { ChatRoomModel } from "../server/model/chat-room.model";
import { ChatMessageModel } from "../server/model/chat-message.model";
import { chatService } from "../server/service/chat.service";

dotenv.config();

process.env.MONGODB_URI = "mongodb://localhost:27017/igen-erp";
process.env.MONGODB_USER = "";
process.env.MONGODB_PASSWORD = "";

async function run() {
  await connectDB();
  console.log("Connected to MongoDB for Admin & Message Actions verification.");

  // Get or Create test users
  let admin = await UserModel.findOne({ email: "admin-act-test@igen.com" });
  if (!admin) {
    admin = await UserModel.create({
      email: "admin-act-test@igen.com",
      displayName: "Admin Act Test",
      role: "admin",
      companyCode: "TESTCOM2",
      status: "online",
    });
  }

  let member = await UserModel.findOne({ email: "member-act-test@igen.com" });
  if (!member) {
    member = await UserModel.create({
      email: "member-act-test@igen.com",
      displayName: "Member Act Test",
      role: "user",
      companyCode: "TESTCOM2",
      status: "online",
    });
  }

  // Create room
  const room = await ChatRoomModel.create({
    name: "Group Actions Verification",
    isGroup: true,
    companyCode: "TESTCOM2",
    creatorId: admin._id.toString(),
    members: [
      { userId: admin._id, role: "admin", joinedAt: new Date() },
      { userId: member._id, role: "member", joinedAt: new Date() },
    ],
  });

  console.log("Room configured:", room._id);

  // Test 1: Save reply message
  console.log("TEST 1: Creating a message and replying to it...");
  const msg1 = await ChatMessageModel.create({
    roomId: room._id,
    senderId: admin._id,
    senderName: admin.displayName,
    content: "Original Message",
    readBy: [admin._id.toString()],
  });

  const replyMsg = await chatService.sendMessage(
    room._id.toString(),
    member._id.toString(),
    "This is a reply message",
    [],
    "TESTCOM2",
    msg1._id.toString()
  );

  console.log("Reply message replyTo populated:", replyMsg.replyTo);
  if (!replyMsg.replyTo || replyMsg.replyTo.content !== "Original Message") {
    console.error("TEST 1 FAILED!");
    process.exit(1);
  }
  console.log("TEST 1 PASSED!");

  // Test 2: Soft delete message
  console.log("TEST 2: Deleting (recalling) the reply message...");
  const deletedMsg = await chatService.deleteMessage(
    room._id.toString(),
    replyMsg._id.toString(),
    member._id.toString(),
    "TESTCOM2"
  );
  console.log("Deleted message content in DB:", deletedMsg.content, "isDeleted:", deletedMsg.isDeleted);
  if (!deletedMsg.isDeleted || deletedMsg.content !== "Tin nhắn đã bị thu hồi") {
    console.error("TEST 2 FAILED!");
    process.exit(1);
  }
  console.log("TEST 2 PASSED!");

  // Test 3: Pin Multiple Messages (Max 3)
  console.log("TEST 3: Pinning 3 messages...");
  const p1 = await ChatMessageModel.create({ roomId: room._id, senderId: admin._id, senderName: admin.displayName, content: "Pin 1" });
  const p2 = await ChatMessageModel.create({ roomId: room._id, senderId: admin._id, senderName: admin.displayName, content: "Pin 2" });
  const p3 = await ChatMessageModel.create({ roomId: room._id, senderId: admin._id, senderName: admin.displayName, content: "Pin 3" });
  const p4 = await ChatMessageModel.create({ roomId: room._id, senderId: admin._id, senderName: admin.displayName, content: "Pin 4" });

  await chatService.pinMessage(room._id.toString(), admin._id.toString(), p1._id.toString(), "TESTCOM2");
  await chatService.pinMessage(room._id.toString(), admin._id.toString(), p2._id.toString(), "TESTCOM2");
  const pinned3 = await chatService.pinMessage(room._id.toString(), admin._id.toString(), p3._id.toString(), "TESTCOM2");

  console.log("Pinned messages count (should be 3):", pinned3.pinnedMessageIds?.length);
  if (pinned3.pinnedMessageIds?.length !== 3) {
    console.error("TEST 3 FAILED: Count is not 3.");
    process.exit(1);
  }

  // Expect error when pinning 4th message
  console.log("TEST 3.1: Verifying max limit (should error when pinning 4th message)...");
  try {
    await chatService.pinMessage(room._id.toString(), admin._id.toString(), p4._id.toString(), "TESTCOM2");
    console.error("TEST 3.1 FAILED: Expected pin limit error but succeeded.");
    process.exit(1);
  } catch (err: any) {
    console.log("Expected pin limit error thrown:", err.message);
  }
  console.log("TEST 3 PASSED!");

  // Test 4: Unpin specific message
  console.log("TEST 4: Unpinning Pin 2...");
  const unpinnedRoom = await chatService.unpinMessage(
    room._id.toString(),
    admin._id.toString(),
    p2._id.toString(),
    "TESTCOM2"
  );
  console.log("Pinned messages count after unpin p2:", unpinnedRoom.pinnedMessageIds?.length);
  const hasP2 = unpinnedRoom.pinnedMessageIds?.some((p: any) => p._id.toString() === p2._id.toString());
  if (hasP2 || unpinnedRoom.pinnedMessageIds?.length !== 2) {
    console.error("TEST 4 FAILED!");
    process.exit(1);
  }
  console.log("TEST 4 PASSED!");

  // Clean up
  await ChatRoomModel.findByIdAndDelete(room._id);
  await ChatMessageModel.deleteMany({ roomId: room._id });
  console.log("Cleaned up database.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Error running test:", err);
  process.exit(1);
});

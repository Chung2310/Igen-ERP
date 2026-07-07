import dotenv from "dotenv";
import { connectDB } from "../server/config/database";
import { UserModel } from "../server/model/user.model";
import { ChatRoomModel } from "../server/model/chat-room.model";
import { chatService } from "../server/service/chat.service";

dotenv.config();

process.env.MONGODB_URI = "mongodb://localhost:27017/igen-erp";
process.env.MONGODB_USER = "";
process.env.MONGODB_PASSWORD = "";

async function run() {
  await connectDB();
  console.log("Connected to MongoDB");

  // Get or Create test users
  let admin = await UserModel.findOne({ email: "admin-test@igen.com" });
  if (!admin) {
    admin = await UserModel.create({
      email: "admin-test@igen.com",
      displayName: "Test Admin",
      role: "admin",
      companyCode: "TESTCOM",
      status: "online",
    });
  }

  let member = await UserModel.findOne({ email: "member-test@igen.com" });
  if (!member) {
    member = await UserModel.create({
      email: "member-test@igen.com",
      displayName: "Test Member",
      role: "user",
      companyCode: "TESTCOM",
      status: "online",
    });
  }

  console.log("Users configured:", { admin: admin._id, member: member._id });

  // Create a test group chat
  const room = await ChatRoomModel.create({
    name: "Group Test Settings",
    isGroup: true,
    companyCode: "TESTCOM",
    creatorId: admin._id.toString(),
    members: [
      { userId: admin._id, role: "admin", joinedAt: new Date() },
      { userId: member._id, role: "member", joinedAt: new Date() },
    ],
  });

  console.log("Test room created:", room._id);

  // Transfer admin to member
  console.log("Transferring admin from admin-test to member-test...");
  const updatedRoom = await chatService.transferAdmin(
    room._id.toString(),
    admin._id.toString(),
    member._id.toString(),
    "TESTCOM"
  );

  const updatedAdminMember = updatedRoom.members.find(
    (m: any) => m.userId._id.toString() === admin!._id.toString()
  );
  const updatedNewAdminMember = updatedRoom.members.find(
    (m: any) => m.userId._id.toString() === member!._id.toString()
  );

  console.log("Old Admin status:", updatedAdminMember?.role); // Expected: "member"
  console.log("New Admin status:", updatedNewAdminMember?.role); // Expected: "admin"

  if (updatedAdminMember?.role === "member" && updatedNewAdminMember?.role === "admin") {
    console.log("SUCCESS: Transfer admin works perfectly!");
  } else {
    console.error("FAIL: Transfer admin did not swap roles correctly!");
    process.exit(1);
  }

  // Cleanup
  await ChatRoomModel.findByIdAndDelete(room._id);
  console.log("Cleaned up room.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Error during test execution:", err);
  process.exit(1);
});

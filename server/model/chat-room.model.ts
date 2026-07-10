import { Schema, model } from "mongoose";
import { IChatRoom } from "../interface/chat-room.interface";

const ChatRoomMemberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ["admin", "deputy", "member"], default: "member" },
    joinedAt: { type: Date, default: Date.now },
    canUploadDrive: { type: Boolean, default: true },
    isPinned: { type: Boolean, default: false },
  },
  { _id: false }
);

const ChatRoomSchema = new Schema<IChatRoom>(
  {
    name: { type: String, default: "" },
    isGroup: { type: Boolean, default: false, index: true },
    companyCode: { type: String, required: true, index: true },
    creatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: { type: [ChatRoomMemberSchema], default: [] },
    lastMessage: { type: Schema.Types.ObjectId, ref: "ChatMessage" },
    avatarURL: { type: String, default: "" },
    pinnedMessageIds: [{ type: Schema.Types.ObjectId, ref: "ChatMessage" }],
    onlyAdminsCanMessage: { type: Boolean, default: false },
    driveFolderId: { type: String, default: "" },
    driveGeneralAccess: { type: String, enum: ["restricted", "company"], default: "restricted" },
  },
  {
    timestamps: true,
  }
);

// Index on updatedAt to query latest conversations quickly
ChatRoomSchema.index({ companyCode: 1, updatedAt: -1 });

export const ChatRoomModel = model<IChatRoom>("ChatRoom", ChatRoomSchema);

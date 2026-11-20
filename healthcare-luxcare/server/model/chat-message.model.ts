import { Schema, model } from "mongoose";
import { IChatMessage } from "../interface/chat-message.interface";

const ChatAttachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    size: { type: Number },
    uploadToken: { type: String },
  },
  { _id: false },
);

const ChatMessageSchema = new Schema<IChatMessage>({
  roomId: { type: Schema.Types.ObjectId, ref: "ChatRoom", required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  senderName: { type: String, required: true },
  senderPhoto: { type: String, default: "" },
  content: { type: String, default: "" },
  citations: {
    type: [
      new Schema(
        {
          id: { type: String, required: true },
          sourceType: { type: String, enum: ["knowledge", "database"], required: true },
          title: { type: String, required: true },
          scope: String,
          updatedAt: String,
          queriedAt: String,
          documentId: String,
          chunkIndex: Number,
          revision: String,
          url: String,
        },
        { _id: false },
      ),
    ],
    default: [],
  },
  attachments: { type: [ChatAttachmentSchema], default: [] },
  readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  reactions: {
    type: [
      new Schema(
        {
          emoji: { type: String, required: true },
          userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        },
        { _id: false },
      ),
    ],
    default: [],
  },
  replyTo: { type: Schema.Types.ObjectId, ref: "ChatMessage" },
  isDeleted: { type: Boolean, default: false },
  mobilePushQueued: { type: Boolean, default: false },
  editedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now, index: true },
});

// Compound index for fast message loading sorted by date in a room
ChatMessageSchema.index({ roomId: 1, createdAt: -1 });
ChatMessageSchema.index({ mobilePushQueued: 1, createdAt: 1 });

export const ChatMessageModel = model<IChatMessage>("ChatMessage", ChatMessageSchema);

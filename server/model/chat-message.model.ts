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
  { _id: false }
);

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "ChatRoom", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    senderName: { type: String, required: true },
    senderPhoto: { type: String, default: "" },
    content: { type: String, default: "" },
    attachments: { type: [ChatAttachmentSchema], default: [] },
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    reactions: {
      type: [
        new Schema(
          {
            emoji: { type: String, required: true },
            userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    replyTo: { type: Schema.Types.ObjectId, ref: "ChatMessage" },
    isDeleted: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
  }
);

// Compound index for fast message loading sorted by date in a room
ChatMessageSchema.index({ roomId: 1, createdAt: -1 });

export const ChatMessageModel = model<IChatMessage>("ChatMessage", ChatMessageSchema);

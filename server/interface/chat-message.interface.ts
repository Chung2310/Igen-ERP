import { Document, Types } from "mongoose";

export interface IChatAttachment {
  url: string;
  name: string;
  type: string;
  size?: number;
}

export interface IChatReaction {
  emoji: string;
  userId: Types.ObjectId | string;
}

export interface IChatMessage extends Document {
  roomId: Types.ObjectId | string;
  senderId: Types.ObjectId | string;
  senderName: string;
  senderPhoto?: string;
  content: string;
  attachments?: IChatAttachment[];
  readBy: (Types.ObjectId | string)[];
  reactions?: IChatReaction[];
  replyTo?: Types.ObjectId | string | any;
  isDeleted?: boolean;
  editedAt?: Date | null;
  createdAt: Date;
}

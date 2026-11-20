import { Document, Types } from "mongoose";
import type { AssistantCitation } from "../assistant/assistant.types";

export interface IChatAttachment {
  url: string;
  name: string;
  type: string;
  size?: number;
  uploadToken?: string;
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
  citations?: AssistantCitation[];
  attachments?: IChatAttachment[];
  readBy: (Types.ObjectId | string)[];
  reactions?: IChatReaction[];
  replyTo?: Types.ObjectId | string | any;
  isDeleted?: boolean;
  mobilePushQueued?: boolean;
  editedAt?: Date | null;
  createdAt: Date;
}

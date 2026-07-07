import { Document, Types } from "mongoose";

export interface IChatRoomMember {
  userId: Types.ObjectId | string;
  role: "admin" | "deputy" | "member";
  joinedAt: Date;
}

export interface IChatRoom extends Document {
  name?: string;
  isGroup: boolean;
  companyCode: string;
  creatorId: Types.ObjectId | string;
  members: IChatRoomMember[];
  lastMessage?: Types.ObjectId | string;
  avatarURL?: string;
  pinnedMessageIds?: (Types.ObjectId | string | any)[];
  onlyAdminsCanMessage?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

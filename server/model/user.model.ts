import { Schema, model } from "mongoose";
import { IUser } from "../interface/user.interface";

const FacebookIntegrationSchema = new Schema(
  {
    isConnected: { type: Boolean, default: false },
    pageId: { type: String, default: "" },
    pageName: { type: String, default: "" },
    pageAccessToken: { type: String, default: "" },
    connectedAt: { type: Date },
    isMock: { type: Boolean, default: false },
  },
  { _id: false }
);

const TikTokIntegrationSchema = new Schema(
  {
    isConnected: { type: Boolean, default: false },
    username: { type: String, default: "" },
    displayName: { type: String, default: "" },
    avatarUrl: { type: String },
    accessToken: { type: String },
    connectedAt: { type: Date },
    privacyLevel: { type: String, default: "SELF_ONLY" },
    isMock: { type: Boolean, default: false },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, index: true, lowercase: true },
  password: { type: String },
  displayName: { type: String, required: true },
  photoURL: { type: String },
  role: { type: String, enum: ["user", "manager", "admin", "superadmin"], default: "user" },
  createdAt: { type: Date, default: Date.now },
  facebookIntegration: { type: FacebookIntegrationSchema, default: null },
  tiktokIntegration: { type: TikTokIntegrationSchema, default: null },
  jobTitle: { type: String },
  department: { type: String },
  phone: { type: String },
  level: { type: Number },
  parentId: { type: String },
  status: { type: String, enum: ["online", "offline"], default: "offline" },
  division: { type: String },
  companyCode: { type: String, index: true },
  companyName: { type: String },
});

export const UserModel = model<IUser>("User", UserSchema);

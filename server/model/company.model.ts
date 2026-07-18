import { Schema, model } from "mongoose";
import { ICompany } from "../interface/company.interface";
import { MODULE_KEYS } from "../config/module-keys";

const CompanyHeyGenConfigSchema = new Schema(
  {
    apiKey: { type: String, default: "" },
    defaultAvatarId: { type: String, default: "" },
    defaultVoiceId: { type: String, default: "" },
    isConnected: { type: Boolean, default: false },
    connectedAt: { type: Date, default: null },
    lastSyncAt: { type: Date, default: null },
  },
  { _id: false }
);

const CompanyElevenLabsConfigSchema = new Schema(
  {
    apiKey: { type: String, default: "" },
  },
  { _id: false }
);

const CompanyDriveOAuthSchema = new Schema(
  {
    refreshToken: { type: String, default: "" },
    connectedEmail: { type: String, default: "" },
    connectedAt: { type: Date, default: null },
  },
  { _id: false }
);

const CompanyLocationConfigSchema = new Schema(
  {
    latitude: { type: Number, default: 10.7769 }, // default Bitexco coordinates
    longitude: { type: Number, default: 106.7009 },
    allowedRadius: { type: Number, default: 1000 }, // default 1000m
    addressName: { type: String, default: "TÃ²a nhÃ  Bitexco" },
    checkInLimit: { type: String, default: "08:30" },
    checkOutLimit: { type: String, default: "17:30" },
    lunchBreakStart: { type: String, default: "12:00" },
    lunchBreakEnd: { type: String, default: "13:00" },
    workingDays: { type: [Number], default: () => [1, 2, 3, 4, 5] },
  },
  { _id: false }
);

const CompanySchema = new Schema<ICompany>({
  code: { type: String, required: true, unique: true, index: true, uppercase: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  ownerEmail: { type: String, required: true },
  enabledModules: { type: [String], enum: MODULE_KEYS, default: () => [...MODULE_KEYS] },
  heygenConfig: { type: CompanyHeyGenConfigSchema, default: () => ({}) },
  elevenlabsConfig: { type: CompanyElevenLabsConfigSchema, default: () => ({}) },
  driveFolderLink: { type: String, default: "" },
  driveOAuth: { type: CompanyDriveOAuthSchema, default: () => ({}) },
  driveFolderId: { type: String, default: "" },
  locationConfig: { type: CompanyLocationConfigSchema, default: () => ({}) },
  lifecycleStatus: { type: String, enum: ["active", "suspended", "archived", "scheduled-deletion"], default: "active", index: true },
  lifecycleChangedAt: { type: Date, default: Date.now },
  deletionScheduledAt: { type: Date, default: null },
  retentionEndsAt: { type: Date, default: null },
  deletionReason: { type: String, default: "" },
});

export const CompanyModel = model<ICompany>("Company", CompanySchema);

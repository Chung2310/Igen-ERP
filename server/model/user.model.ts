import { Schema, model } from "mongoose";
import { IUser } from "../interface/user.interface";

const FacebookIntegrationSchema = new Schema(
  {
    isConnected: { type: Boolean, default: false },
    pageId: { type: String, default: "" },
    pageName: { type: String, default: "" },
    pageAccessToken: { type: String, default: "" },
    appSecret: { type: String, default: "" },
    verifyToken: { type: String, default: "" },
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
    refreshToken: { type: String },
    tokenExpiredAt: { type: Date },
    clientKey: { type: String },
    clientSecret: { type: String },
    scopes: { type: [String], default: [] },
    connectedAt: { type: Date },
    privacyLevel: { type: String, default: "SELF_ONLY" },
    isMock: { type: Boolean, default: false },
  },
  { _id: false }
);

const ZaloIntegrationSchema = new Schema(
  {
    isConnected: { type: Boolean, default: false },
    oaId: { type: String, default: "" },
    oaName: { type: String, default: "" },
    accessToken: { type: String, default: "" },
    refreshToken: { type: String, default: "" },
    tokenExpiredAt: { type: Date },
    connectedAt: { type: Date },
    isMock: { type: Boolean, default: false },
  },
  { _id: false }
);

const GoogleDriveIntegrationSchema = new Schema(
  {
    isConnected: { type: Boolean, default: false },
    driveEmail: { type: String, default: "" },
    accessToken: { type: String, default: "" },
    refreshToken: { type: String, default: "" },
    tokenExpiredAt: { type: Date },
    rootFolderId: { type: String, default: "" },
    connectedAt: { type: Date },
  },
  { _id: false }
);


export const AiAutoReplyConfigSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    commentReplyEnabled: { type: Boolean, default: false },
    autoClassify: { type: Boolean, default: true },
    autoCloseDeal: { type: Boolean, default: false },
    autoFeedback: { type: Boolean, default: false },
    replyDelay: { type: Number, default: 15 },
    advancedInstructions: { type: String, default: "" },
    trainingKnowledge: { type: String, default: "" },
    model: { type: String, default: "gemini-3.5-flash" },
    disabledAt: { type: Date, default: null },
  },
  { _id: false }
);

const HeyGenAccessSchema = new Schema(
  {
    avatarIds: { type: [String], default: [] },
    avatarId: { type: String, default: "" },
    voiceId: { type: String, default: "" },
    apiKey: { type: String, default: "" },
  },
  { _id: false }
);

const ElevenLabsAccessSchema = new Schema(
  {
    apiKey: { type: String, default: "" },
  },
  { _id: false }
);

const WorkHoursConfigSchema = new Schema(
  {
    useCustom: { type: Boolean, default: false },
    checkInLimit: { type: String, default: "08:30" },
    checkOutLimit: { type: String, default: "17:30" },
    lunchBreakStart: { type: String, default: "12:00" },
    lunchBreakEnd: { type: String, default: "13:00" },
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
  },
  { _id: false }
);

const SuperAdminSecuritySchema = new Schema({
  totpEnabled: { type: Boolean, default: false },
  totpSecretEncrypted: { type: String, select: false },
  recoveryCodeHashes: { type: [String], default: [], select: false },
  enrolledAt: { type: Date }, failedTotpAttempts: { type: Number, default: 0 }, lockedUntil: { type: Date },
}, { _id: false });

function removeSuperAdminSecrets(_doc: unknown, ret: Record<string, any>) {
  if (ret.superAdminSecurity) { delete ret.superAdminSecurity.totpSecretEncrypted; delete ret.superAdminSecurity.recoveryCodeHashes; }
  return ret;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, index: true, lowercase: true },
  password: { type: String },
  displayName: { type: String, required: true },
  photoURL: { type: String },
  role: { type: String, default: "user" },
  createdAt: { type: Date, default: Date.now },
  facebookIntegration: { type: FacebookIntegrationSchema, default: null },
  tiktokIntegration: { type: TikTokIntegrationSchema, default: null },
  zaloIntegration: { type: ZaloIntegrationSchema, default: null },
  googleDriveIntegration: { type: GoogleDriveIntegrationSchema, default: null },
  aiAutoReplyConfig: { type: AiAutoReplyConfigSchema, default: () => ({}) },
  heygenAccess: { type: HeyGenAccessSchema, default: () => ({}) },
  elevenlabsAccess: { type: ElevenLabsAccessSchema, default: () => ({}) },
  jobTitle: { type: String },
  department: { type: String },
  jobDescriptionLink: { type: String },
  phone: { type: String },
  level: { type: Number },
  parentId: { type: String },
  status: { type: String, enum: ["online", "offline"], default: "offline" },
  division: { type: String },
  companyCode: { type: String, index: true },
  companyName: { type: String },
  permissions: { type: [String], default: [] },
  superAdminSecurity: { type: SuperAdminSecuritySchema },
  workHoursConfig: { type: WorkHoursConfigSchema, default: undefined },
  
  // SMTP Configuration
  smtpHost: { type: String },
  smtpPort: { type: Number },
  smtpSecure: { type: Boolean },
  smtpUser: { type: String },
  smtpPass: { type: String },
  smtpFrom: { type: String },
  smtpSandboxEmail: { type: String },

  // SaaS / Business limits
  businessType: { type: String, enum: ["driving", "language", "general"], default: "general" },
  isActive: { type: Boolean, default: true },
  maxUsersLimit: { type: Number },
}, { toJSON: { transform: removeSuperAdminSecrets }, toObject: { transform: removeSuperAdminSecrets } });

UserSchema.index(
  { role: 1 },
  {
    unique: true,
    partialFilterExpression: { role: "superadmin" },
    name: "unique_superadmin_role",
  },
);

export const UserModel = model<IUser>("User", UserSchema);

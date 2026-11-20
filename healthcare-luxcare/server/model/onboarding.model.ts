import { Schema, model, type Document } from "mongoose";
interface HistoryEntry {
  status: string;
  actorId: string;
  note?: string;
  at: Date;
}
export interface ApplicationDocument extends Document {
  userId: string;
  applicantEmail: string;
  companyName: string;
  taxCode?: string;
  address: string;
  phone: string;
  businessType: "general" | "service" | "recruitment";
  purpose: string;
  status: string;
  active: boolean;
  revision: number;
  reviewerNote?: string;
  companyCode?: string;
  reviewedBy?: string;
  history: HistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}
export interface InvitationDocument extends Document {
  companyCode: string;
  companyName: string;
  branchId: string;
  inviterId: string;
  email: string;
  status: string;
  active: boolean;
  expiresAt: Date;
  acceptedBy?: string;
  acceptedAt?: Date;
  history: HistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
  lastSentAt?: Date;
  mailVersion: number;
}
export interface VerificationDocument extends Document {
  userId: string;
  email: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  lastSentAt: Date;
  version: string;
}
export interface PendingRegistrationDocument extends Document {
  invitationId?: string;
  email: string;
  displayName: string;
  passwordHash: string;
  phone?: string;
  termsAcceptedAt: Date;
  personalAiConsentAt?: Date;
  personalAiDisclosureFingerprint?: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  lastSentAt: Date;
  version: string;
}
export interface MailDocument extends Document {
  eventKey: string;
  userId?: string;
  encryptedMessage: string;
  status: string;
  attempts: number;
  nextAttemptAt: Date;
  leaseUntil?: Date;
  leaseOwner?: string;
  expiresAt?: Date;
  sentAt?: Date;
}
export interface DeletionDocument extends Document {
  userId: string;
  email?: string;
  companyCode: string;
  status: string;
  active: boolean;
  dueAt: Date;
  completedAt?: Date;
  completedBy?: string;
}
const history = { status: String, actorId: String, note: String, at: { type: Date, default: Date.now } };
const application = new Schema<ApplicationDocument>(
  {
    userId: { type: String, required: true },
    applicantEmail: { type: String, required: true },
    companyName: { type: String, required: true },
    taxCode: String,
    address: String,
    phone: String,
    businessType: { type: String, enum: ["service", "recruitment", "general"], required: true },
    purpose: String,
    status: {
      type: String,
      enum: ["pending", "needs_information", "approved", "rejected", "cancelled"],
      default: "pending",
    },
    active: { type: Boolean, default: true },
    revision: { type: Number, default: 1 },
    reviewerNote: String,
    companyCode: String,
    reviewedBy: String,
    history: [history],
  },
  { timestamps: true },
);
// Use distinct keys and names so legacy userId_1 indexes can remain in place.
application.index({ userId: 1, createdAt: -1 }, { name: "company_application_user_history" });
// Every indexed row has active=true, enforcing at most one active application per user.
application.index(
  { userId: 1, active: 1 },
  { name: "company_application_one_active_per_user", unique: true, partialFilterExpression: { active: true } },
);
application.index({ status: 1, createdAt: -1 });
export const CompanyApplicationModel = model<ApplicationDocument>("CompanyApplication", application);
const invitation = new Schema<InvitationDocument>(
  {
    companyCode: { type: String, required: true },
    companyName: String,
    branchId: { type: String, required: true },
    lastSentAt: Date,
    mailVersion: { type: Number, default: 1 },
    inviterId: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    status: { type: String, enum: ["pending", "accepted", "declined", "revoked", "expired"], default: "pending" },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date, required: true },
    acceptedBy: String,
    acceptedAt: Date,
    history: [history],
  },
  { timestamps: true },
);
invitation.index({ companyCode: 1, email: 1 }, { unique: true, partialFilterExpression: { active: true } });
invitation.index({ email: 1, status: 1, expiresAt: 1 });
export const CompanyInvitationModel = model<InvitationDocument>("CompanyInvitation", invitation);
const verification = new Schema<VerificationDocument>(
  {
    userId: { type: String, required: true, unique: true },
    email: String,
    codeHash: String,
    attempts: { type: Number, default: 0 },
    expiresAt: Date,
    lastSentAt: Date,
    version: String,
  },
  { timestamps: true },
);
verification.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });
export const EmailVerificationModel = model<VerificationDocument>("EmailVerification", verification);
const pendingRegistration = new Schema<PendingRegistrationDocument>(
  {
    invitationId: String,
    email: { type: String, required: true, lowercase: true, unique: true },
    displayName: { type: String, required: true },
    passwordHash: { type: String, required: true, select: false },
    phone: String,
    termsAcceptedAt: { type: Date, required: true },
    personalAiConsentAt: Date,
    personalAiDisclosureFingerprint: String,
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    lastSentAt: { type: Date, required: true },
    version: { type: String, required: true },
  },
  { timestamps: true },
);
pendingRegistration.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const PendingRegistrationModel = model<PendingRegistrationDocument>("PendingRegistration", pendingRegistration);
const mail = new Schema<MailDocument>(
  {
    eventKey: { type: String, required: true, unique: true },
    userId: String,
    encryptedMessage: { type: String, required: true, select: false },
    status: { type: String, enum: ["pending", "processing", "sent", "failed", "superseded"], default: "pending" },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    leaseUntil: Date,
    leaseOwner: String,
    expiresAt: Date,
    sentAt: Date,
  },
  { timestamps: true },
);
mail.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });
mail.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 86400 });
export const PlatformMailOutboxModel = model<MailDocument>("PlatformMailOutbox", mail);
const deletion = new Schema<DeletionDocument>(
  {
    userId: { type: String, required: true },
    email: String,
    companyCode: String,
    status: { type: String, enum: ["requested", "completed", "cancelled"], default: "requested" },
    active: { type: Boolean, default: true },
    dueAt: { type: Date, required: true },
    completedAt: Date,
    completedBy: String,
  },
  { timestamps: true },
);
deletion.index({ userId: 1 }, { unique: true, partialFilterExpression: { active: true } });
export const AccountDeletionRequestModel = model<DeletionDocument>("AccountDeletionRequest", deletion);
export const onboardingModels = [
  CompanyApplicationModel,
  CompanyInvitationModel,
  EmailVerificationModel,
  PendingRegistrationModel,
  PlatformMailOutboxModel,
  AccountDeletionRequestModel,
];

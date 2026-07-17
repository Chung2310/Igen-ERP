import { Schema, Types, model } from "mongoose";

export interface ISuperAdminChallenge {
  challengeId: string;
  userId: Types.ObjectId;
  purpose: string;
  passwordVerifiedAt: Date;
  expiresAt: Date;
  consumedAt?: Date;
  attempts: number;
  enrollmentSecretEncrypted?: string;
  deviceId: string;
  sourceIp?: string;
  userAgent?: string;
}

const SuperAdminChallengeSchema = new Schema<ISuperAdminChallenge>({
  challengeId: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  purpose: { type: String, required: true },
  passwordVerifiedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date },
  attempts: { type: Number, default: 0 },
  enrollmentSecretEncrypted: { type: String, select: false },
  deviceId: { type: String, required: true },
  sourceIp: { type: String },
  userAgent: { type: String },
});

SuperAdminChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SuperAdminChallengeModel = model<ISuperAdminChallenge>("SuperAdminChallenge", SuperAdminChallengeSchema);

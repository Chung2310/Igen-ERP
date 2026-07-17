import { Schema, Types, model } from "mongoose";

export interface ISuperAdminSession {
  sessionId: string;
  userId: Types.ObjectId;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  revokeReason?: string;
  lastAcceptedTotpStep?: number;
}

const SuperAdminSessionSchema = new Schema<ISuperAdminSession>({
  sessionId: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date },
  revokeReason: { type: String },
  lastAcceptedTotpStep: { type: Number },
});

SuperAdminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SuperAdminSessionModel = model<ISuperAdminSession>("SuperAdminSession", SuperAdminSessionSchema);

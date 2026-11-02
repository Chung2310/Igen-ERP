import { Schema, Types, model } from "mongoose";

export interface IAdminAction {
  actionId: string;
  actorId: Types.ObjectId;
  idempotencyKey: string;
  actionType: string;
  requestHash: string;
  status: "reserved" | "running" | "succeeded" | "partial" | "failed";
  result?: unknown;
  error?: { code?: string; message: string };
  auditEvent?: Record<string, unknown>;
  auditPending?: boolean;
  auditAttempts?: number;
  auditNextAttemptAt?: Date;
  auditLastError?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

const AdminActionSchema = new Schema<IAdminAction>({
  actionId: { type: String, required: true, unique: true },
  actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  idempotencyKey: { type: String, required: true },
  actionType: { type: String, required: true },
  requestHash: { type: String, required: true },
  status: { type: String, enum: ["reserved", "running", "succeeded", "partial", "failed"], required: true },
  result: { type: Schema.Types.Mixed },
  error: { code: { type: String }, message: { type: String } },
  auditEvent: { type: Schema.Types.Mixed },
  auditPending: { type: Boolean, default: false },
  auditAttempts: { type: Number, default: 0 },
  auditNextAttemptAt: { type: Date },
  auditLastError: { type: String },
  completedAt: { type: Date },
}, { timestamps: true });

AdminActionSchema.index({ actorId: 1, idempotencyKey: 1 }, { unique: true });
AdminActionSchema.index({ status: 1, createdAt: 1 });
AdminActionSchema.index({ auditPending: 1, auditNextAttemptAt: 1 });

export const AdminActionModel = model<IAdminAction>("AdminAction", AdminActionSchema);

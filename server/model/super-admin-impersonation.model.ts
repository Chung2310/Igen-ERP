import { Schema, model } from "mongoose";

const schema = new Schema({ actionId: { type: String, required: true, unique: true }, actorId: { type: Schema.Types.ObjectId, ref: "User", required: true }, targetUserId: { type: Schema.Types.ObjectId, ref: "User", required: true }, companyCode: { type: String, required: true }, reason: { type: String, required: true }, expiresAt: { type: Date, required: true }, stoppedAt: Date }, { timestamps: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const SuperAdminImpersonationModel = model("SuperAdminImpersonation", schema);

import { randomUUID } from "node:crypto";
import { Schema, Types, model } from "mongoose";

export const USER_ACTIVITY_RETENTION_DAYS = 90;
export const USER_ACTIVITY_CATEGORIES = ["authentication", "data", "communication", "configuration", "security", "business"] as const;
export type UserActivityCategory = (typeof USER_ACTIVITY_CATEGORIES)[number];

export interface IUserActivityEvent {
  eventId: string;
  userId: Types.ObjectId;
  companyCode: string;
  actionType: string;
  category: UserActivityCategory;
  result: "success" | "failure";
  method?: string;
  route?: string;
  description: string;
  sourceIp?: string;
  userAgent?: string;
  occurredAt: Date;
  expiresAt: Date;
}

const immutable = true;
const schema = new Schema<IUserActivityEvent>({
  eventId: { type: String, required: true, unique: true, immutable },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true, immutable },
  companyCode: { type: String, required: true, index: true, immutable },
  actionType: { type: String, required: true, index: true, immutable },
  category: { type: String, enum: USER_ACTIVITY_CATEGORIES, required: true, index: true, immutable },
  result: { type: String, enum: ["success", "failure"], required: true, immutable },
  method: { type: String, immutable }, route: { type: String, immutable },
  description: { type: String, required: true, immutable },
  sourceIp: { type: String, immutable }, userAgent: { type: String, immutable },
  occurredAt: { type: Date, required: true, default: Date.now, immutable },
  expiresAt: { type: Date, required: true, immutable },
}, { collection: "user_activity_events", timestamps: false, strict: true });

schema.index({ userId: 1, occurredAt: -1 });
schema.index({ companyCode: 1, userId: 1, occurredAt: -1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RawUserActivityEventModel = model<IUserActivityEvent>("UserActivityEvent", schema);

export function activityExpiresAt(occurredAt: Date) {
  return new Date(occurredAt.getTime() + USER_ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export const UserActivityEventModel = Object.freeze({
  create: (event: Omit<IUserActivityEvent, "eventId" | "expiresAt"> & { eventId?: string; expiresAt?: Date }) => {
    const occurredAt = event.occurredAt || new Date();
    return RawUserActivityEventModel.create({ ...event, eventId: event.eventId || randomUUID(), occurredAt, expiresAt: event.expiresAt || activityExpiresAt(occurredAt) });
  },
  find: (filter: Record<string, unknown>, options: { skip: number; limit: number }) => RawUserActivityEventModel.find(filter).sort({ occurredAt: -1 }).skip(options.skip).limit(options.limit).lean().exec(),
  countDocuments: (filter: Record<string, unknown>) => RawUserActivityEventModel.countDocuments(filter).exec(),
});

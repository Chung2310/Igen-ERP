import { Schema, Types, model } from "mongoose";
import { redactSensitive } from "../security/redaction";

export interface IAuditEvent {
  eventId: string; actionId?: string; actionType: string;
  riskClass: "read_only" | "standard" | "sensitive" | "dangerous";
  result: "success" | "partial" | "failure"; actorSuperAdminId: Types.ObjectId;
  effectiveUserId?: Types.ObjectId; impersonationSessionId?: string; companyCode?: string;
  environment: "staging" | "production"; reason?: string; sourceIp?: string; userAgent?: string;
  entityType?: string; entityId?: string; projectId?: string; taskId?: string; workflowId?: string; tenantId?: string;
  correlationId: string; before?: unknown; after?: unknown; backgroundJobId?: string;
  itemSummary?: { total: number; succeeded: number; failed: number }; metadata?: unknown; occurredAt: Date;
}
export type AuditEventInsert = Omit<IAuditEvent, "occurredAt"> & { occurredAt?: Date };

const immutable = true;
const schema = new Schema<IAuditEvent>({
  eventId: { type: String, required: true, unique: true, immutable }, actionId: { type: String, index: true, immutable }, actionType: { type: String, required: true, index: true, immutable },
  riskClass: { type: String, enum: ["read_only", "standard", "sensitive", "dangerous"], required: true, immutable }, result: { type: String, enum: ["success", "partial", "failure"], required: true, immutable },
  actorSuperAdminId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true, immutable }, effectiveUserId: { type: Schema.Types.ObjectId, ref: "User", index: true, immutable },
  impersonationSessionId: { type: String, immutable }, companyCode: { type: String, index: true, immutable }, environment: { type: String, enum: ["staging", "production"], required: true, index: true, immutable },
  entityType: { type: String, index: true, immutable }, entityId: { type: String, index: true, immutable }, projectId: { type: String, index: true, immutable }, taskId: { type: String, index: true, immutable }, workflowId: { type: String, index: true, immutable }, tenantId: { type: String, index: true, immutable },
  reason: { type: String, immutable }, sourceIp: { type: String, immutable }, userAgent: { type: String, immutable }, correlationId: { type: String, required: true, index: true, immutable },
  before: { type: Schema.Types.Mixed, immutable }, after: { type: Schema.Types.Mixed, immutable }, backgroundJobId: { type: String, immutable },
  itemSummary: { type: { total: { type: Number, immutable }, succeeded: { type: Number, immutable }, failed: { type: Number, immutable } }, immutable },
  metadata: { type: Schema.Types.Mixed, immutable }, occurredAt: { type: Date, required: true, default: Date.now, index: true, immutable },
}, { strict: true, timestamps: false, collection: "audit_events" });

schema.index({ companyCode: 1, occurredAt: -1 });

const RawAuditEventModel = model<IAuditEvent>("AuditEvent", schema);

export function buildAuditEventForInsert(event: AuditEventInsert): AuditEventInsert {
  return { ...event, before: redactSensitive(event.before), after: redactSensitive(event.after), metadata: redactSensitive(event.metadata) };
}

export const AuditEventModel = Object.freeze({
  create: async (event: AuditEventInsert, options?: any) => options
    ? (await RawAuditEventModel.create([buildAuditEventForInsert(event)], options))[0]
    : RawAuditEventModel.create(buildAuditEventForInsert(event)),
  insertMany: (events: AuditEventInsert[]) => RawAuditEventModel.insertMany(events.map(buildAuditEventForInsert)),
  find: (filter: Record<string, unknown> = {}, projection?: any, options?: any) => RawAuditEventModel.find(filter, projection, options).lean().exec(),
  findOne: (filter: Record<string, unknown> = {}, projection?: any, options?: any) => RawAuditEventModel.findOne(filter, projection, options).lean().exec(),
  findById: (id: unknown, projection?: any, options?: any) => RawAuditEventModel.findById(id, projection, options).lean().exec(),
  countDocuments: (filter: Record<string, unknown> = {}) => RawAuditEventModel.countDocuments(filter).exec(),
});

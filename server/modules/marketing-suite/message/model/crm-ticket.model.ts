import { Schema, model } from "mongoose";
import { ICRMTicket } from "../interface/crm-ticket.interface.ts";

const LeadIntakeFieldSnapshotSchema = new Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  question: { type: String, required: true },
  type: { type: String, default: "text" },
  required: { type: Boolean, default: true },
  options: { type: [String], default: [] },
}, { _id: false });

const CRMTicketSchema = new Schema<ICRMTicket>({
  customerName: { type: String, required: true, index: true },
  company: { type: String, default: "" },
  value: { type: Number, default: 0 },
  phone: { type: String, default: "" },
  avatar: { type: String, default: "" },
  email: { type: String, default: "", index: true },
  productOfChoice: { type: String, default: "" },
  status: { type: String, enum: ["cold", "warm", "hot", "won", "upsell"], default: "cold", index: true },
  lastInteraction: { type: String },
  companyCode: { type: String, required: true, index: true },
  selectedProducts: {
    type: [{
      productId: { type: String },
      name: { type: String },
      price: { type: Number },
      quantity: { type: Number },
    }],
    default: [],
  },
  answers: { type: Schema.Types.Mixed, default: {} },
  intakeSearchText: { type: String, default: "", maxlength: 100000 },
  intakeFields: { type: [LeadIntakeFieldSnapshotSchema], default: [] },
  sourcePlatform: { type: String, enum: ["facebook", "zalo", "tiktok"], index: true },
  sourceAccountId: { type: String, default: "", index: true },
  sourceConversationId: { type: String, default: "", index: true },
  intakeProfileId: { type: String, default: "" },
  intakeProfileVersion: { type: Number },
  intakeRevision: { type: Number },
  intakeStaffFields: { type: [String], default: undefined },
  lastIntakeMessageId: { type: String },
  lastIntakeMessageAt: { type: Date },
  collectionStatus: { type: String, enum: ["collecting", "complete", "needs_human"], index: true },
  lastInteractionAt: { type: Date, index: true },
  customerId: { type: String },
  needs: { type: [{ _id: false, id: String, groupKey: String, groupLabel: String, title: String, answers: Schema.Types.Mixed }], default: undefined },
  moduleSync: {
    targetModule: { type: String, enum: ["students", "healthcare", "workers"] },
    targetRecordId: { type: String, maxlength: 100 },
    syncedAt: { type: Date },
    syncedBy: { type: String },
  },
});

CRMTicketSchema.index({ companyCode: 1, sourcePlatform: 1, sourceAccountId: 1, sourceConversationId: 1 }, {
  unique: true,
  partialFilterExpression: {
    sourcePlatform: { $type: "string" },
    sourceAccountId: { $type: "string" },
    sourceConversationId: { $type: "string" },
  },
});
CRMTicketSchema.index({ companyCode: 1, lastInteractionAt: -1, _id: -1 });
CRMTicketSchema.index({ companyCode: 1, customerId: 1, lastInteractionAt: -1 });

export const CRMTicketModel = model<ICRMTicket>("CRMTicket", CRMTicketSchema);

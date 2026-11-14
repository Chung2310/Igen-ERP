import { Schema, model } from "mongoose";

const fieldSchema = new Schema({
  key: { type: String, required: true, match: /^[a-z][a-z0-9_]{0,39}$/ },
  label: { type: String, required: true, maxlength: 100 },
  question: { type: String, required: true, maxlength: 300 },
  type: { type: String, enum: ["text", "long_text", "number", "currency", "date", "phone", "email", "single_select", "multi_select", "checkbox"], default: "text" },
  required: { type: Boolean, default: true },
  options: { type: [String], default: [] },
}, { _id: false });

const schema = new Schema({
  companyCode: { type: String, required: true, index: true },
  platform: { type: String, enum: ["facebook", "zalo", "tiktok"], index: true },
  accountId: { type: String, trim: true, maxlength: 200, index: true },
  status: { type: String, enum: ["draft", "active", "archived"], default: "draft", index: true },
  version: { type: Number, required: true, min: 1 },
  goal: { type: String, required: true, maxlength: 300 },
  fields: { type: [fieldSchema], required: true, validate: [(value: unknown[]) => value.length > 0 && value.length <= 30, "Cần 1–30 trường thông tin."] },
  completionMessage: { type: String, required: true, maxlength: 500 },
  needGroups: { type: [{ _id: false, key: String, label: String, fieldKeys: [String] }], default: undefined },
  sourceDocumentIds: { type: [String], default: [] },
}, { timestamps: true });

schema.index({ companyCode: 1, version: 1 }, { unique: true });
schema.index({ companyCode: 1, status: 1, version: -1 });
schema.index({ companyCode: 1, platform: 1, accountId: 1, status: 1, version: -1 });

export const LeadIntakeProfileModel = model("LeadIntakeProfile", schema);

import { Schema, model } from "mongoose";

const color = { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ };

const schema = new Schema({
  ownerId: { type: String, required: true, index: true },
  branchId: { type: String, index: true },
  green: { ...color, default: "#059669" },
  yellow: { ...color, default: "#d97706" },
  red: { ...color, default: "#e11d48" },
  black: { ...color, default: "#020617" },
}, { timestamps: true });

schema.index({ ownerId: 1, branchId: 1 }, { unique: true });

export const BatchProgressSetting = model("BatchProgressSetting", schema);

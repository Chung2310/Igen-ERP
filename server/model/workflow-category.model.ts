import { Schema, model } from "mongoose";

const schema = new Schema({
  companyCode: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 50 },
  normalizedName: { type: String, required: true },
}, { timestamps: true });
schema.pre("validate", function () {
  this.name = this.name?.replace(/\s+/g, " ").trim();
  this.normalizedName = this.name?.toLocaleLowerCase("vi-VN");
});
schema.index({ companyCode: 1, normalizedName: 1 }, { unique: true });
export const WorkflowCategoryModel = model("WorkflowCategory", schema);

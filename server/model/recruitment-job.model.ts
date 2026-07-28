import { Schema, model } from "mongoose";

const RecruitmentJobSchema = new Schema(
  {
    companyCode: { type: String, required: true, uppercase: true, trim: true },
    branchId: { type: Schema.Types.ObjectId, required: true, ref: "Branch" },
    code: { type: String, required: true, uppercase: true, trim: true },
    title: { type: String, default: "", trim: true },
    department: { type: String, default: "", trim: true },
    headcount: { type: Number, default: 1 },
    description: { type: String, default: "" },
    requirements: { type: String, default: "" },
    benefits: { type: String, default: "" },
    salaryMin: { type: Number, default: null },
    salaryMax: { type: Number, default: null },
    showSalary: { type: Boolean, default: false },
    employmentType: { type: String, default: "full_time", trim: true },
    workplaceType: {
      type: String,
      enum: ["onsite", "hybrid", "remote"],
      default: "onsite",
    },
    location: { type: String, default: "", trim: true },
    applicationDeadline: { type: Date, default: null },
    status: {
      type: String,
      enum: ["draft", "open", "paused", "closed"],
      default: "draft",
    },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    version: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, default: null, ref: "User" },
  },
  { timestamps: true, versionKey: false },
);

RecruitmentJobSchema.index(
  { companyCode: 1, branchId: 1, code: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
RecruitmentJobSchema.index({
  companyCode: 1,
  branchId: 1,
  status: 1,
  applicationDeadline: 1,
});

export const RecruitmentJobModel = model("RecruitmentJob", RecruitmentJobSchema);

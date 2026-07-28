import { Schema, model } from "mongoose";

const RecruitmentApplicantSchema = new Schema(
  {
    companyCode: { type: String, required: true, uppercase: true, trim: true },
    branchId: { type: Schema.Types.ObjectId, required: true, ref: "Branch" },
    jobId: { type: Schema.Types.ObjectId, required: true, ref: "RecruitmentJob" },
    stageId: { type: String, required: true, trim: true },
    recruiterId: { type: Schema.Types.ObjectId, default: null, ref: "User" },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true },
    normalizedEmail: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    normalizedPhone: { type: String, default: "", trim: true },
    birthDate: { type: Date, default: null },
    address: { type: String, default: "", trim: true },
    experience: { type: String, default: "" },
    education: { type: String, default: "" },
    skills: { type: [String], default: [] },
    expectedSalary: { type: Number, default: null },
    availableDate: { type: Date, default: null },
    source: { type: String, default: "", trim: true },
    notes: { type: String, default: "" },
    outcome: {
      type: String,
      enum: ["active", "hired", "rejected", "withdrawn"],
      default: "active",
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

RecruitmentApplicantSchema.index({
  companyCode: 1,
  branchId: 1,
  jobId: 1,
  stageId: 1,
  outcome: 1,
  recruiterId: 1,
  createdAt: -1,
});
RecruitmentApplicantSchema.index({ companyCode: 1, branchId: 1, normalizedEmail: 1 });
RecruitmentApplicantSchema.index({ companyCode: 1, branchId: 1, normalizedPhone: 1 });

export const RecruitmentApplicantModel = model(
  "RecruitmentApplicant",
  RecruitmentApplicantSchema,
);

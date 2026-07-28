import { Schema, model } from "mongoose";

const RecruitmentInterviewSchema = new Schema(
  {
    companyCode: { type: String, required: true, uppercase: true, trim: true },
    branchId: { type: Schema.Types.ObjectId, required: true, ref: "Branch" },
    applicantId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "RecruitmentApplicant",
    },
    jobId: { type: Schema.Types.ObjectId, required: true, ref: "RecruitmentJob" },
    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date, required: true },
    format: { type: String, enum: ["onsite", "online", "phone"], required: true },
    location: { type: String, default: "", trim: true },
    meetingLink: { type: String, default: "", trim: true },
    interviewerIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
    },
    result: { type: String, default: "" },
    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    version: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, default: null, ref: "User" },
  },
  { timestamps: true, versionKey: false },
);

RecruitmentInterviewSchema.index({
  companyCode: 1,
  branchId: 1,
  scheduledStart: 1,
  status: 1,
});
RecruitmentInterviewSchema.index({ companyCode: 1, branchId: 1, applicantId: 1 });

export const RecruitmentInterviewModel = model(
  "RecruitmentInterview",
  RecruitmentInterviewSchema,
);

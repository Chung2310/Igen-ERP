import { Schema, model } from "mongoose";

const RecruitmentPipelineStageSchema = new Schema(
  {
    id: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, required: true, trim: true },
    position: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    terminalOutcome: {
      type: String,
      enum: ["hired", "rejected", "withdrawn", null],
      default: null,
    },
  },
  { _id: false },
);

const RecruitmentPipelineSchema = new Schema(
  {
    companyCode: { type: String, required: true, uppercase: true, trim: true },
    branchId: { type: Schema.Types.ObjectId, required: true, ref: "Branch" },
    stages: { type: [RecruitmentPipelineStageSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    version: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, default: null, ref: "User" },
  },
  { timestamps: true, versionKey: false },
);

RecruitmentPipelineSchema.index({ companyCode: 1, branchId: 1 }, { unique: true });

export const RecruitmentPipelineModel = model(
  "RecruitmentPipeline",
  RecruitmentPipelineSchema,
);

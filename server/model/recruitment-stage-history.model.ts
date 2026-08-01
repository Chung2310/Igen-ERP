import { Schema, model } from "mongoose";

const RecruitmentStageHistorySchema = new Schema(
  {
    companyCode: { type: String, required: true, uppercase: true, trim: true },
    branchId: { type: Schema.Types.ObjectId, required: true, ref: "Branch" },
    applicantId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "RecruitmentApplicant",
    },
    fromStageId: { type: String, default: null },
    fromStageName: { type: String, default: null },
    toStageId: { type: String, required: true },
    toStageName: { type: String, required: true },
    note: { type: String, default: "" },
    actorId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    version: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, default: null, ref: "User" },
  },
  { timestamps: true, versionKey: false },
);

RecruitmentStageHistorySchema.index({
  companyCode: 1,
  branchId: 1,
  applicantId: 1,
  createdAt: 1,
});

export const RecruitmentStageHistoryModel = model(
  "RecruitmentStageHistory",
  RecruitmentStageHistorySchema,
);

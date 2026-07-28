import { Schema, model } from "mongoose";

const RecruitmentAttachmentSchema = new Schema(
  {
    companyCode: { type: String, required: true, uppercase: true, trim: true },
    branchId: { type: Schema.Types.ObjectId, required: true, ref: "Branch" },
    applicantId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "RecruitmentApplicant",
    },
    originalName: { type: String, required: true, trim: true },
    storageName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    size: { type: Number, required: true },
    storageKey: { type: String, required: true, trim: true },
    uploadedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    version: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, default: null, ref: "User" },
  },
  { timestamps: true, versionKey: false },
);

RecruitmentAttachmentSchema.index({
  companyCode: 1,
  branchId: 1,
  applicantId: 1,
  createdAt: -1,
});

export const RecruitmentAttachmentModel = model(
  "RecruitmentAttachment",
  RecruitmentAttachmentSchema,
);

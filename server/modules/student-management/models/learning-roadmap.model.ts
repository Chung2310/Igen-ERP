import { Schema, model } from "mongoose";
import { ILearningRoadmap } from "../interfaces/learning-roadmap.interface";

const policySchema = new Schema({
  matchMode: { type: String, enum: ["all", "any"], default: "all" },
  minAttendanceRate: { type: Number, min: 0, max: 100, default: null },
  minAssignmentRate: { type: Number, min: 0, max: 100, default: null },
  minMiniTestRate: { type: Number, min: 0, max: 100, default: null },
  minExamRate: { type: Number, min: 0, max: 100, default: null },
  teacherConfirmationRequired: { type: Boolean, default: false },
}, { _id: false });

const stepSchema = new Schema({
  id: { type: String, required: true },
  courseId: { type: String, required: true },
  order: { type: Number, required: true, min: 1 },
  minClassSize: { type: Number, default: 0, min: 0 },
  maxClassSize: { type: Number, default: 0, min: 0 },
  eligibilityPolicy: { type: policySchema, default: () => ({}) },
}, { _id: false });

const roadmapSchema = new Schema<ILearningRoadmap>({
  ownerId: { type: String, required: true, index: true },
  branchId: { type: String, index: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "", trim: true },
  status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
  steps: { type: [stepSchema], default: [] },
}, { timestamps: true });

roadmapSchema.index({ ownerId: 1, branchId: 1, code: 1 }, { unique: true });

export const LearningRoadmap = model<ILearningRoadmap>("LearningRoadmap", roadmapSchema);

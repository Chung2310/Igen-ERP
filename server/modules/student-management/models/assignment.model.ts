import { Schema, model } from "mongoose";
import { IAssignment } from "../interfaces/assignment.interface";

const attachmentSchema = new Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const assignmentSchema = new Schema<IAssignment>({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  attachments: { type: [attachmentSchema], default: [] },
  batchId: { type: String, required: true, index: true },
  courseId: { type: String, required: true, index: true },
  dueDate: { type: Date },
  instructorId: { type: String, required: true, index: true },
  ownerId: { type: String, required: true, index: true },
  branchId: { type: String, index: true }
}, { timestamps: true });

export const AssignmentModel = model<IAssignment>("Assignment", assignmentSchema);

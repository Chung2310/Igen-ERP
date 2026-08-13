import { Schema, model } from "mongoose";
import { IProject } from "../interface/project.interface";

const ProjectSchema = new Schema<IProject>({
  name: { type: String, required: true, index: true },
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, index: true },
  creatorUid: { type: String, required: true, index: true },
  status: { type: String, enum: ["not_started", "in_progress", "paused", "completed", "cancelled"], default: "not_started", index: true },
  priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium", index: true },
  startAt: Date,
  dueAt: Date,
  completedAt: { type: Date, default: null },
  attachments: [{ id: String, name: String, url: String, type: String, size: Number, uploadToken: String }],
  createdAt: { type: Date, default: Date.now, index: true },
});

export const ProjectModel = model<IProject>("Project", ProjectSchema);

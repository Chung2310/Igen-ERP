import { Schema, model } from "mongoose";
import { IProject } from "../interface/project.interface";

const ProjectSchema = new Schema<IProject>({
  name: { type: String, required: true, index: true },
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, index: true },
  creatorUid: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
});

export const ProjectModel = model<IProject>("Project", ProjectSchema);

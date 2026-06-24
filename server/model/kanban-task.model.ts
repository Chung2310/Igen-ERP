import { Schema, model } from "mongoose";
import { IKanbanTask } from "../interface/kanban-task.interface";

const TaskHistorySchema = new Schema(
  {
    time: { type: String, required: true },
    user: { type: String, required: true },
    action: { type: String, required: true },
  },
  { _id: false }
);

const KanbanTaskSchema = new Schema<IKanbanTask>({
  title: { type: String, required: true, index: true },
  description: { type: String },
  assigneeUid: { type: String, required: true, index: true },
  assignee: { type: String, required: true },
  assigneeAvatar: { type: String, default: "" },
  dueDate: { type: String, required: true },
  priority: { type: String, enum: ["High", "Medium", "Low", "Cao", "Trung bình", "Thấp"], default: "Medium" },
  status: { type: String, required: true, index: true },
  category: { type: String },
  companyCode: { type: String, required: true, index: true },
  creatorUid: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  projectId: { type: String, index: true },
  startTime: { type: String },
  estTime: { type: Number },
  endTime: { type: String },
  actualTime: { type: Number },
  tags: { type: [String], default: [] },
  linkNote: { type: String },
  history: { type: [TaskHistorySchema], default: [] },
});

export const KanbanTaskModel = model<IKanbanTask>("KanbanTask", KanbanTaskSchema);

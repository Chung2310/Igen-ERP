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

const TaskAttachmentSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, enum: ["image", "video", "audio", "file", "link"], default: "file" },
    size: { type: Number },
    uploadToken: { type: String },
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
  branchId: { type: String, index: true },
  creatorUid: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  projectId: { type: String, index: true },
  startTime: { type: String },
  actualStartTime: { type: String },
  estTime: { type: Number },
  endTime: { type: String },
  actualTime: { type: Number },
  completedAt: { type: String },
  revision: { type: Number, default: 0 },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  progressNote: { type: String, maxlength: 2000 },
  helpRequested: { type: Boolean, default: false },
  helpReason: { type: String, maxlength: 2000 },
  helpers: { type: [{ uid: String, name: String }], default: [] },
  deadlineReminderSentAt: { type: Date },
  overdueNotifiedAt: { type: Date },
  tags: { type: [String], default: [] },
  linkNote: { type: String },
  attachments: { type: [TaskAttachmentSchema], default: [] },
  history: { type: [TaskHistorySchema], default: [] },
  workflowId: { type: String, index: true },
  workflowStepId: { type: String, index: true },
  participantId: { type: String, index: true },
  isFromWorkflow: { type: Boolean, default: false },
});

export const KanbanTaskModel = model<IKanbanTask>("KanbanTask", KanbanTaskSchema);

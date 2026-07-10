import { Schema, model } from "mongoose";
import { IWorkflow } from "../interface/workflow.interface";

const WorkflowSubTaskSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    assigneeUid: { type: String, default: "" },
    assignee: { type: String, default: "" },
    done: { type: Boolean, default: false },
  },
  { _id: false }
);

const WorkflowStepSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    assigneeUid: { type: String, default: "" },
    assignee: { type: String, default: "" },
    assigneeUids: { type: [String], default: [] },
    relatedUids: { type: [String], default: [] },
    domain: { type: String, default: "" },
    priority: {
      type: String,
      enum: ["urgent_important", "urgent", "important", "normal"],
      default: "normal",
    },
    deadlineType: {
      type: String,
      enum: ["same_day", "after_1", "after_2", "after_x", "none", "custom_time"],
      default: "none",
    },
    deadlineDays: { type: Number },
    deadlineTime: { type: String, default: "" },
    subTasks: { type: [WorkflowSubTaskSchema], default: [] },
    type: {
      type: String,
      enum: ["start", "task", "approval", "end"],
      default: "task",
    },
    estDays: { type: Number },
    deliverable: { type: String, default: "" },
    note: { type: String, default: "" },
    docLinks: { type: [String], default: [] },
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const WorkflowEdgeSchema = new Schema(
  {
    id: { type: String, required: true },
    source: { type: String, required: true },
    target: { type: String, required: true },
    label: { type: String, default: "" },
  },
  { _id: false }
);

const WorkflowParticipantSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    userUid: { type: String, default: "" },
    avatar: { type: String, default: "" },
    currentStepId: { type: String, default: "" },
    note: { type: String, default: "" },
    description: { type: String, default: "" },
    relatedUids: { type: [String], default: [] },
    priority: {
      type: String,
      enum: ["urgent_important", "urgent", "important", "normal"],
      default: "normal",
    },
    startDate: { type: String, default: "" },
    dueDate: { type: String, default: "" },
    docLinks: { type: [String], default: [] },
    customSubTasks: { type: [WorkflowSubTaskSchema], default: [] },
    projectId: { type: String, default: "" },
    startedAt: { type: String, default: "" },
    updatedAt: { type: String, default: "" },
  },
  { _id: false }
);

const WorkflowSchema = new Schema<IWorkflow>({
  name: { type: String, required: true, index: true },
  description: { type: String, default: "" },
  category: { type: String, default: "" },
  steps: { type: [WorkflowStepSchema], default: [] },
  edges: { type: [WorkflowEdgeSchema], default: [] },
  participants: { type: [WorkflowParticipantSchema], default: [] },
  autoAdvance: { type: Boolean, default: false },
  companyCode: { type: String, required: true, index: true },
  creatorUid: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
});

export const WorkflowModel = model<IWorkflow>("Workflow", WorkflowSchema);

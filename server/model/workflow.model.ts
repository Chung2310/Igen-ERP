import { Schema, model } from "mongoose";
import { IWorkflow } from "../interface/workflow.interface";

const WorkflowStepSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    assigneeUid: { type: String, default: "" },
    assignee: { type: String, default: "" },
    type: {
      type: String,
      enum: ["start", "task", "approval", "end"],
      default: "task",
    },
    estDays: { type: Number },
    deliverable: { type: String, default: "" },
    note: { type: String, default: "" },
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
  companyCode: { type: String, required: true, index: true },
  creatorUid: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
});

export const WorkflowModel = model<IWorkflow>("Workflow", WorkflowSchema);

import { Document } from "mongoose";

export interface IWorkflowStep {
  id: string;
  title: string;
  description?: string;
  assigneeUid?: string;
  assignee?: string;
  /** @deprecated Không còn phân loại ô — giữ lại để tương thích dữ liệu cũ */
  type?: "start" | "task" | "approval" | "end";
  estDays?: number;
  deliverable?: string;
  note?: string;
  position: { x: number; y: number };
}

export interface IWorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface IWorkflowParticipant {
  id: string;
  name: string;
  userUid?: string;
  avatar?: string;
  currentStepId: string;
  note?: string;
  startedAt?: string;
  updatedAt?: string;
}

export interface IWorkflow extends Document {
  name: string;
  description?: string;
  category?: string;
  steps: IWorkflowStep[];
  edges: IWorkflowEdge[];
  participants: IWorkflowParticipant[];
  companyCode: string;
  creatorUid: string;
  createdAt: Date;
}

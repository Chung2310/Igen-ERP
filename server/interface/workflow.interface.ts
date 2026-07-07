import { Document } from "mongoose";

export interface IWorkflowStep {
  id: string;
  title: string;
  description?: string;
  assigneeUid?: string;
  assignee?: string;
  type: "start" | "task" | "approval" | "end";
  estDays?: number;
  position: { x: number; y: number };
}

export interface IWorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface IWorkflow extends Document {
  name: string;
  description?: string;
  category?: string;
  steps: IWorkflowStep[];
  edges: IWorkflowEdge[];
  companyCode: string;
  creatorUid: string;
  createdAt: Date;
}

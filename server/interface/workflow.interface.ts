import { Document } from "mongoose";

export interface IWorkflowStep {
  id: string;
  title: string;
  description?: string;
  assigneeUid?: string;
  assignee?: string;
  assigneeUids?: string[];
  relatedUids?: string[];
  domain?: string;
  priority?: "urgent_important" | "urgent" | "important" | "normal";
  deadlineType?: "same_day" | "after_1" | "after_2" | "after_x" | "none" | "custom_time";
  deadlineDays?: number;
  deadlineTime?: string;
  subTasks?: { id: string; title: string; assigneeUid?: string; assignee?: string; done?: boolean }[];
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
  /** Tên công việc (case) đi qua quy trình */
  name: string;
  /** Người phụ trách chính — fallback nhận task khi bước không gán ai */
  userUid?: string;
  avatar?: string;
  currentStepId: string;
  note?: string;
  description?: string;
  relatedUids?: string[];
  priority?: "urgent_important" | "urgent" | "important" | "normal";
  startDate?: string;
  dueDate?: string;
  docLinks?: string[];
  /** Công việc con riêng của case — sinh task Kanban ở bước đầu tiên */
  customSubTasks?: { id: string; title: string; assigneeUid?: string; assignee?: string; done?: boolean }[];
  projectId?: string;
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
  /** Tự chuyển case sang bước kế khi mọi task Kanban của bước hiện tại hoàn thành */
  autoAdvance?: boolean;
  companyCode: string;
  creatorUid: string;
  createdAt: Date;
}

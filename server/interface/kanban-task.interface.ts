import { Document } from "mongoose";

export interface ITaskHistoryEntry {
  time: string;
  user: string;
  action: string;
}

export interface IKanbanTask extends Document {
  title: string;
  description?: string;
  assigneeUid: string;
  assignee: string;
  assigneeAvatar: string;
  dueDate: string;
  priority: "High" | "Medium" | "Low" | "Cao" | "Trung bình" | "Thấp";
  status: "Not Started" | "In Progress" | "Review/Testing" | "Done" | "Archived" | "todo" | "doing" | "done";
  category?: string;
  companyCode: string;
  creatorUid: string;
  createdAt: Date;
  projectId?: string;
  startTime?: string;
  actualStartTime?: string;
  estTime?: number;
  endTime?: string;
  actualTime?: number;
  completedAt?: string;
  revision?: number;
  deadlineReminderSentAt?: Date;
  overdueNotifiedAt?: Date;
  tags?: string[];
  linkNote?: string;
  history?: ITaskHistoryEntry[];
  workflowId?: string;
  workflowStepId?: string;
  participantId?: string;
  isFromWorkflow?: boolean;
}

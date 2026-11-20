import { Document } from "mongoose";

export interface ITaskHistoryEntry {
  time: string;
  user: string;
  action: string;
}

/** File/đường dẫn đính kèm vào task: ghi âm, hình ảnh, video, tài liệu, link… */
export interface ITaskAttachment {
  id: string;
  name: string;
  url: string;
  type: "image" | "video" | "audio" | "file" | "link";
  size?: number;
}

/** Việc nhỏ (Subtask) thuộc công việc lớn */
export interface ITaskSubtask {
  id: string;
  title: string;
  assigneeUid?: string;
  assignee?: string;
  assigneeAvatar?: string;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  note?: string;
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
  branchId?: string;
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
  attachments?: ITaskAttachment[];
  subtasks?: ITaskSubtask[];
  history?: ITaskHistoryEntry[];
  workflowId?: string;
  workflowStepId?: string;
  workflowInstanceId?: string;
  workflowTransitionId?: string;
  participantId?: string;
  isFromWorkflow?: boolean;
}

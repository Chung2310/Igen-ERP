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
  category?: "Onboarding" | "Đào tạo" | "Tuyển dụng" | "Văn hóa";
  companyCode: string;
  creatorUid: string;
  createdAt: Date;
  projectId?: string;
  startTime?: string;
  estTime?: number;
  endTime?: string;
  actualTime?: number;
  tags?: string[];
  linkNote?: string;
  history?: ITaskHistoryEntry[];
}

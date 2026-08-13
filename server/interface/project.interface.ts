import { Document } from "mongoose";

export interface IProject extends Document {
  name: string;
  companyCode: string;
  branchId?: string;
  creatorUid: string;
  status: "not_started" | "in_progress" | "paused" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  startAt?: Date;
  dueAt?: Date;
  completedAt?: Date | null;
  attachments: Array<{ id: string; name: string; url: string; type: "image" | "video" | "audio" | "file" | "link"; size?: number; uploadToken?: string }>;
  createdAt: Date;
}

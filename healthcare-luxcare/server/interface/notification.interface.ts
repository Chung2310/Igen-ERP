import { Document } from "mongoose";

export type NotifType = "task" | "training" | "he-thong";

export interface INotification extends Document {
  mobilePushQueued?: boolean;
  title: string;
  body: string;
  type: NotifType;
  companyCode: string;
  recipientUid: string;
  read: boolean;
  dedupeKey?: string;
  action?: {
    tab: string;
    subTab?: string;
  };
  createdAt: Date;
}

import { Document } from "mongoose";
import { IInstallmentPlan } from "./installment.interface";

export interface INotification extends Document {
  title: string;
  content: string;
  recipients: string;
  recipientCount: number;
  channels: string[];
  status: 'Đã gửi' | 'Đang gửi' | 'Thất bại';
  ownerId: string;
  branchId?: string;
  // Thông tin đợt thu học phí (chỉ có khi gửi thông báo học phí theo đợt)
  installmentPlan?: IInstallmentPlan;
  createdAt?: Date;
  updatedAt?: Date;
}

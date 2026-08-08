import { Document } from "mongoose";

/**
 * Loại yêu cầu nhân sự có thể xin qua đơn từ. Sau khi được duyệt, mỗi loại sẽ sinh ra
 * một sự kiện tương ứng trên tab Lịch trình.
 */
export type LeaveRequestKind = "event" | "leave" | "wfh" | "exception";

export const LEAVE_REQUEST_KINDS: LeaveRequestKind[] = ["event", "leave", "wfh", "exception"];

export interface IHRLeaveTemplate extends Document {
  companyCode: string;
  branchId?: string;
  /** Loại yêu cầu mà biểu mẫu này phục vụ — dùng để tự điền khi nhân viên nộp đơn. */
  requestKind: LeaveRequestKind;
  name: string;
  fileUrl: string;
  fileName: string;
  uploadedBy: string;
  uploadToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeaveAttachment {
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
  uploadToken?: string;
}

export interface IHRLeaveApplication extends Document {
  companyCode: string;
  branchId?: string;
  employeeId: string;
  employeeName: string;
  /** Tên biểu mẫu được chọn (free-text, giữ nguyên để tương thích dữ liệu cũ). */
  type: string;
  /** Loại yêu cầu chuẩn hoá — quyết định sự kiện sinh ra trên Lịch trình khi duyệt. */
  requestKind: LeaveRequestKind;
  startDate: Date;
  endDate: Date;
  reason: string;
  uploadedFileUrl?: string;
  uploadedFileName?: string;
  attachments?: ILeaveAttachment[];
  status: "pending" | "approved" | "rejected";
  rejectReason?: string;
  note?: string;
  approvedBy?: string;
  approvedAt?: Date;
  approvalType?: "justified" | "unjustified";
  approvalNote?: string;
  year?: number;
  chargeableDays?: number;
  chargeableDates?: string[];
  reminderSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

import type { PaginatedResponse } from "./pagination";

export type RequestKind = "event" | "leave" | "wfh" | "exception";
export const REQUEST_KIND_OPTIONS: { value: RequestKind; label: string }[] = [
  { value: "event", label: "Tạo sự kiện" },
  { value: "leave", label: "Nghỉ phép" },
  { value: "wfh", label: "Làm tại nhà" },
  { value: "exception", label: "Ngoại lệ" },
];
export const LEAVE_STATUS_LABELS = { pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối" } as const;
export interface LeaveAttachment {
  url: string;
  name: string;
  uploadToken?: string;
  mimeType?: string;
  size?: number;
}
export interface LeaveTemplate {
  _id: string;
  name: string;
  requestKind: RequestKind;
  fileUrl: string;
  fileName: string;
}
export interface LeaveApplication {
  _id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  requestKind: RequestKind;
  startDate: string;
  endDate: string;
  reason: string;
  status: keyof typeof LEAVE_STATUS_LABELS;
  canDecide?: boolean;
  attachments?: LeaveAttachment[];
  uploadedFileUrl?: string;
  uploadedFileName?: string;
  rejectReason?: string;
  note?: string;
  approvalNote?: string;
  approvalType?: "justified" | "unjustified";
  chargeableDays?: number;
  createdAt?: string;
}
export interface LeaveApplicationInput {
  templateId?: string;
  type: string;
  requestKind: RequestKind;
  startDate: string;
  endDate: string;
  reason: string;
  attachments: (LeaveAttachment & { uploadToken: string })[];
}
export type LeaveDecision =
  | { decision: "approved"; approvalType: "justified" | "unjustified"; note?: string }
  | { decision: "rejected"; rejectReason: string; note?: string };
export interface LeaveBalance {
  year: number;
  entitlement: number;
  used: number;
  pending: number;
  unexcused: number;
  remaining: number;
}
export type LeaveApplicationPage = PaginatedResponse<LeaveApplication>;
export interface LeaveUploadInput {
  file: string;
  fileName: string;
  mimeType?: string;
  size: number;
}

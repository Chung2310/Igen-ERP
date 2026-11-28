export type ZbsMethod = "uid" | "phone";
export type ZbsMapping = Record<string, { source: "lead" | "answer" | "constant"; key: string }>;
export type ZbsParam = { name: string; required: boolean; type: string; minLength: number; maxLength: number; acceptNull: boolean };
export type ZbsTemplate = {
  templateId: string; name: string; status: string; params: ZbsParam[];
  buttons: Array<{ title: string; content: string; type: number }>;
  previewUrl: string; uidSupported: boolean; phoneSupported: boolean;
  priceUid: number | null; pricePhone: number | null; mapping: ZbsMapping; syncedAt?: string;
};
export type ZbsRowStatus = "blocked" | "pending" | "sending" | "accepted" | "delivered" | "read" | "failed" | "unknown" | "cancelled";
export type ZbsRow = {
  id: string; leadId?: string; name: string; recipient: string; method: ZbsMethod;
  data: Record<string, string>; status: ZbsRowStatus; reason: string;
  trackingId: string; messageId?: string; sentAt?: string; deliveredAt?: string; readAt?: string;
  suggestedMethod?: ZbsMethod;
};
export type ZbsBatch = {
  id: string; name: string; oaId: string; templateId: string; templateName: string;
  method: ZbsMethod; status: "draft" | "queued" | "running" | "paused" | "completed" | "cancelled";
  test: boolean; development: boolean; rows: ZbsRow[]; createdAt: string;
  estimatedCost: number | null; expiresAt: string; confirmedAt?: string;
};
export type ZbsDraftInput = {
  name: string; oaId: string; templateId: string; method: ZbsMethod;
  leadIds: string[]; mapping: ZbsMapping; test?: boolean; development?: boolean;
  manualRecipient?: string;
};
export type ZbsBatchSummary = Pick<ZbsBatch, "id" | "name" | "templateName" | "method" | "status" | "createdAt" | "test"> & { total: number; delivered: number };
export const zbsRowLabels: Record<ZbsRowStatus, string> = {
  blocked: "Cần bổ sung", pending: "Chờ gửi", sending: "Đang gửi", accepted: "Zalo đã tiếp nhận",
  delivered: "Đã giao", read: "Đã đọc", failed: "Thất bại", unknown: "Chờ đối soát", cancelled: "Đã hủy",
};
export const zbsBatchLabels: Record<ZbsBatch["status"], string> = {
  draft: "Chờ xác nhận", queued: "Chờ gửi", running: "Đang gửi", paused: "Tạm dừng", completed: "Hoàn tất", cancelled: "Đã hủy",
};

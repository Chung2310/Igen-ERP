/** Mã quyền của module Sửa chữa & Bảo hành. Router dùng các hằng này thay vì chuỗi rời. */
export const REPAIR_READ_PERMISSION = "repair:read";
export const REPAIR_MANAGE_PERMISSION = "repair:manage";
export const REPAIR_QUOTE_PERMISSION = "repair:quote";
export const REPAIR_PART_ISSUE_PERMISSION = "repair:part-issue";
export const REPAIR_DELIVER_WITH_DEBT_PERMISSION = "repair:deliver-with-debt";
/** Xem giá vốn linh kiện và lãi gộp dịch vụ — tách riêng vì là số liệu nhạy cảm. */
export const REPAIR_COST_READ_PERMISSION = "repair:cost:read";
export const REPAIR_TECHNICIAN_ASSIGN_PERMISSION = "repair:technician-assign";

export const REPAIR_PERMISSIONS = [
  { code: REPAIR_READ_PERMISSION, label: "Xem phiếu sửa chữa", group: "Sửa chữa" },
  { code: REPAIR_MANAGE_PERMISSION, label: "Tạo & xử lý phiếu sửa chữa", group: "Sửa chữa" },
  { code: REPAIR_QUOTE_PERMISSION, label: "Báo giá sửa chữa", group: "Sửa chữa" },
  { code: REPAIR_PART_ISSUE_PERMISSION, label: "Xuất & hoàn linh kiện cho phiếu", group: "Sửa chữa" },
  { code: REPAIR_TECHNICIAN_ASSIGN_PERMISSION, label: "Phân công kỹ thuật viên", group: "Sửa chữa" },
  { code: REPAIR_DELIVER_WITH_DEBT_PERMISSION, label: "Giao máy khi còn nợ", group: "Sửa chữa", description: "Quyền nhạy cảm — cho phép giao máy trước khi thu đủ tiền." },
  { code: REPAIR_COST_READ_PERMISSION, label: "Xem giá vốn linh kiện & lãi dịch vụ", group: "Sửa chữa" },
] as const;

/** Loại thông báo tự động gửi cho khách trong luồng sửa chữa. */
export const REPAIR_NOTIFICATION_EVENTS = ["received", "done"] as const;
export type RepairNotificationEvent = (typeof REPAIR_NOTIFICATION_EVENTS)[number];

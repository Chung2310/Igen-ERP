/**
 * Danh mục quyền hệ thống — nguồn sự thật duy nhất cho các mã quyền
 * được `requirePermission` enforce và UI super-admin hiển thị.
 * Mã quyền phải khớp chính xác chuỗi dùng trong middleware/route.
 */
export interface PermissionCatalogEntry {
  code: string;
  label: string;
  group: string;
}

export const PERMISSION_CATALOG: PermissionCatalogEntry[] = [
  { code: "user:read", label: "Xem người dùng", group: "Người dùng" },
  { code: "user:manage", label: "Quản lý người dùng", group: "Người dùng" },
  { code: "face:manage", label: "Quản lý dữ liệu khuôn mặt", group: "Người dùng" },
  { code: "crm:read", label: "Xem CRM", group: "CRM" },
  { code: "crm:manage", label: "Quản lý CRM", group: "CRM" },
  { code: "kanban:read", label: "Xem công việc", group: "Công việc & Dự án" },
  { code: "kanban:manage", label: "Quản lý công việc", group: "Công việc & Dự án" },
  { code: "project:read", label: "Xem dự án", group: "Công việc & Dự án" },
  { code: "project:manage", label: "Quản lý dự án", group: "Công việc & Dự án" },
  { code: "stock:read", label: "Xem kho", group: "Kho & Sản phẩm" },
  { code: "stock:manage", label: "Quản lý kho", group: "Kho & Sản phẩm" },
  { code: "marketing:post", label: "Đăng nội dung marketing", group: "Marketing" },
  { code: "hr:read", label: "Xem nhân sự", group: "Nhân sự" },
  { code: "timekeeping:read", label: "Xem chấm công", group: "Nhân sự" },
  { code: "timekeeping:manage", label: "Quản lý & duyệt chấm công", group: "Nhân sự" },
  { code: "student:read", label: "Xem học viên/khách hàng", group: "Học viên & Khách hàng" },
  { code: "chat:read", label: "Xem trò chuyện", group: "Trò chuyện" },
  { code: "resource:read", label: "Xem tài nguyên", group: "Tài nguyên" },
  { code: "resource:manage", label: "Quản lý tài nguyên & kết nối Google Drive", group: "Tài nguyên" },
];

export const PERMISSION_CODES = PERMISSION_CATALOG.map((entry) => entry.code);

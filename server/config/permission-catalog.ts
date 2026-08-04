/**
 * Danh mục quyền hệ thống — nguồn sự thật duy nhất cho các mã quyền
 * được `requirePermission` enforce và UI super-admin hiển thị.
 * Mã quyền phải khớp chính xác chuỗi dùng trong middleware/route.
 */
export interface PermissionCatalogEntry {
  code: string;
  label: string;
  group: string;
  description?: string;
}

export const RECRUITMENT_PERMISSION = "recruitment:manage";

export const PERMISSION_CATALOG: PermissionCatalogEntry[] = [
  { code: "dashboard:read", label: "Xem tổng quan", group: "Tổng quan" },
  { code: "user:read", label: "Xem người dùng", group: "Người dùng" },
  { code: "user:manage", label: "Quản lý người dùng", group: "Người dùng" },
  { code: "face:manage", label: "Quản lý dữ liệu khuôn mặt", group: "Người dùng" },
  { code: "kanban:read", label: "Xem công việc", group: "Công việc & Dự án" },
  { code: "kanban:manage", label: "Quản lý công việc", group: "Công việc & Dự án" },
  { code: "project:read", label: "Xem dự án", group: "Công việc & Dự án" },
  { code: "project:manage", label: "Quản lý dự án", group: "Công việc & Dự án" },
  { code: "stock:read", label: "Xem kho", group: "Kho & Sản phẩm" },
  { code: "stock:manage", label: "Quản lý kho", group: "Kho & Sản phẩm" },
  { code: "hr:read", label: "Xem nhân sự", group: "Nhân sự" },
  { code: "timekeeping:read", label: "Xem chấm công", group: "Nhân sự" },
  { code: "timekeeping:manage", label: "Quản lý & duyệt chấm công", group: "Nhân sự" },
  { code: "leave:approve", label: "Duyệt đơn nghỉ phép", group: "Nhân sự" },
  { code: "payroll:read", label: "Xem bảng lương", group: "Nhân sự" },
  { code: "payroll:prepare", label: "Chuẩn bị dữ liệu lương", group: "Nhân sự", description: "Tạo kỳ lương, đồng bộ và khóa dữ liệu chấm công trước khi tính lương" },
  { code: "payroll:manage", label: "Quản lý & tính lương", group: "Nhân sự" },
  { code: "payroll:pay", label: "Thanh toán bảng lương", group: "Nhân sự" },
  // Each business module exposes its own umbrella permissions. Student area permissions are
  // grouped here - see RETIRED_PERMISSION_CODES below.
  { code: "student:read", label: "Xem học viên", group: "Học viên" },
  { code: "student:manage", label: "Quản lý học viên", group: "Học viên" },
  { code: "worker:read", label: "Xem lao động", group: "Lao động" },
  { code: "worker:manage", label: "Quản lý lao động", group: "Lao động" },
  { code: "customer:read", label: "Xem khách hàng", group: "Khách hàng" },
  { code: "customer:manage", label: "Quản lý khách hàng", group: "Khách hàng" },
  { code: "candidate:read", label: "Xem ứng viên", group: "Ứng viên" },
  { code: "candidate:manage", label: "Quản lý ứng viên", group: "Ứng viên" },
  { code: "custom-field:manage", label: "Quản lý trường dữ liệu tùy chỉnh", group: "Cấu hình dữ liệu", description: "Tạo, sửa, lưu trữ và xóa trường dữ liệu tùy chỉnh của module học viên." },
  { code: "student-settings:manage", label: "Cấu hình module học viên", group: "Cấu hình hệ thống", description: "Thiết lập cách vận hành module quản lý học viên." },
  { code: "company-smtp:manage", label: "Cấu hình SMTP doanh nghiệp", group: "Cấu hình hệ thống", description: "Xem, cập nhật, xác minh và gửi thử bằng máy chủ SMTP doanh nghiệp." },
  { code: "company-payment:manage", label: "Cấu hình thanh toán doanh nghiệp", group: "Cấu hình hệ thống", description: "Cài đặt tài khoản VietQR và cấu hình thanh toán chung của doanh nghiệp." },
  { code: "partner:read", label: "Xem đối tác & cộng tác viên", group: "Đối tác" },
  { code: "partner:manage", label: "Quản lý đối tác & hoa hồng", group: "Đối tác" },
  { code: "chat:read", label: "Xem trò chuyện", group: "Trò chuyện" },
  { code: "resource:read", label: "Xem tài nguyên", group: "Tài nguyên" },
  { code: "resource:manage", label: "Quản lý tài nguyên & kết nối Google Drive", group: "Tài nguyên" },
  { code: "company-email:manage", label: "Quản lý email chúc mừng", group: "Nhân sự" },
  { code: RECRUITMENT_PERMISSION, label: "Quản lý tuyển dụng", group: "Nhân sự" },
];

export const PERMISSION_CODES = PERMISSION_CATALOG.map((entry) => entry.code);

/**
 * Các mã quyền chi tiết của module học viên/lao động đã bị gộp vào `student:read` /
 * `student:manage`. Giữ danh sách để (1) xóa khỏi bảng Permission và (2) nâng cấp các
 * vai trò/tài khoản cũ đang giữ mã chi tiết sang mã tổng tương ứng khi khởi động.
 */
export const RETIRED_STUDENT_PERMISSIONS = [
  "student-profile:read", "student-profile:manage",
  "course:read", "course:manage",
  "batch:read", "batch:manage",
  "exam:read", "exam:manage",
  "payment:read", "payment:manage",
  "student-notification:read", "student-notification:manage",
  "student-resource:read", "student-resource:manage",
  "assignment:read", "assignment:manage",
];

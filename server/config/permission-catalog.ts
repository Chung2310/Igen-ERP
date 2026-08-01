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
  // Module học viên/lao động chỉ phơi ra đúng hai mã quyền. Các mã chi tiết theo từng
  // khu vực (course/batch/exam/payment/student-profile/...) đã được gộp vào đây — xem
  // RETIRED_PERMISSION_CODES bên dưới.
  { code: "student:read", label: "Xem học viên/lao động", group: "Học viên & Lao động", description: "Xem toàn bộ module: hồ sơ học viên/lao động, khóa học, lớp/dự án, lịch thi, học phí, bài tập, tài nguyên và thông báo." },
  { code: "student:manage", label: "Quản lý học viên/lao động", group: "Học viên & Lao động", description: "Thêm, sửa, xóa và nhập dữ liệu trên toàn bộ module học viên/lao động." },
  { code: "custom-field:manage", label: "Quản lý trường dữ liệu tùy chỉnh", group: "Cấu hình dữ liệu", description: "Tạo, sửa, lưu trữ và xóa trường dữ liệu tùy chỉnh của module học viên." },
  { code: "student-settings:manage", label: "Cấu hình module học viên", group: "Cấu hình hệ thống", description: "Thiết lập cách vận hành module quản lý học viên." },
  { code: "company-smtp:manage", label: "Cấu hình SMTP doanh nghiệp", group: "Cấu hình hệ thống", description: "Xem, cập nhật, xác minh và gửi thử bằng máy chủ SMTP doanh nghiệp." },
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

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
  { code: "student:read", label: "Xem học viên/khách hàng", group: "Học viên & Khách hàng" },
  { code: "student:manage", label: "Quản lý học viên/khách hàng", group: "Học viên & Khách hàng" },
  { code: "student-profile:read", label: "Xem hồ sơ học viên/lao động", group: "Học viên & Lao động", description: "Xem danh sách và thông tin hồ sơ học viên hoặc lao động trong phạm vi chi nhánh." },
  { code: "student-profile:manage", label: "Quản lý hồ sơ học viên/lao động", group: "Học viên & Lao động", description: "Thêm, sửa, xóa, nhập dữ liệu và gán chi nhánh cho hồ sơ học viên hoặc lao động." },
  { code: "course:read", label: "Xem khóa học", group: "Đào tạo", description: "Xem danh sách, nội dung và thông tin các khóa học." },
  { code: "course:manage", label: "Quản lý khóa học", group: "Đào tạo", description: "Tạo, cập nhật, phân loại và xóa khóa học." },
  { code: "batch:read", label: "Xem lớp học/dự án", group: "Đào tạo", description: "Xem lớp học, dự án, học viên và giáo viên được phân công." },
  { code: "batch:manage", label: "Quản lý lớp học/dự án", group: "Đào tạo", description: "Mở lớp hoặc dự án, phân công giáo viên và quản lý thành viên." },
  { code: "exam:read", label: "Xem lịch thi", group: "Đào tạo", description: "Xem đợt thi, lịch thi và kết quả thi." },
  { code: "exam:manage", label: "Quản lý lịch thi", group: "Đào tạo", description: "Tạo, cập nhật, xóa đợt thi và nhập kết quả thi." },
  { code: "payment:read", label: "Xem học phí và thanh toán", group: "Tài chính học viên", description: "Xem công nợ, học phí và lịch sử thanh toán của học viên." },
  { code: "payment:manage", label: "Quản lý học phí và thanh toán", group: "Tài chính học viên", description: "Ghi nhận, cập nhật và xử lý các khoản thanh toán học viên." },
  { code: "student-notification:read", label: "Xem thông báo học viên", group: "Nội dung & Liên lạc", description: "Xem nội dung và lịch sử thông báo gửi cho học viên." },
  { code: "student-notification:manage", label: "Quản lý thông báo học viên", group: "Nội dung & Liên lạc", description: "Soạn, gửi, cập nhật và xóa thông báo học viên." },
  { code: "student-resource:read", label: "Xem tài nguyên học tập", group: "Nội dung & Liên lạc", description: "Xem và tải tài nguyên học tập trong module học viên." },
  { code: "student-resource:manage", label: "Quản lý tài nguyên học tập", group: "Nội dung & Liên lạc", description: "Tạo, tải lên, cập nhật và xóa tài nguyên học tập." },
  { code: "assignment:read", label: "Xem bài tập và điểm danh", group: "Đào tạo", description: "Xem bài tập, bài nộp và dữ liệu điểm danh lớp học." },
  { code: "assignment:manage", label: "Quản lý bài tập và điểm danh", group: "Đào tạo", description: "Tạo bài tập, chấm bài và quản lý dữ liệu điểm danh." },
  { code: "custom-field:manage", label: "Quản lý trường dữ liệu tùy chỉnh", group: "Cấu hình dữ liệu", description: "Tạo, sửa, lưu trữ và xóa trường dữ liệu tùy chỉnh của module học viên." },
  { code: "student-settings:manage", label: "Cấu hình module học viên", group: "Cấu hình hệ thống", description: "Thiết lập loại đối tượng và cách vận hành module quản lý học viên." },
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

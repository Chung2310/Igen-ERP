export interface PermissionDefinition {
  code: string;
  label: string;
  description?: string;
  group?: string;
}

export const PERMISSION_TRANSLATIONS: Record<string, { label: string; group?: string; description?: string }> = {
  "*": {
    label: "Toàn quyền hệ thống",
    group: "Quản trị cao cấp",
    description: "Cho phép truy cập và quản trị tất cả các tính năng trong hệ thống",
  },
  // Quản lý nhân sự & Chấm công
  "user:read": {
    label: "Xem thông tin nhân sự",
    group: "Quản lý nhân sự",
    description: "Xem danh sách tài khoản, sơ đồ tổ chức và thông tin nhân viên",
  },
  "user:manage": {
    label: "Quản trị nhân sự & tài khoản",
    group: "Quản lý nhân sự",
    description: "Thêm mới, chỉnh sửa thông tin, đặt vai trò và xóa tài khoản nhân viên",
  },
  "hr:read": {
    label: "Xem tổng quan nhân sự",
    group: "Quản lý nhân sự",
    description: "Xem thẻ và biểu đồ nhân sự trên trang Tổng quan. Lưu ý: để dùng module NHÂN SỰ (sơ đồ tổ chức, lịch, kanban) cần cấp thêm quyền \"Xem thông tin nhân sự\" (user:read) để tải được danh sách nhân viên.",
  },
  "timekeeping:read": {
    label: "Xem bảng chấm công",
    group: "Quản lý nhân sự",
    description: "Xem dữ liệu điểm danh, lịch làm việc và bảng chấm công ngày/tháng",
  },
  "leave:approve": { label: "Duyệt đơn nghỉ phép", group: "Quản lý nhân sự", description: "Phê duyệt hoặc từ chối đơn nghỉ phép và phân loại nghỉ chính đáng/không chính đáng" },
  "timekeeping:manage": {
    label: "Quản lý & duyệt chấm công",
    group: "Quản lý nhân sự",
    description: "Duyệt đơn xin nghỉ, chỉnh sửa bản ghi chấm công và cấu hình ca làm việc",
  },
  "payroll:read": {
    label: "Xem bảng lương nhân sự",
    group: "Quản lý nhân sự",
    description: "Xem phiếu lương, phụ cấp và bảng tính lương nhân viên",
  },
  "payroll:prepare": {
    label: "Chuẩn bị dữ liệu lương nhân sự",
    group: "Quản lý nhân sự",
    description: "Tạo kỳ lương, đồng bộ và khóa dữ liệu chấm công trước khi tính lương",
  },
  "payroll:pay": { label: "Thanh toán bảng lương", description: "Xác nhận và hoàn tất thanh toán payroll" },
  "payroll:manage": {
    label: "Quản lý & tính lương nhân sự",
    group: "Quản lý nhân sự",
    description: "Tạo bảng lương, duyệt thưởng và chốt kỳ trả lương cho công ty",
  },
  "face:manage": {
    label: "Quản lý chấm công khuôn mặt AI",
    group: "Quản lý nhân sự",
    description: "Cấu hình dữ liệu và nhận diện khuôn mặt chấm công AI",
  },
  // Quản lý đào tạo & Học viên
  "student:read": {
    label: "Xem danh sách học viên",
    group: "Quản lý đào tạo",
    description: "Xem danh sách học viên, lớp học và kết quả đào tạo",
  },
  "student:manage": {
    label: "Quản lý học viên & xếp lớp",
    group: "Quản lý đào tạo",
    description: "Thêm mới học viên, xếp lớp, điểm danh và cấp chứng chỉ",
  },
  "student-profile:read": { label: "Xem hồ sơ học viên/lao động", group: "Học viên & Lao động", description: "Xem danh sách và thông tin hồ sơ trong phạm vi chi nhánh" },
  "student-profile:manage": { label: "Quản lý hồ sơ học viên/lao động", group: "Học viên & Lao động", description: "Thêm, sửa, xóa, nhập dữ liệu và gán chi nhánh cho hồ sơ" },
  "partner:read": {
    label: "Xem đối tác & cộng tác viên",
    group: "Quản lý đối tác",
    description: "Xem danh sách, chi tiết, số liệu giới thiệu và hoa hồng đối tác",
  },
  "partner:manage": {
    label: "Quản lý đối tác & hoa hồng",
    group: "Quản lý đối tác",
    description: "Thêm, sửa, xóa, nhập Excel, cấu hình level và ghi nhận chi trả hoa hồng",
  },
  "course:read": {
    label: "Xem danh sách khóa học",
    group: "Quản lý đào tạo",
    description: "Xem thông tin khóa học, lộ trình và giáo trình đào tạo",
  },
  "course:manage": {
    label: "Quản lý khóa học & chương trình",
    group: "Quản lý đào tạo",
    description: "Tạo khóa học mới, thiết lập học phần và phân công giảng viên",
  },
  "batch:read": { label: "Xem lớp học/dự án", group: "Đào tạo", description: "Xem lớp học, dự án và thành viên được phân công" },
  "batch:manage": { label: "Quản lý lớp học/dự án", group: "Đào tạo", description: "Mở lớp, phân công giáo viên và quản lý thành viên" },
  "exam:read": { label: "Xem lịch thi", group: "Đào tạo", description: "Xem đợt thi, lịch thi và kết quả" },
  "exam:manage": { label: "Quản lý lịch thi", group: "Đào tạo", description: "Tạo, cập nhật, xóa đợt thi và nhập kết quả" },
  "payment:read": { label: "Xem học phí và thanh toán", group: "Tài chính học viên", description: "Xem công nợ, học phí và lịch sử thanh toán" },
  "payment:manage": { label: "Quản lý học phí và thanh toán", group: "Tài chính học viên", description: "Ghi nhận và xử lý các khoản thanh toán học viên" },
  "student-notification:read": { label: "Xem thông báo học viên", group: "Nội dung & Liên lạc", description: "Xem nội dung và lịch sử thông báo học viên" },
  "student-notification:manage": { label: "Quản lý thông báo học viên", group: "Nội dung & Liên lạc", description: "Soạn, gửi, cập nhật và xóa thông báo học viên" },
  "student-resource:read": { label: "Xem tài nguyên học tập", group: "Nội dung & Liên lạc", description: "Xem và tải tài nguyên trong module học viên" },
  "student-resource:manage": { label: "Quản lý tài nguyên học tập", group: "Nội dung & Liên lạc", description: "Tạo, tải lên, cập nhật và xóa tài nguyên học tập" },
  "assignment:read": { label: "Xem bài tập và điểm danh", group: "Đào tạo", description: "Xem bài tập, bài nộp và dữ liệu điểm danh" },
  "assignment:manage": { label: "Quản lý bài tập và điểm danh", group: "Đào tạo", description: "Tạo bài tập, chấm bài và quản lý điểm danh" },
  "custom-field:manage": { label: "Quản lý trường dữ liệu tùy chỉnh", group: "Cấu hình dữ liệu", description: "Cấu hình trường dữ liệu tùy chỉnh của module học viên" },
  "student-settings:manage": { label: "Cấu hình module học viên", group: "Cấu hình hệ thống", description: "Thiết lập loại đối tượng và cách vận hành module học viên" },
  "company-smtp:manage": { label: "Cấu hình SMTP doanh nghiệp", group: "Cấu hình hệ thống", description: "Xem, cập nhật, xác minh và gửi thử SMTP doanh nghiệp" },
  // Kho & Sản phẩm
  "stock:read": {
    label: "Xem tồn kho & sản phẩm",
    group: "Kho & Sản phẩm",
    description: "Xem lịch sử tồn kho, thông tin sản phẩm và nhật ký xuất nhập hàng",
  },
  "stock:manage": {
    label: "Quản lý xuất nhập kho",
    group: "Kho & Sản phẩm",
    description: "Tạo phiếu nhập kho, xuất kho và điều chỉnh số lượng tồn kho",
  },
  "product:manage": {
    label: "Quản lý danh mục & bảng giá",
    group: "Kho & Sản phẩm",
    description: "Tạo mới sản phẩm, cập nhật giá bán và thiết lập ngưỡng cảnh báo tồn kho",
  },
  // Công việc & Dự án
  "kanban:read": {
    label: "Xem công việc Kanban",
    group: "Công việc & Dự án",
    description: "Xem danh sách và trạng thái thẻ công việc trên bảng Kanban",
  },
  "kanban:manage": {
    label: "Quản lý & giao việc Kanban",
    group: "Công việc & Dự án",
    description: "Tạo công việc mới, kéo thả tiến độ, phân công người thực hiện",
  },
  "project:read": {
    label: "Xem danh sách dự án",
    group: "Công việc & Dự án",
    description: "Xem tổng quan danh sách các dự án đang triển khai",
  },
  "project:manage": {
    label: "Quản trị & thiết lập dự án",
    group: "Công việc & Dự án",
    description: "Tạo dự án mới, cài đặt thành viên và quản lý tiến độ dự án",
  },
  // Trò chuyện & Trao đổi
  "chat:read": {
    label: "Tham gia trò chuyện nội bộ",
    group: "Trò chuyện & Trao đổi",
    description: "Gửi tin nhắn, trao đổi và nhận thông báo trong phòng chat công ty",
  },
  "chat:manage": {
    label: "Quản lý nhóm & kênh chat",
    group: "Trò chuyện & Trao đổi",
    description: "Tạo phòng chat mới, quản lý thành viên và ghim thông báo quan trọng",
  },
  // Tài nguyên & Tài liệu
  "resource:read": {
    label: "Xem thư viện tài nguyên",
    group: "Tài liệu & Tài nguyên",
    description: "Xem và tải về các file tài liệu, mẫu biểu được chia sẻ",
  },
  "resource:manage": {
    label: "Quản lý thư viện tài nguyên",
    group: "Tài liệu & Tài nguyên",
    description: "Tải lên, phân quyền xem và quản lý file tài liệu hệ thống",
  },
  // Tài chính & Ví
  "wallet:read": {
    label: "Xem số dư & lịch sử ví",
    group: "Tài chính & Ví",
    description: "Xem thông tin số dư tài khoản và lịch sử giao dịch nạp/rút",
  },
  "wallet:manage": {
    label: "Quản lý giao dịch ví",
    group: "Tài chính & Ví",
    description: "Thực hiện giao dịch nạp tiền, nạp credit và điều chỉnh số dư ví",
  },
  // Hệ thống & Cấu hình
  "settings:manage": {
    label: "Cấu hình hệ thống & doanh nghiệp",
    group: "Hệ thống & Phân quyền",
    description: "Chỉnh sửa thông tin công ty, tích hợp dịch vụ và cấu hình ERP",
  },
  "role:manage": {
    label: "Quản lý vai trò & phân quyền",
    group: "Hệ thống & Phân quyền",
    description: "Tạo vai trò tùy chỉnh, thiết lập phân quyền chi tiết cho nhân viên",
  },
};

export const DEFAULT_SYSTEM_PERMISSIONS = Object.entries(PERMISSION_TRANSLATIONS)
  .filter(([code]) => code !== "*")
  .map(([code, val]) => ({
    _id: code,
    code,
    name: val.label,
    group: val.group || "Hệ thống",
    description: val.description,
  }));

/**
 * Trả về tên hiển thị tiếng Việt thân thiện người dùng cho mã quyền.
 */
export function getPermissionLabel(code: string, fallbackName?: string): string {
  if (!code) return "";
  if (code === "*") return "Toàn quyền hệ thống";
  const mapped = PERMISSION_TRANSLATIONS[code];
  if (mapped?.label) {
    return mapped.label;
  }
  if (fallbackName && fallbackName !== code) {
    return fallbackName;
  }
  return code
    .replace(/^([a-z]+):([a-z]+)$/i, (_, mod, act) => {
      const actMap: Record<string, string> = { read: "Xem", manage: "Quản lý", post: "Đăng bài" };
      return `${actMap[act] || act} ${mod.toUpperCase()}`;
    });
}

/**
 * Trả về mô tả tiếng Việt dễ hiểu cho mã quyền.
 */
export function getPermissionDescription(code: string, fallbackDesc?: string): string {
  if (!code) return "";
  const mapped = PERMISSION_TRANSLATIONS[code];
  if (mapped?.description) {
    return mapped.description;
  }
  return fallbackDesc || "";
}

/**
 * Trả về tên vai trò tiếng Việt thân thiện người dùng.
 */
export function getRoleDisplayName(role: string, customDisplayName?: string): string {
  if (customDisplayName && customDisplayName !== role) {
    return customDisplayName;
  }
  const roleMap: Record<string, string> = {
    superadmin: "Quản trị viên cấp cao",
    admin: "Quản trị viên doanh nghiệp",
    branch_owner: "Chủ chi nhánh",
    manager: "Quản lý chi nhánh",
    user: "Nhân viên",
    staff: "Nhân viên",
    teacher: "Giáo viên",
    accountant: "Kế toán",
  };
  return roleMap[role?.toLowerCase()] || role || "Nhân viên";
}

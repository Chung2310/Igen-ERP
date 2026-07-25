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
  "timekeeping:read": {
    label: "Xem bảng chấm công",
    group: "Quản lý nhân sự",
    description: "Xem dữ liệu điểm danh, lịch làm việc và bảng chấm công ngày/tháng",
  },
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
  // Quản lý khách hàng (CRM)
  "crm:read": {
    label: "Xem cơ hội bán hàng (CRM)",
    group: "Quản lý khách hàng (CRM)",
    description: "Xem danh sách khách hàng, pipeline và thông tin giao dịch CRM",
  },
  "crm:manage": {
    label: "Quản trị cơ hội bán hàng (CRM)",
    group: "Quản lý khách hàng (CRM)",
    description: "Thêm mới, cập nhật tiến độ, phân công và quản lý thông tin CRM",
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
    superadmin: "Quản trị viên tối cao (Super Admin)",
    admin: "Chủ doanh nghiệp (Admin)",
    manager: "Quản lý (Manager)",
    user: "Nhân viên (User)",
  };
  return roleMap[role?.toLowerCase()] || role || "Nhân viên";
}

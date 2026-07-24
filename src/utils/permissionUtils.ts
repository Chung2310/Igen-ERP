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
  "face:manage": {
    label: "Quản lý chấm công khuôn mặt AI",
    group: "Quản lý nhân sự",
    description: "Cấu hình dữ liệu và nhận diện khuôn mặt chấm công AI",
  },
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
  "stock:read": {
    label: "Xem nhật ký kho",
    group: "Kho & Sản phẩm",
    description: "Xem lịch sử tồn kho và nhật ký nhập xuất hàng hóa",
  },
  "stock:manage": {
    label: "Quản lý xuất nhập kho",
    group: "Kho & Sản phẩm",
    description: "Tạo phiếu nhập kho, xuất kho và điều chỉnh số lượng sản phẩm",
  },
  "marketing:post": {
    label: "Đăng bài & kết nối Mạng xã hội",
    group: "Marketing",
    description: "Soạn thảo bài viết, liên kết kênh Facebook/TikTok và đăng nội dung tự động",
  },
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
  "student:read": {
    label: "Xem danh sách học viên",
    group: "Quản lý đào tạo",
    description: "Xem danh sách học viên, lớp học và kết quả đào tạo",
  },
  "student:manage": {
    label: "Quản lý học viên & đào tạo",
    group: "Quản lý đào tạo",
    description: "Thêm mới học viên, xếp lớp, điểm danh và cấp chứng chỉ",
  },
};

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

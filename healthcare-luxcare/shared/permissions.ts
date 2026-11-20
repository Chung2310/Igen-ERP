import { SUPPLY_V2_PERMISSIONS } from "./supply-inventory";

export interface PermissionCatalogEntry {
  code: string;
  label: string;
  group: string;
  description: string;
  implies?: readonly string[];
  legacyCodes?: readonly string[];
}

const readManage = (
  base: string,
  labels: { read: string; manage: string },
  group: string,
  descriptions: { read: string; manage: string },
): PermissionCatalogEntry[] => [
  { code: `${base}:read`, label: labels.read, group, description: descriptions.read },
  { code: `${base}:manage`, label: labels.manage, group, description: descriptions.manage, implies: [`${base}:read`] },
];

export const PERMISSION_CATALOG: PermissionCatalogEntry[] = [
  {
    code: "dashboard:read",
    label: "Xem tổng quan",
    group: "Tổng quan",
    description: "Xem trang tổng quan doanh nghiệp.",
  },
  ...readManage("user", { read: "Xem người dùng", manage: "Quản lý người dùng" }, "Người dùng", {
    read: "Xem danh sách và thông tin người dùng trong phạm vi được phép.",
    manage: "Tạo, cập nhật và quản lý tài khoản người dùng.",
  }),
  {
    code: "face:manage",
    label: "Quản lý dữ liệu khuôn mặt",
    group: "Người dùng",
    description: "Quản lý dữ liệu nhận diện khuôn mặt phục vụ chấm công.",
  },
  ...readManage("kanban", { read: "Xem công việc Kanban", manage: "Quản lý công việc Kanban" }, "Công việc & Dự án", {
    read: "Xem bảng và thẻ công việc Kanban.",
    manage: "Tạo, cập nhật, phân công và di chuyển công việc Kanban.",
  }),
  ...readManage("project", { read: "Xem dự án", manage: "Quản lý dự án" }, "Công việc & Dự án", {
    read: "Xem danh sách và thông tin dự án.",
    manage: "Tạo, cập nhật và thiết lập dự án.",
  }),
  ...readManage("work", { read: "Xem công việc nhân sự", manage: "Quản lý công việc nhân sự" }, "Công việc & Dự án", {
    read: "Xem dữ liệu công việc và KPI trong module nhân sự.",
    manage: "Quản lý công việc trong module nhân sự.",
  }),
  ...readManage("hr", { read: "Xem nhân sự", manage: "Quản lý hồ sơ nhân sự" }, "Nhân sự", {
    read: "Xem tổng quan và dữ liệu nhân sự.",
    manage: "Quản lý hợp đồng và hồ sơ nhân sự.",
  }),
  ...readManage("contracts", { read: "Xem hợp đồng lao động", manage: "Quản lý hợp đồng lao động" }, "Nhân sự", {
    read: "Xem hợp đồng lao động trong phạm vi được phép.",
    manage: "Tải lên, cập nhật và gia hạn hợp đồng lao động.",
  }),
  ...readManage("credentials", { read: "Xem văn bằng, chứng chỉ", manage: "Quản lý văn bằng, chứng chỉ" }, "Nhân sự", {
    read: "Xem văn bằng, chứng chỉ hành nghề trong phạm vi được phép.",
    manage: "Thêm, cập nhật, xóa và tải bản scan văn bằng, chứng chỉ của nhân viên.",
  }),
  ...readManage("timekeeping", { read: "Xem chấm công", manage: "Quản lý và duyệt chấm công" }, "Nhân sự", {
    read: "Xem lịch làm việc và dữ liệu chấm công.",
    manage: "Duyệt, điều chỉnh và cấu hình dữ liệu chấm công.",
  }),
  {
    code: "leave:approve",
    label: "Duyệt đơn nghỉ phép",
    group: "Nhân sự",
    description: "Phê duyệt hoặc từ chối đơn nghỉ phép.",
  },
  ...readManage("recruitment", { read: "Xem tuyển dụng", manage: "Quản lý tuyển dụng" }, "Nhân sự", {
    read: "Xem tin tuyển dụng, ứng viên và lịch phỏng vấn.",
    manage: "Tạo và cập nhật tin tuyển dụng, ứng viên và lịch phỏng vấn.",
  }),
  { code: "payroll:read", label: "Xem bảng lương", group: "Tiền lương", description: "Xem bảng lương và phiếu lương." },
  {
    code: "payroll:prepare",
    label: "Chuẩn bị dữ liệu lương",
    group: "Tiền lương",
    description: "Tạo kỳ, đồng bộ và khóa dữ liệu chấm công trước khi tính lương.",
    implies: ["payroll:read"],
  },
  {
    code: "payroll:manage",
    label: "Quản lý và tính lương",
    group: "Tiền lương",
    description: "Tính, duyệt và chốt bảng lương.",
    implies: ["payroll:read"],
  },
  {
    code: "payroll:pay",
    label: "Thanh toán bảng lương",
    group: "Tiền lương",
    description: "Xác nhận và hoàn tất thanh toán bảng lương.",
    implies: ["payroll:read"],
  },
  ...readManage("payroll-period", { read: "Xem kỳ lương", manage: "Quản lý kỳ lương" }, "Tiền lương", {
    read: "Xem kỳ lương, kết quả và nhật ký xử lý.",
    manage: "Tạo, xử lý, khóa và điều chỉnh kỳ lương.",
  }),
  ...readManage("payroll-policy", { read: "Xem chính sách lương", manage: "Quản lý chính sách lương" }, "Tiền lương", {
    read: "Xem chính sách và công thức tính lương.",
    manage: "Tạo, cập nhật và kích hoạt chính sách, công thức lương.",
  }),
  ...readManage("payroll-payment", { read: "Xem thanh toán lương", manage: "Quản lý thanh toán lương" }, "Tiền lương", {
    read: "Xem các khoản thanh toán và xuất dữ liệu lương.",
    manage: "Xác nhận, đảo và công bố thanh toán lương.",
  }),
  {
    code: "custom-field:manage",
    label: "Quản lý trường dữ liệu tùy chỉnh",
    group: "Cấu hình dữ liệu",
    description: "Tạo, sửa, lưu trữ và xóa trường dữ liệu tùy chỉnh.",
  },
  {
    code: "company-smtp:manage",
    label: "Cấu hình SMTP doanh nghiệp",
    group: "Cấu hình hệ thống",
    description: "Xem, cập nhật, xác minh và gửi thử bằng SMTP doanh nghiệp.",
  },
  {
    code: "company-payment:manage",
    label: "Cấu hình thanh toán doanh nghiệp",
    group: "Cấu hình hệ thống",
    description: "Cài đặt tài khoản VietQR và cấu hình thanh toán doanh nghiệp.",
  },
  {
    code: "company-email:manage",
    label: "Quản lý email chúc mừng",
    group: "Cấu hình hệ thống",
    description: "Cấu hình mẫu và theo dõi email chúc mừng tự động.",
  },
  ...readManage("access", { read: "Xem cấu hình truy cập", manage: "Quản lý cấu hình truy cập" }, "Cấu hình hệ thống", {
    read: "Xem cấu hình truy cập và nhận diện doanh nghiệp.",
    manage: "Quản lý cấu hình truy cập và nhận diện doanh nghiệp.",
  }),
  {
    code: "role:manage",
    label: "Quản lý vai trò và phân quyền",
    group: "Cấu hình hệ thống",
    description: "Tạo vai trò và cấu hình quyền truy cập.",
  },
  {
    code: "settings:manage",
    label: "Quản lý cài đặt hệ thống",
    group: "Cấu hình hệ thống",
    description: "Cập nhật cài đặt hệ thống và doanh nghiệp.",
  },
  {
    code: "chat:read",
    label: "Xem trò chuyện",
    group: "Trò chuyện",
    description: "Truy cập các phòng trò chuyện được phép.",
  },
  ...readManage("knowledge", { read: "Đọc kho tri thức", manage: "Quản lý kho tri thức" }, "Kho tri thức", {
    read: "Tra cứu và đọc tài liệu trong phạm vi được phép.",
    manage: "Nạp, phân loại và quản lý phạm vi tài liệu tri thức.",
  }),

  ...readManage("resource", { read: "Xem tài nguyên", manage: "Quản lý tài nguyên" }, "Tài nguyên", {
    read: "Xem và tải tài nguyên được chia sẻ.",
    manage: "Tải lên, tổ chức, chia sẻ tài nguyên và kết nối Google Drive.",
  }),
  {
    code: "inventory:read",
    label: "Xem kho tài nguyên",
    group: "Tài nguyên",
    description: "Xem dữ liệu kho và tài nguyên nội bộ.",
  },
  {
    code: "relationship:read",
    label: "Xem quan hệ dữ liệu",
    group: "Tài nguyên",
    description: "Xem quan hệ giữa các nguồn dữ liệu nội bộ.",
  },
  ...readManage("equipment", { read: "Xem thiết bị", manage: "Quản lý thiết bị" }, "Thiết bị", {
    read: "Xem danh sách và tình trạng thiết bị.",
    manage: "Tạo, cập nhật và quản lý thiết bị.",
  }),
  ...readManage("supply", { read: "Xem vật tư", manage: "Quản lý vật tư" }, "Vật tư", {
    read: "Xem danh sách, tồn kho, hạn sử dụng và tài liệu vật tư tiêu hao.",
    manage: "Tạo, cập nhật, xuất/nhập kho và quản lý vật tư tiêu hao.",
  }),
  ...SUPPLY_V2_PERMISSIONS.map(([action, label]) => ({
    code: "supply:" + action,
    label,
    group: "Vật tư",
    description: label + " trong phạm vi kho được phân công.",
    implies: ["supply:read"],
  })),
];

export const PERMISSION_CODES = PERMISSION_CATALOG.map((entry) => entry.code);
const CATALOG_INDEX = new Map(PERMISSION_CODES.map((code, index) => [code, index]));
const CATALOG_BY_CODE = new Map(PERMISSION_CATALOG.map((entry) => [entry.code, entry]));

export interface NormalizePermissionOptions {
  allowWildcard?: boolean;
}

export function normalizePermissions(input: readonly string[] = [], options: NormalizePermissionOptions = {}) {
  if (options.allowWildcard && input.includes("*")) return { permissions: ["*"], unknown: [] };
  const selected = new Set<string>();
  const unknown = new Set<string>();
  for (const rawCode of input) {
    const code = String(rawCode || "").trim();
    const entry = CATALOG_BY_CODE.get(code);
    if (!entry) {
      if (code && code !== "*") unknown.add(code);
      continue;
    }
    selected.add(code);
    for (const implied of entry.implies ?? []) selected.add(implied);
  }
  return {
    permissions: [...selected].sort(
      (left, right) => (CATALOG_INDEX.get(left) ?? Infinity) - (CATALOG_INDEX.get(right) ?? Infinity),
    ),
    unknown: [...unknown].sort(),
  };
}

export function assertValidPermissions(input: readonly string[], options: NormalizePermissionOptions = {}) {
  const result = normalizePermissions(input, options);
  if (result.unknown.length) throw new Error(`Mã quyền không hợp lệ: ${result.unknown.join(", ")}`);
  return result.permissions;
}

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  superadmin: ["*"],
  admin: ["*"],
  branch_owner: [
    "dashboard:read",
    "user:read",
    "user:manage",
    "kanban:read",
    "kanban:manage",
    "hr:read",
    "credentials:read",
    "credentials:manage",
    "timekeeping:read",
    "timekeeping:manage",
    "chat:read",
    "knowledge:read",
    "resource:read",
    "equipment:read",
    "supply:read",
  ],
  manager: [
    "dashboard:read",
    "user:read",
    "user:manage",
    "kanban:read",
    "kanban:manage",
    "project:read",
    "project:manage",
    "hr:read",
    "credentials:read",
    "credentials:manage",
    "timekeeping:read",
    "custom-field:manage",
    "chat:read",
    "knowledge:read",
    "resource:read",
    "equipment:read",
    "supply:read",
  ],
  user: [
    "user:read",
    "kanban:read",
    "kanban:manage",
    "project:read",
    "hr:read",
    "credentials:read",
    "timekeeping:read",
    "chat:read",
    "knowledge:read",
    "resource:read",
    "equipment:read",
    "supply:read",
  ],
  trial_user: [
    "dashboard:read",
    "kanban:read",
    "kanban:manage",
    "project:read",
    "project:manage",
    "work:read",
    "work:manage",
    "hr:read",
    "resource:read",
    "supply:read",
    "supply:manage",
  ],
};

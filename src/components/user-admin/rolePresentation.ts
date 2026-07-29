const SYSTEM_ROLE_TITLES: Record<string, string> = {
  superadmin: "Quản trị viên cấp cao",
  admin: "Quản trị viên doanh nghiệp",
  branch_owner: "Chủ chi nhánh",
  manager: "Quản lý chi nhánh",
  user: "Nhân viên",
  staff: "Nhân viên",
  teacher: "Giáo viên",
  accountant: "Kế toán",
};

const GROUP_ORDER = [
  "Học viên & Lao động",
  "Đào tạo",
  "Tài chính học viên",
  "Nội dung & Liên lạc",
  "Cấu hình dữ liệu",
  "Cấu hình hệ thống",
];

export function getRoleTitle(role: string, customTitle?: string) {
  if (customTitle?.trim() && customTitle !== role) return customTitle.trim();
  return SYSTEM_ROLE_TITLES[role?.toLowerCase()] || role || "Nhân viên";
}

export function sortPermissionsForRoleEditor<T extends { code: string; group?: string }>(permissions: readonly T[]) {
  return [...permissions].sort((left, right) => {
    const leftGroup = GROUP_ORDER.indexOf(left.group || "");
    const rightGroup = GROUP_ORDER.indexOf(right.group || "");
    const normalizedLeftGroup = leftGroup < 0 ? GROUP_ORDER.length : leftGroup;
    const normalizedRightGroup = rightGroup < 0 ? GROUP_ORDER.length : rightGroup;
    if (normalizedLeftGroup !== normalizedRightGroup) return normalizedLeftGroup - normalizedRightGroup;
    const leftBase = left.code.replace(/:(read|manage)$/, "");
    const rightBase = right.code.replace(/:(read|manage)$/, "");
    if (leftBase !== rightBase) return leftBase.localeCompare(rightBase);
    return left.code.endsWith(":read") ? -1 : right.code.endsWith(":read") ? 1 : left.code.localeCompare(right.code);
  });
}

type InstructorRosterUser = {
  uid: string;
  displayName?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Quản trị viên",
  manager: "Quản lý",
  branch_owner: "Chủ chi nhánh",
  user: "Nhân viên",
  teacher: "Giảng viên",
};

export function buildInstructorOptions(users: InstructorRosterUser[]) {
  return users
    .filter((user) => user.isActive !== false)
    .map((user) => ({
      value: user.uid,
      label: `${user.displayName || user.email || "Chưa đặt tên"} (${ROLE_LABELS[user.role || ""] || user.role || "Tài khoản"})`,
    }));
}

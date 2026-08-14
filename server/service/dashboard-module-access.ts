interface DashboardModuleUser {
  role: string;
  enabledModules?: string[];
  /** Tập hợp mã quyền hiệu lực của user (xem getEffectivePermissions trong middleware/auth.ts). */
  permissions?: Set<string>;
}

/**
 * Module chỉ được truy vấn khi (a) doanh nghiệp đã bật module đó VÀ
 * (b) role của user có mã quyền `:read` tương ứng (RolePermission). Cả hai
 * điều kiện đều bắt buộc — thiếu bước (b) sẽ khiến API trả về số liệu nhạy
 * cảm cho user không có quyền, dù frontend đã ẩn card tương ứng.
 */
export function resolveDashboardModuleAccess(user: DashboardModuleUser) {
  const hasModule = (key: string) => {
    if (user.role === "superadmin") return true;
    if (!user.enabledModules || user.enabledModules.length === 0) return true;
    return user.enabledModules.includes(key);
  };

  const hasPermission = (code: string) => {
    if (user.role === "superadmin") return true;
    if (!user.permissions) return true;
    return user.permissions.has("*") || user.permissions.has(code);
  };

  return {
    hr: hasModule("hr") && hasPermission("hr:read"),
    student: hasModule("student") && hasPermission("people:read"),
    chat: hasModule("chat") && hasPermission("chat:read"),
    resource: hasModule("resource") && hasPermission("resource:read"),
    inventory: hasModule("inventory") && hasPermission("inventory:read"),
    timekeeping: hasModule("timekeeping") && hasPermission("timekeeping:read"),
  };
}

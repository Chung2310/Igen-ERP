interface DashboardModuleUser {
  role: string;
  enabledModules?: string[];
}

export function resolveDashboardModuleAccess(user: DashboardModuleUser) {
  const hasAccess = (key: string) => {
    if (user.role === "superadmin") return true;
    if (!user.enabledModules || user.enabledModules.length === 0) return true;
    return user.enabledModules.includes(key);
  };

  return {
    hr: hasAccess("hr"),
    student: hasAccess("student"),
    chat: hasAccess("chat"),
    resource: hasAccess("resource"),
  };
}

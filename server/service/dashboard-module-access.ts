import { resolveModuleAccess } from "../middleware/require-module";

interface DashboardModuleUser {
  role: string;
  enabledModules?: string[];
}

export function resolveDashboardModuleAccess(user: DashboardModuleUser) {
  const accessUser = { role: user.role };
  return {
    hr: resolveModuleAccess(accessUser, "hr", user.enabledModules),
    student: resolveModuleAccess(accessUser, "student", user.enabledModules),
    chat: resolveModuleAccess(accessUser, "chat", user.enabledModules),
    resource: resolveModuleAccess(accessUser, "resource", user.enabledModules),
  };
}

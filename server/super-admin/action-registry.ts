import type { AdminActionDefinition } from "./action-types";
const registry = new Map<string, AdminActionDefinition>();
export function registerAdminAction<T>(definition: AdminActionDefinition<T>) { if (registry.has(definition.type)) throw new Error(`Action already registered: ${definition.type}`); registry.set(definition.type, definition as AdminActionDefinition); return definition; }
export function getAdminAction(type: string) { const value = registry.get(type); if (!value) throw new Error(`Unknown admin action: ${type}`); return value; }
export const revokeSessionAction = registerAdminAction({ type: "security.session.revoke", risk: "dangerous", requiresReason: true, requiresStepUp: true, parse: (input: any) => { if (!input?.sessionId) throw new Error("sessionId is required"); return { sessionId: String(input.sessionId) }; } });
const tenantInput = (input: any) => { if (!input?.companyCode && !input?.code) throw new Error("companyCode is required"); return input; };
export const tenantActions = {
  create: registerAdminAction({ type: "tenant.create", risk: "sensitive", requiresReason: false, requiresStepUp: false, parse: tenantInput }),
  update: registerAdminAction({ type: "tenant.update", risk: "sensitive", requiresReason: true, requiresStepUp: true, parse: tenantInput }),
  lifecycle: registerAdminAction({ type: "tenant.lifecycle.transition", risk: "dangerous", requiresReason: true, requiresStepUp: true, parse: tenantInput }),
  scheduleDeletion: registerAdminAction({ type: "tenant.deletion.schedule", risk: "dangerous", requiresReason: true, requiresStepUp: true, parse: tenantInput }),
  cancelDeletion: registerAdminAction({ type: "tenant.deletion.cancel", risk: "dangerous", requiresReason: true, requiresStepUp: true, parse: tenantInput }),
};

const userAccessAction = (type: string, risk: "standard" | "dangerous", requiresStepUp = false) => registerAdminAction({ type, risk, requiresReason: true, requiresStepUp, parse: (input: any) => input || {} });
export const lockUserAction = userAccessAction("user.access.lock", "dangerous", true);
export const unlockUserAction = userAccessAction("user.access.unlock", "standard");
export const resetTwoFactorAction = userAccessAction("security.2fa.reset", "dangerous", true);
export const assignUserRoleAction = userAccessAction("user.access.role.assign", "dangerous", true);
export const startImpersonationAction = userAccessAction("security.impersonation.start", "dangerous", true);
export const stopImpersonationAction = userAccessAction("security.impersonation.stop", "standard");
export const revokeUserSessionsAction = userAccessAction("security.session.revoke.user", "dangerous", true);
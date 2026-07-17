import type { AdminActionDefinition } from "./action-types";
const registry = new Map<string, AdminActionDefinition>();
export function registerAdminAction<T>(definition: AdminActionDefinition<T>) { if (registry.has(definition.type)) throw new Error(`Action already registered: ${definition.type}`); registry.set(definition.type, definition as AdminActionDefinition); return definition; }
export function getAdminAction(type: string) { const value = registry.get(type); if (!value) throw new Error(`Unknown admin action: ${type}`); return value; }
export const revokeSessionAction = registerAdminAction({ type: "security.session.revoke", risk: "dangerous", requiresReason: true, requiresStepUp: true, parse: (input: any) => { if (!input?.sessionId) throw new Error("sessionId is required"); return { sessionId: String(input.sessionId) }; } });

export const RETAIL_OPERATE_PERMISSION = "retail:operate" as const;
export const RETAIL_MANAGER_PERMISSION = "retail:manager" as const;

export type RetailCapability = "operate" | "manager";

type RetailActor = {
  role?: unknown;
  permissions?: readonly string[];
};

export function hasRetailCapability(actor: RetailActor, capability: RetailCapability): boolean {
  const role = String(actor.role || "");
  if (role === "admin" || role === "superadmin") return true;

  const permissions = new Set(actor.permissions || []);
  if (permissions.has("*") || permissions.has(RETAIL_MANAGER_PERMISSION)) return true;
  return capability === "operate" && permissions.has(RETAIL_OPERATE_PERMISSION);
}

export async function hasEffectiveRetailCapability(
  actor: RetailActor & { id?: unknown; companyCode?: unknown },
  capability: RetailCapability,
): Promise<boolean> {
  if (hasRetailCapability(actor, capability)) return true;
  const { getEffectivePermissions } = await import("../../middleware/auth");
  const permissions = await getEffectivePermissions(String(actor.id || ""), String(actor.role || ""), String(actor.companyCode || "") || undefined);
  return hasRetailCapability({ ...actor, permissions: [...permissions] }, capability);
}

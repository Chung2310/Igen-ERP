import { useAuth as useErpAuth } from "../../../src/context/AuthContext";

export { AuthProvider } from "../../../src/context/AuthContext";

const logisticsPermissions = new Set([
  "supply:read", "supply:manage", "supply:cost-read", "supply:document-create",
  "supply:approve", "supply:post", "supply:adjust", "supply:catalog-manage",
  "supply:settings-manage", "supply:reverse", "equipment:read", "equipment:manage",
]);

export function useAuth() {
  const auth = useErpAuth();
  return {
    ...auth,
    hasPermission: (permission: string) => logisticsPermissions.has(permission)
      ? auth.hasPermission(`healthcare-${permission.startsWith("equipment:") ? "equipment" : "supplies"}:${permission === "supply:read" || permission === "equipment:read" ? "read" : "manage"}`)
        || auth.hasPermission(`healthcare:${permission === "supply:read" || permission === "equipment:read" ? "read" : "manage"}`)
      : auth.hasPermission(permission),
  };
}

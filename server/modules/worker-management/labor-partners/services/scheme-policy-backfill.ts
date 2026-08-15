type PolicyLike = {
  _id?: unknown;
  status?: string;
  official?: { enabled?: boolean };
  seasonal?: { enabled?: boolean };
};

type ExistingDefaults = {
  defaultOfficialPolicyId?: unknown;
  defaultSeasonalPolicyId?: unknown;
};

export type SchemePolicyBackfillResult = {
  set: Record<string, unknown>;
  category: "both" | "official" | "seasonal" | "unresolved" | "unchanged";
  reason?: string;
};

/**
 * Resolve only the scheme-specific defaults that can be proven from the
 * legacy default policy. It intentionally never selects another policy.
 */
export function resolveSchemePolicyBackfill(
  policy: PolicyLike | null | undefined,
  existing: ExistingDefaults = {},
): SchemePolicyBackfillResult {
  if (!policy) return { set: {}, category: "unresolved", reason: "policy_not_found" };
  if (policy.status !== "active") return { set: {}, category: "unresolved", reason: "policy_not_active" };

  const official = policy.official?.enabled === true;
  const seasonal = policy.seasonal?.enabled === true;
  if (!official && !seasonal) return { set: {}, category: "unresolved", reason: "policy_has_no_enabled_scheme" };

  const set: Record<string, unknown> = {};
  if (official && !existing.defaultOfficialPolicyId) set.defaultOfficialPolicyId = policy._id;
  if (seasonal && !existing.defaultSeasonalPolicyId) set.defaultSeasonalPolicyId = policy._id;
  if (!Object.keys(set).length) return { set, category: "unchanged" };
  return { set, category: official && seasonal ? "both" : official ? "official" : "seasonal" };
}

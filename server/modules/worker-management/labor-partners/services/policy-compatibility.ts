import type { CommissionScheme } from "../contracts";

export function supportsCommissionScheme(policy: { official?: { enabled?: boolean }; seasonal?: { enabled?: boolean } } | null | undefined, scheme: CommissionScheme) {
  if (!policy) return false;
  return scheme === "official_monthly" ? policy.official?.enabled === true : policy.seasonal?.enabled === true;
}


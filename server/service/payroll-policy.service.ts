import type { IPayrollPolicy, PayrollTaxBracket } from "../interface/payroll-policy.interface";

export type PayrollPolicyFailure = { code: string; message: string; status: number };

const failure = (code: string, message: string, status: number): PayrollPolicyFailure => ({ code, message, status });

const time = (value: Date | string | undefined, fallback: number) => (
  value === undefined ? fallback : new Date(value).getTime()
);

export type PolicyWindow = { effectiveFrom: Date | string; effectiveTo?: Date | string };

export function policyWindowsOverlap(left: PolicyWindow, right: PolicyWindow): boolean {
  const leftStart = time(left.effectiveFrom, 0);
  const leftEnd = time(left.effectiveTo, Number.POSITIVE_INFINITY);
  const rightStart = time(right.effectiveFrom, 0);
  const rightEnd = time(right.effectiveTo, Number.POSITIVE_INFINITY);
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

export function replacementForPolicy(active: PolicyWindow, replacementStart: Date | string): { action: "truncate"; effectiveTo: Date } | { action: "retire" } {
  const nextStart = new Date(replacementStart);
  if (time(active.effectiveFrom, 0) >= nextStart.getTime()) return { action: "retire" };
  return { action: "truncate", effectiveTo: new Date(Date.UTC(nextStart.getUTCFullYear(), nextStart.getUTCMonth(), nextStart.getUTCDate() - 1)) };
}

export function validatePolicyDefinition(policy: Partial<IPayrollPolicy>): PayrollPolicyFailure | null {
  if (policy.effectiveTo && time(policy.effectiveTo, 0) < time(policy.effectiveFrom, 0)) {
    return failure("PAYROLL_POLICY_INVALID_WINDOW", "effectiveTo must be on or after effectiveFrom", 400);
  }
  const brackets = policy.taxBrackets ?? [];
  if (!brackets.length) {
    return failure("PAYROLL_POLICY_BRACKETS_REQUIRED", "A payroll policy needs at least one tax bracket", 400);
  }
  const openEnded = brackets.filter((bracket: PayrollTaxBracket) => bracket.upTo === undefined);
  if (openEnded.length !== 1 || brackets.at(-1)?.upTo !== undefined) {
    return failure("PAYROLL_POLICY_BRACKETS_INVALID", "Tax brackets must end with exactly one open-ended bracket", 400);
  }
  for (let index = 1; index < brackets.length; index += 1) {
    const previous = brackets[index - 1];
    const current = brackets[index];
    if (previous.upTo === undefined || (current.upTo !== undefined && current.upTo <= previous.upTo)) {
      return failure("PAYROLL_POLICY_BRACKETS_INVALID", "Tax brackets must be ordered by ascending upTo", 400);
    }
  }
  return null;
}

/** Activation is refused while another active policy covers any of the same days. */
export function validatePolicyActivation(
  policy: { status: string; effectiveFrom: Date | string; effectiveTo?: Date | string } | null,
  activePolicies: PolicyWindow[],
): PayrollPolicyFailure | null {
  if (!policy) return failure("PAYROLL_POLICY_NOT_FOUND", "Payroll policy not found", 404);
  if (policy.status !== "draft") {
    return failure("PAYROLL_POLICY_INVALID_STATE", `Cannot activate a policy in status ${policy.status}`, 409);
  }
  if (activePolicies.some((active) => policyWindowsOverlap(policy, active))) {
    return failure("PAYROLL_POLICY_OVERLAP", "Another active payroll policy already covers this period", 409);
  }
  return null;
}

/** Picks the active policy covering a date; used when a payroll run is calculated. */
export function selectPolicyForDate<T extends PolicyWindow & { status: string }>(policies: T[], date: string): T | undefined {
  const target = new Date(`${date}T00:00:00.000Z`).getTime();
  return policies
    .filter((policy) => policy.status === "active")
    .filter((policy) => time(policy.effectiveFrom, 0) <= target && target <= time(policy.effectiveTo, Number.POSITIVE_INFINITY))
    .sort((left, right) => time(right.effectiveFrom, 0) - time(left.effectiveFrom, 0))[0];
}

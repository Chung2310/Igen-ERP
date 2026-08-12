export function financeCutoverEnabled(environment: Record<string, string | undefined> = process.env) {
  return String(environment.FINANCE_RECEIVABLE_CUTOVER || "").toLowerCase() === "true";
}

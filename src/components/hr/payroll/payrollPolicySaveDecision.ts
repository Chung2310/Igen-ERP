export function canRecalculateAfterPolicySave(runStatus?: string): boolean {
  return runStatus === undefined || runStatus === "draft";
}

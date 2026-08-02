export function buildPartnerBranchHeaders(
  activeBranchId: string,
): Record<string, string> {
  return activeBranchId ? { "x-branch-id": activeBranchId } : {};
}

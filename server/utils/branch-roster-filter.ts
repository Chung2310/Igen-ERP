export function buildBranchRosterFilter(
  branchId?: string,
  includeUnassigned = false,
): Record<string, unknown> {
  if (!branchId) return {};
  if (!includeUnassigned) return { branchId };

  return {
    $or: [
      { branchId },
      { branchId: { $exists: false } },
      { branchId: null },
      { branchId: "" },
    ],
  };
}

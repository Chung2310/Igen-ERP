export function resolveActiveBranchId(
  branches: ReadonlyArray<{ _id: string }>,
  savedBranchId: string | null,
): string {
  if (savedBranchId && branches.some((branch) => branch._id === savedBranchId)) {
    return savedBranchId;
  }
  return branches[0]?._id || "";
}
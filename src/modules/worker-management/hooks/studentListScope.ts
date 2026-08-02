export type StudentListScope = "branch" | "unassigned";

export function buildStudentListEndpoint(
  scope: StudentListScope,
  ownerFilter?: string,
): string {
  if (scope === "unassigned") return "/students/unassigned";
  return ownerFilter
    ? `/students?ownerFilter=${encodeURIComponent(ownerFilter)}`
    : "/students";
}

export function canUseUnassignedStudentScope(role?: string): boolean {
  return role === "admin";
}

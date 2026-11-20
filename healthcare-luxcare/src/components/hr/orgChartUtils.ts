import { EmployeeNode, UserProfile } from "../../types";

export const getOrgChartBranchId = (
  viewer: Pick<UserProfile, "role" | "branchId"> | null | undefined,
  activeBranchId?: string,
): string | undefined =>
  (viewer?.role === "admin" || viewer?.role === "superadmin" ? activeBranchId : viewer?.branchId) || undefined;

export const scopeOrgChartUsers = (
  users: UserProfile[],
  viewer: Pick<UserProfile, "role" | "branchId"> | null | undefined,
  companyCode: string,
  activeBranchId?: string,
  mainBranchId?: string,
): UserProfile[] => {
  if (!viewer || !companyCode) return [];
  const branchId = getOrgChartBranchId(viewer, activeBranchId);
  // A missing employee assignment / admin selection must not show every branch.
  if (!branchId && viewer.role !== "superadmin") return [];
  return users.filter((user) => {
    const matchesCompany =
      user.companyCode === companyCode || (companyCode === "SYSTEM" && !user.companyCode);
    if (!matchesCompany) return false;
    if (!branchId) return true;
    if (user.branchId === branchId) return true;
    // Fallback: If company admin/CEO has no branchId set yet, include in MAIN branch
    if ((user.role === "admin" || user.level === 1) && !user.branchId) {
      if (!mainBranchId || branchId === mainBranchId) return true;
    }
    return false;
  });
};

const normalizeOrgChartText = (value?: string): string =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const filterOrgChartEmployees = (
  employees: EmployeeNode[],
  searchQuery: string,
  department: string,
): EmployeeNode[] => {
  const query = normalizeOrgChartText(searchQuery);
  return employees.filter((employee) => {
    const matchesSearch =
      !query ||
      [employee.name, employee.role, employee.department].some((value) =>
        normalizeOrgChartText(value).includes(query),
      );
    const matchesDepartment = department === "Tất cả" || employee.department === department;
    return matchesSearch && matchesDepartment;
  });
};

export const getManagerForEmployee = (
  employee: EmployeeNode,
  employees: EmployeeNode[],
  fallbackEmployees?: EmployeeNode[],
): EmployeeNode | undefined => {
  if (!employee.parentId) return undefined;
  return (
    employees.find((candidate) => String(candidate.id) === String(employee.parentId)) ||
    fallbackEmployees?.find((candidate) => String(candidate.id) === String(employee.parentId))
  );
};

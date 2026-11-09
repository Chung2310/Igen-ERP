import { EmployeeNode } from "../../types";

const normalizeOrgChartText = (value?: string): string => String(value || "")
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
    const matchesSearch = !query || [employee.name, employee.role, employee.department, employee.division]
      .some((value) => normalizeOrgChartText(value).includes(query));
    const matchesDepartment = department === "Tất cả" || employee.department === department;
    return matchesSearch && matchesDepartment;
  });
};

export const getManagerForEmployee = (employee: EmployeeNode, employees: EmployeeNode[]): EmployeeNode | undefined => {
  return employee.parentId ? employees.find((candidate) => candidate.id === employee.parentId) : undefined;
};

export const arrangeOrgChartEmployees = (employees: EmployeeNode[], rolesById: Map<string, string>): EmployeeNode[] => {
  const roleLevel: Record<string, number> = { superadmin: 0, admin: 1, branch_owner: 2, manager: 3, user: 4 };
  const list = employees.map(employee => ({ ...employee }));
  const superadmin = list.find(employee => rolesById.get(employee.id) === "superadmin");

  for (const employee of list) {
    const role = rolesById.get(employee.id) ?? "user";
    if (role === "superadmin") {
      employee.parentId = undefined;
      continue;
    }
    if (role === "admin") {
      employee.parentId = superadmin?.id;
      continue;
    }
    if (employee.parentId && list.some(parent => parent.id === employee.parentId)) continue;

    const myLevel = roleLevel[role] ?? roleLevel.user;
    let parent: EmployeeNode | undefined;
    for (let targetLevel = myLevel - 1; targetLevel >= 0; targetLevel--) {
      parent = list.find(candidate => candidate.id !== employee.id && (roleLevel[rolesById.get(candidate.id) ?? "user"] ?? roleLevel.user) === targetLevel);
      if (parent) break;
    }
    employee.parentId = parent?.id;
  }

  return list;
};

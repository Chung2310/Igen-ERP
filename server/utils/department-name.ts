export function normalizeDepartmentName(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0111\u0110]/g, "d")
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^phong(?:\s+ban)?\s+/, "")
    .trim();
}

export function matchesDepartmentName(departmentName: unknown, query: unknown): boolean {
  const normalizedQuery = normalizeDepartmentName(query);
  return Boolean(normalizedQuery) && normalizeDepartmentName(departmentName).includes(normalizedQuery);
}

import { getAccessToken } from "./authService";

export type HrDepartment = { id: string; name: string; employeeCount: number; code?: string; description?: string; managerUid?: string; managerName?: string; sortOrder?: number; isActive?: boolean };
export type HrDepartmentInput = { name: string; code?: string; description?: string; managerUid?: string; sortOrder?: number; isActive?: boolean };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/hr/departments${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${getAccessToken()}`, "Content-Type": "application/json", ...init?.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Không thể xử lý phòng ban.");
  return result.data as T;
}

const query = (companyCode: string) => `?companyCode=${encodeURIComponent(companyCode)}`;

export const hrDepartmentService = {
  list: (companyCode: string) => request<HrDepartment[]>(query(companyCode)),
  create: (companyCode: string, input: HrDepartmentInput) => request<HrDepartment>("/", { method: "POST", body: JSON.stringify({ companyCode, ...input }) }),
  rename: (companyCode: string, id: string, input: HrDepartmentInput) => request<HrDepartment>(`/${encodeURIComponent(id)}${query(companyCode)}`, { method: "PATCH", body: JSON.stringify({ companyCode, ...input }) }),
  remove: (companyCode: string, id: string) => request<{ id: string }>(`/${encodeURIComponent(id)}${query(companyCode)}`, { method: "DELETE" }),
};

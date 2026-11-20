import { browserTransport, type ServiceTransport } from "./serviceTransport";

export interface DepartmentRecord {
  _id: string;
  companyCode: string;
  code: string;
  name: string;
  description?: string;
  managerUid?: string;
  managerName?: string;
  sortOrder: number;
  isActive: boolean;
  employeeCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DepartmentInput {
  code: string;
  name: string;
  description?: string;
  managerUid?: string;
  managerName?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export function createDepartmentService({ fetch, getAccessToken }: ServiceTransport) {
  async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const token = getAccessToken();
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || `Lỗi hệ thống (${res.status})`);
    }
    return body.data;
  }

  return {
    list: (params?: { activeOnly?: boolean; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.activeOnly) q.set("activeOnly", "true");
      if (params?.search) q.set("search", params.search);
      const qs = q.toString();
      return request<DepartmentRecord[]>(`/api/v1/departments${qs ? `?${qs}` : ""}`);
    },

    getById: (id: string) => request<DepartmentRecord>(`/api/v1/departments/${encodeURIComponent(id)}`),

    create: (input: DepartmentInput) =>
      request<DepartmentRecord>("/api/v1/departments", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    update: (id: string, input: Partial<DepartmentInput>) =>
      request<DepartmentRecord>(`/api/v1/departments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),

    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/api/v1/departments/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),

    merge: (sourceDepartmentTexts: string[], targetDepartmentId: string) =>
      request<{ modifiedCount: number; targetDepartment: DepartmentRecord }>("/api/v1/departments/merge", {
        method: "POST",
        body: JSON.stringify({ sourceDepartmentTexts, targetDepartmentId }),
      }),

    getUnmapped: () => request<Array<{ name: string; count: number }>>("/api/v1/departments/unmapped"),
  };
}

export const departmentService = createDepartmentService(browserTransport);

import { browserTransport, type ServiceTransport } from "./serviceTransport";
import { emptyPagination } from "../types/pagination";
import type {
  LeaveApplication,
  LeaveApplicationInput,
  LeaveApplicationPage,
  LeaveBalance,
  LeaveDecision,
  LeaveTemplate,
  LeaveUploadInput,
} from "../types/leave";

/** Extracted from LeaveRequestsTab: identical endpoints for web and native. */
export function createLeaveService({ fetch, getAccessToken }: ServiceTransport) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...init, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const details = data?.errors ? Object.values(data.errors).flat().join("; ") : "";
      throw new Error(
        [data?.error?.message || data?.message || "Không thể xử lý đơn từ.", details].filter(Boolean).join(" "),
      );
    }
    return data as T;
  }
  async function data<T>(path: string, init?: RequestInit): Promise<T> {
    return (await request<{ data: T }>(path, init)).data;
  }
  return {
    listApplications: async (page = 1, limit = 20): Promise<LeaveApplicationPage> => {
      const result = await request<LeaveApplicationPage>(`/api/v1/hr/leave-applications?page=${page}&limit=${limit}`);
      return { ...result, data: result.data || [], pagination: result.pagination || emptyPagination };
    },
    listTemplates: () => data<LeaveTemplate[]>("/api/v1/hr/leave-templates"),
    balance: (employeeId: string, year: number) =>
      data<LeaveBalance>(`/api/v1/leave/balance?employeeId=${encodeURIComponent(employeeId)}&year=${year}`),
    upload: async (input: LeaveUploadInput) => {
      const result = await data<{ url: string; uploadToken: string }>("/api/v1/hr/leave-files/upload", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result?.url || !result.uploadToken) throw new Error("Upload không trả về token quản lý tài nguyên.");
      return result;
    },
    create: (input: LeaveApplicationInput) =>
      data<LeaveApplication>("/api/v1/hr/leave-applications", { method: "POST", body: JSON.stringify(input) }),
    decide: (id: string, input: LeaveDecision) =>
      data<LeaveApplication>(`/api/v1/hr/leave-applications/${encodeURIComponent(id)}/decision`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    remove: (id: string) =>
      data<LeaveApplication>(`/api/v1/hr/leave-applications/${encodeURIComponent(id)}`, { method: "DELETE" }),
    createTemplate: (input: Omit<LeaveTemplate, "_id"> & { uploadToken: string }) =>
      data<LeaveTemplate>("/api/v1/hr/leave-templates", { method: "POST", body: JSON.stringify(input) }),
    removeTemplate: (id: string) =>
      data<LeaveTemplate>(`/api/v1/hr/leave-templates/${encodeURIComponent(id)}`, { method: "DELETE" }),
  };
}
export const leaveService = createLeaveService(browserTransport);

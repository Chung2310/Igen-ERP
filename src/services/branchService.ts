import { getAccessToken } from "./authService";

export interface BranchRecord {
  _id: string;
  companyCode: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  managerId?: string;
  locationConfig?: Record<string, unknown>;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BranchInput {
  code?: string;
  name?: string;
  address?: string;
  phone?: string;
  managerId?: string;
  locationConfig?: Record<string, unknown>;
  isActive?: boolean;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", "Bearer " + (getAccessToken() || ""));
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Không thể cập nhật chi nhánh");
  return data.data as T;
}

export const branchService = {
  list: () => request<BranchRecord[]>("/api/v1/auth/branches"),
  create: (input: Required<Pick<BranchInput, "code" | "name">> & Omit<BranchInput, "code" | "name">) => request<BranchRecord>("/api/v1/auth/branches", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: BranchInput) => request<BranchRecord>("/api/v1/auth/branches/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(input) }),
};
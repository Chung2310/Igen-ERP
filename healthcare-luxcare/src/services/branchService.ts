import { browserTransport, type ServiceTransport } from "./serviceTransport";

export interface BranchRecord {
  _id: string;
  companyCode: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  managerId?: string;
  locationConfig?: BranchAttendanceConfig;
  attendanceLocations?: BranchAttendanceLocation[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BranchAttendanceConfig {
  latitude: number;
  longitude: number;
  allowedRadius: number;
  allowedPublicIps: string[];
}
export interface BranchAttendanceLocation extends BranchAttendanceConfig {
  id: string;
  name: string;
  type: "office" | "business_trip";
  isActive: boolean;
}

export interface BranchInput {
  code?: string;
  name?: string;
  address?: string;
  phone?: string;
  managerId?: string;
  locationConfig?: BranchAttendanceConfig;
  attendanceLocations?: BranchAttendanceLocation[];
  isActive?: boolean;
}

export interface BranchOwnerInput {
  displayName: string;
  email: string;
  password: string;
  phone?: string;
  birthDate?: string;
  qualification?: string;
}

function apiErrorMessage(data: any, fallback: string): string {
  const validationMessage =
    data?.errors && typeof data.errors === "object"
      ? Object.values(data.errors)
          .flatMap((messages) => (Array.isArray(messages) ? messages : []))
          .find((message) => typeof message === "string")
      : undefined;
  return String(validationMessage || data?.error?.message || data?.message || fallback);
}

export function createBranchService({ fetch, getAccessToken }: ServiceTransport) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", "Bearer " + (getAccessToken() || ""));
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...init, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(apiErrorMessage(data, "Không thể cập nhật chi nhánh"));
    return data.data as T;
  }

  return {
    currentIp: () => request<{ ip: string }>("/api/v1/auth/current-ip"),
    list: () => request<BranchRecord[]>("/api/v1/auth/branches"),
    create: (input: Required<Pick<BranchInput, "code" | "name">> & Omit<BranchInput, "code" | "name">) =>
      request<BranchRecord>("/api/v1/auth/branches", { method: "POST", body: JSON.stringify(input) }),
    createOwner: (id: string, input: BranchOwnerInput) =>
      request<{ branch: BranchRecord; owner: { _id: string } }>(
        `/api/v1/auth/branches/${encodeURIComponent(id)}/owner`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    removePending: (id: string) =>
      request<BranchRecord>(`/api/v1/auth/branches/${encodeURIComponent(id)}/pending`, { method: "DELETE" }),
    update: (id: string, input: BranchInput) =>
      request<BranchRecord>("/api/v1/auth/branches/" + encodeURIComponent(id), {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
  };
}
export const branchService = createBranchService(browserTransport);

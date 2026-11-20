import { browserTransport, type ServiceTransport } from "./serviceTransport";
import { parseApiErrorResponse } from "./apiClientError";
import type { UserProfile } from "../types/common";
export type EmployeeProfileInput = Partial<
  Pick<
    UserProfile,
    | "displayName"
    | "phone"
    | "birthDate"
    | "jobTitle"
    | "qualification"
    | "division"
    | "department"
    | "departmentId"
    | "parentId"
    | "level"
    | "isLeader"
    | "jobDescriptionLink"
    | "monthlySalary"
    | "branchId"
    | "companyCode"
    | "companyName"
    | "role"
  >
> & { password?: string };

export type EmployeeCreateInput = EmployeeProfileInput & {
  displayName: string;
  email: string;
  password: string;
  role: UserProfile["role"];
};
export function createRosterService({ fetch, getAccessToken }: ServiceTransport) {
  async function request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...init, headers });
    if (!response.ok) throw await parseApiErrorResponse(response);
    const data = await response.json().catch(() => ({}));
    return data;
  }
  const normalize = (data: (UserProfile & { _id?: string })[]): UserProfile[] =>
    (data || []).map((user) => ({ ...user, uid: user._id || user.uid }));
  return {
    list: async (companyCode?: string, branchId?: string): Promise<UserProfile[]> => {
      const query = new URLSearchParams();
      if (companyCode && companyCode !== "all") query.set("companyCode", companyCode);
      if (branchId) query.set("branchId", branchId);
      return normalize((await request(`/api/v1/auth/users${query.size ? `?${query}` : ""}`)).data);
    },
    colleagues: async (): Promise<UserProfile[]> => normalize((await request("/api/v1/auth/users/colleagues")).data),
    create: async (input: EmployeeCreateInput): Promise<UserProfile> => {
      const data = await request("/api/v1/auth/register-user", { method: "POST", body: JSON.stringify(input) });
      const created = data?.data || data?.user;
      if (!created || !(created._id || created.uid)) throw new Error("Chưa xác nhận hồ sơ nhân sự đã được tạo.");
      return normalize([created])[0];
    },
    update: async (id: string, input: EmployeeProfileInput): Promise<void> => {
      await request(`/api/v1/auth/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
    },
    remove: async (id: string): Promise<void> => {
      await request(`/api/v1/auth/users/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}
export const rosterService = createRosterService(browserTransport);

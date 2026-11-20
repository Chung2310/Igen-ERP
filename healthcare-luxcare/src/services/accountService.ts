import { browserTransport, type ServiceTransport } from "./serviceTransport";
import { parseApiErrorResponse } from "./apiClientError";
import type { UserProfile } from "../types/common";
export function createAccountService({ fetch, getAccessToken }: ServiceTransport) {
  async function request(path: string, method: string, body: unknown) {
    const headers = new Headers({ "Content-Type": "application/json" });
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(path, { method, headers, body: JSON.stringify(body) });
    if (!response.ok) throw await parseApiErrorResponse(response);
    return response;
  }
  return {
    updateProfile: async (input: Record<string, unknown>): Promise<UserProfile> => {
      const response = await request("/api/v1/auth/profile", "PATCH", input);
      const { user } = await response.json();
      if (!user || !(user._id || user.uid)) throw new Error("Hồ sơ trả về không hợp lệ.");
      return { ...user, uid: user._id || user.uid };
    },
    changePassword: async (password: string): Promise<void> => {
      await request("/api/v1/auth/change-password", "POST", { password });
    },
    deleteAccount: async (password: string): Promise<{ deletionStatus: "deleted" | "requested"; dueAt?: string }> => {
      const response = await request("/api/v1/auth/delete-account", "POST", { password });
      return response.json();
    },
  };
}
export const accountService = createAccountService(browserTransport);

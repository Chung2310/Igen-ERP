import { parseApiErrorResponse } from "../../services/apiClientError";

export function healthcareApi(branchId: string) {
  async function request(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    const token = localStorage.getItem("accessToken");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    headers.set("x-branch-id", branchId);
    if (typeof options.body === "string") headers.set("Content-Type", "application/json");
    const response = await fetch(`/api/v1/healthcare${path}`, { ...options, headers, cache: "no-store" });
    if (!response.ok) throw await parseApiErrorResponse(response);
    return response;
  }
  return {
    json: async <T,>(path: string, options?: RequestInit): Promise<T> => (await request(path, options)).json(),
    blob: async (path: string) => (await request(path)).blob(),
  };
}

export type HealthcareApi = ReturnType<typeof healthcareApi>;

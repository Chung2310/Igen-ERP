import { parseApiErrorResponse } from "../../services/apiClientError";
import type { GymEntity, GymList, GymRecord } from "../../../shared/gym/types";
export function gymApi(branchId: string) {
  async function request<T>(
    path: string,
    method = "GET",
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    const headers = new Headers({ "x-branch-id": branchId });
    const token = localStorage.getItem("accessToken");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (body && !(body instanceof FormData))
      headers.set("Content-Type", "application/json");
    const response = await fetch(`/api/v1/gym${path}`, {
      method,
      headers,
      body:
        body instanceof FormData
          ? body
          : body === undefined
            ? undefined
            : JSON.stringify(body),
      signal,
      cache: "no-store",
    });
    if (!response.ok) throw await parseApiErrorResponse(response);
    return response.json();
  }
  return {
    request,
    list: (entity: GymEntity, query = "", signal?: AbortSignal) =>
      request<GymList>(`/${entity}?${query}`, "GET", undefined, signal),
    save: (
      entity: GymEntity,
      value: Record<string, unknown>,
      record?: GymRecord,
    ) =>
      request<GymRecord>(
        `/${entity}${record ? `/${record._id}` : ""}`,
        record ? "PATCH" : "POST",
        { ...value, ...(record ? { revision: record.revision } : {}) },
      ),
    remove: (entity: GymEntity, record: GymRecord) =>
      request(`/${entity}/${record._id}`, "DELETE", {
        revision: record.revision,
      }),
  };
}
export type GymApi = ReturnType<typeof gymApi>;

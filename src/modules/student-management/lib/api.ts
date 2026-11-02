import { ApiClientError, parseApiErrorResponse } from "../../../services/apiClientError";
import { refreshAccessToken } from '../../../services/sessionRefresh';

export type BusinessApiScope = "student" | "worker";
let businessApiScope: BusinessApiScope = "student";

export function setBusinessApiScope(scope: BusinessApiScope) {
  businessApiScope = scope;
}

export function getBusinessApiScope(): BusinessApiScope { return businessApiScope; }

function resolveBusinessEndpoint(endpoint: string) {
  if (businessApiScope !== "worker" || endpoint.startsWith("/auth/")) return endpoint;
  let mapped = endpoint;
  if (endpoint.startsWith("/batches")) {
    mapped = endpoint.replace("/batches", "/projects");
  } else if (endpoint.startsWith("/attendance/worker")) {
    mapped = endpoint.replace("/attendance/worker", "/attendance");
  }
  return `/worker-management${mapped}`;
}
export function setAccessToken(token: string | null) {
  if (token) {
    localStorage.setItem("accessToken", token);
  } else {
    localStorage.removeItem("accessToken");
  }
}

export function getAccessToken() {
  return localStorage.getItem("accessToken");
}

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | null | undefined>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiFetch<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const resolvedEndpoint = resolveBusinessEndpoint(endpoint);
  const url = new URL(`/api/v1${resolvedEndpoint}`, window.location.origin);

  if (options.params) {
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        url.searchParams.append(key, String(val));
      }
    });
  }

  const headers = new Headers(options.headers || {});
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers,
  });

  if (response.status === 401 && endpoint !== "/auth/refresh-token" && endpoint !== "/auth/login") {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      headers.set("Authorization", `Bearer ${newAccessToken}`);
      const retryRes = await fetch(url.toString(), { ...options, headers });
      if (!retryRes.ok) throw await parseApiErrorResponse(retryRes);
      return await retryRes.json() as T;
    }

    setAccessToken(null);
    window.dispatchEvent(new Event("unauthorized"));
    throw new ApiClientError({ status: 401, code: "AUTH_SESSION_EXPIRED", message: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại." });
  }

  if (!response.ok) {
    throw await parseApiErrorResponse(response);
  }

  return await response.json() as T;
}

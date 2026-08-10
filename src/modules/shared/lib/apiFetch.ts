import { ApiClientError, parseApiErrorResponse } from "../../../services/apiClientError";

export function getAccessToken() { return localStorage.getItem("accessToken"); }
export function setAccessToken(token: string | null) {
  if (token) localStorage.setItem("accessToken", token);
  else localStorage.removeItem("accessToken");
}

export type ApiFetchOptions = RequestInit & { params?: Record<string, string | number | boolean | null | undefined> };

export async function apiFetch<T>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const url = new URL(`/api/v1${endpoint}`, window.location.origin);
  Object.entries(options.params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.append(key, String(value));
  });
  const headers = new Headers(options.headers || {});
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const send = () => fetch(url.toString(), { ...options, headers });
  let response = await send();
  if (response.status === 401 && endpoint !== "/auth/refresh-token" && endpoint !== "/auth/login") {
    try {
      const refresh = await fetch("/api/v1/auth/refresh-token", { method: "POST" });
      if (refresh.ok) {
        const body = await refresh.json() as { accessToken?: string; data?: { accessToken?: string } };
        const refreshedToken = body.accessToken || body.data?.accessToken;
        if (refreshedToken) {
          setAccessToken(refreshedToken);
          headers.set("Authorization", `Bearer ${refreshedToken}`);
          response = await send();
        }
      }
    } catch (error) { console.error("Lỗi tự động làm mới token:", error); }
    if (response.status === 401) {
      setAccessToken(null);
      window.dispatchEvent(new Event("unauthorized"));
      throw new ApiClientError({ status: 401, code: "AUTH_SESSION_EXPIRED", message: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại." });
    }
  }
  if (!response.ok) throw await parseApiErrorResponse(response);
  return await response.json() as T;
}

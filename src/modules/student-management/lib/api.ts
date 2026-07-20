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

interface ApiErrorResponse {
  error?: string;
  message?: string;
}

interface RefreshTokenResponse {
  success: boolean;
  data?: {
    accessToken?: string;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiFetch<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const url = new URL(`/api/v1${endpoint}`, window.location.origin);

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
    try {
      const refreshRes = await fetch("/api/v1/auth/refresh-token", { method: "POST" });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json() as RefreshTokenResponse;
        if (refreshData.success && refreshData.data?.accessToken) {
          setAccessToken(refreshData.data.accessToken);

          headers.set("Authorization", `Bearer ${getAccessToken()}`);
          const retryRes = await fetch(url.toString(), { ...options, headers });
          if (!retryRes.ok) {
            const errData = await retryRes.json() as ApiErrorResponse;
            throw new Error(errData.error || errData.message || "Yêu cầu thử lại thất bại.");
          }
          return await retryRes.json() as T;
        }
      }
    } catch (refreshErr) {
      console.error("Lỗi tự động làm mới token:", refreshErr);
    }

    setAccessToken(null);
    window.dispatchEvent(new Event("unauthorized"));
    throw new Error("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.");
  }

  const data = await response.json() as T | ApiErrorResponse;
  if (!response.ok) {
    const errorPayload = typeof data === 'object' && data !== null ? data as ApiErrorResponse : undefined;
    throw new Error(errorPayload?.error || errorPayload?.message || "Yêu cầu thất bại.");
  }

  return data as T;
}

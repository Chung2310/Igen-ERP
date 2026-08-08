const originalFetch = window.fetch;
let isRefreshing = false;
// null token = refresh thất bại: bên chờ phải tự giải phóng thay vì treo mãi.
let refreshSubscribers: ((token: string | null) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string | null) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string | null) {
  const subscribers = refreshSubscribers;
  refreshSubscribers = [];
  subscribers.forEach((cb) => cb(token));
}

function withAuthHeader(init: RequestInit | undefined, token: string): RequestInit {
  const newInit: RequestInit = { ...init };
  const headers = new Headers(newInit.headers || undefined);
  headers.set("Authorization", `Bearer ${token}`);
  newInit.headers = headers;
  return newInit;
}

window.fetch = async function (input, init) {
  // 1. Perform the original request
  let response = await originalFetch(input, init);

  // 2. Check if the response indicates unauthorized/token expired (401)
  if (response.status === 401) {
    const urlString = typeof input === "string" ? input : (input as Request).url;

    // Avoid infinite loop if the refresh-token or login/register endpoint itself fails with 401
    if (
      urlString.includes("/auth/refresh-token") ||
      urlString.includes("/auth/login") ||
      urlString.includes("/auth/register") ||
      urlString.includes("/super-admin/auth/")
    ) {
      return response;
    }

    // If already refreshing, wait for it to complete and retry with the new token
    if (isRefreshing) {
      return new Promise((resolve) => {
        subscribeTokenRefresh((newToken) => {
          // Refresh hỏng: trả lại chính response 401 để phía gọi xử lý lỗi bình thường,
          // thay vì để promise treo vô thời hạn.
          if (!newToken) return resolve(response);
          resolve(originalFetch(input, withAuthHeader(init, newToken)));
        });
      });
    }

    isRefreshing = true;

    try {
      // Call refresh token API (refresh token is sent as HttpOnly cookie automatically)
      const refreshRes = await originalFetch("/api/v1/auth/refresh-token", {
        method: "POST",
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const newToken = refreshData.accessToken;

        if (newToken) {
          localStorage.setItem("accessToken", newToken);

          // Notify all pending subscribers
          onRefreshed(newToken);
          isRefreshing = false;

          // Retry the original request with the new token
          return originalFetch(input, withAuthHeader(init, newToken));
        }
      }

      // Refresh token failed or is invalid/expired. Force logout by clearing token and reloading.
      localStorage.removeItem("accessToken");
      window.location.reload();
    } catch (err) {
      console.error("Lỗi tự động làm mới token:", err);
    } finally {
      isRefreshing = false;
      // Giải phóng mọi request đang xếp hàng ở cả nhánh lỗi lẫn nhánh ngoại lệ.
      // Không có tác dụng nếu refresh đã thành công vì hàng đợi khi đó đã rỗng.
      onRefreshed(null);
    }
  }

  return response;
};

async function request(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem("accessToken");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (init.headers) {
    const initHeaders = init.headers as Record<string, string>;
    Object.keys(initHeaders).forEach((key) => {
      headers[key] = initHeaders[key];
    });
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Yêu cầu thất bại");
  return data;
}

export const superAdminDashboardService = {
  getSummary: (startDate?: string, endDate?: string) => {
    let url = "/api/v1/super-admin/dashboard/summary";
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    return request(url, { method: "GET" }).then((r) => r.data);
  },
};

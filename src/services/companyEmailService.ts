import { getAccessToken } from "./authService";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/company-email${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}`, ...(init?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Không thể xử lý yêu cầu email.");
  return body.data ?? body;
}

export const companyEmailApi = {
  getSmtp: () => request<any>("/smtp"),
  saveSmtp: (data: any) => {
    const { host, port, secure, user, password, fromEmail, fromName } = data;
    return request<any>("/smtp", { method: "PUT", body: JSON.stringify({ host, port, secure, user, password, fromEmail, fromName }) });
  },
  verifySmtp: () => request<any>("/smtp/verify", { method: "POST" }),
  testSmtp: () => request<any>("/smtp/test", { method: "POST" }),
  getCelebration: () => request<any>("/celebration"),
  saveCelebration: (data: any) => request<any>("/celebration", { method: "PUT", body: JSON.stringify(data) }),
  preview: (data: any) => request<any>("/celebration/preview", { method: "POST", body: JSON.stringify(data) }),
  history: () => request<any[]>("/celebration/history"),
};

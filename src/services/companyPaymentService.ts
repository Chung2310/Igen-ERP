import { getAccessToken } from "./authService";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/company-payment${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAccessToken()}`,
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Không thể xử lý yêu cầu thanh toán doanh nghiệp.");
  return body.data ?? body;
}

export interface VietqrConfig {
  bankId: string;
  accountNo: string;
  accountName: string;
}

export const companyPaymentApi = {
  getVietqr: () => request<VietqrConfig>("/vietqr"),
  saveVietqr: (data: VietqrConfig) =>
    request<VietqrConfig>("/vietqr", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

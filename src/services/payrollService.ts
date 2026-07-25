import { getAccessToken } from "./authService";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`/api/v1/payroll${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}`, ...(init?.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || "Payroll request failed");
  return body.data ?? body;
}

export const payrollService = {
  getRun: (periodKey: string) => request(`/periods/${periodKey}/run`),
  getResults: (periodKey: string) => request(`/periods/${periodKey}/results`),
  snapshot: (periodKey: string) => request(`/periods/${periodKey}/snapshot`, { method: "POST" }),
  lock: (periodKey: string) => request(`/periods/${periodKey}/lock`, { method: "POST" }),
  createRun: (periodKey: string) => request(`/periods/${periodKey}/run`, { method: "POST" }),
  approve: (periodKey: string) => request(`/periods/${periodKey}/approve`, { method: "POST" }),
  close: (periodKey: string) => request(`/periods/${periodKey}/close`, { method: "POST" }),
};

import { superAdminRequest as request } from "./superAdminRequest";
function accept(data: any) { if (data.accessToken) localStorage.setItem("accessToken", data.accessToken); return data; }

export interface SuperAdminSession {
  sessionId: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt?: string;
  revokeReason?: string;
  deviceId: string;
  loginIp?: string;
  lastIp?: string;
  userAgent?: string;
}

export const superAdminAuthService = {
  login: (email: string, password: string) => request("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }).then(accept),
  startEnrollment: (challengeId: string): Promise<{ qrDataUrl: string; manualEntryKey: string }> => request("/api/v1/super-admin/auth/enrollment/start", { method: "POST", body: JSON.stringify({ challengeId }) }),
  confirmEnrollment: (challengeId: string, token: string) => request("/api/v1/super-admin/auth/enrollment/confirm", { method: "POST", body: JSON.stringify({ challengeId, token }) }).then(accept),
  verifyTotp: (challengeId: string, token: string) => request("/api/v1/super-admin/auth/totp/verify", { method: "POST", body: JSON.stringify({ challengeId, token }) }).then(accept),
  verifyRecovery: (challengeId: string, code: string) => request("/api/v1/super-admin/auth/recovery/verify", { method: "POST", body: JSON.stringify({ challengeId, code }) }).then(accept),
  environment: () => request("/api/v1/super-admin/environment", { method: "GET", headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` } }),
  listSessions: (): Promise<{ sessions: SuperAdminSession[] }> => request("/api/v1/super-admin/auth/sessions"),
  revokeSession: (sessionId: string) => request(`/api/v1/super-admin/auth/sessions/${sessionId}`, { method: "DELETE" }),
};

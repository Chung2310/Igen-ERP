async function request(path: string, init: RequestInit) { const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init.headers || {}) } }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.message || "Yêu cầu thất bại"); return data; }
function accept(data: any) { if (data.accessToken) localStorage.setItem("accessToken", data.accessToken); return data; }
export const superAdminAuthService = {
  login: (email: string, password: string) => request("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  startEnrollment: (challengeId: string) => request("/api/v1/super-admin/auth/enrollment/start", { method: "POST", body: JSON.stringify({ challengeId }) }),
  confirmEnrollment: (challengeId: string, token: string) => request("/api/v1/super-admin/auth/enrollment/confirm", { method: "POST", body: JSON.stringify({ challengeId, token }) }).then(accept),
  verifyTotp: (challengeId: string, token: string) => request("/api/v1/super-admin/auth/totp/verify", { method: "POST", body: JSON.stringify({ challengeId, token }) }).then(accept),
  verifyRecovery: (challengeId: string, code: string) => request("/api/v1/super-admin/auth/recovery/verify", { method: "POST", body: JSON.stringify({ challengeId, code }) }).then(accept),
  environment: () => request("/api/v1/super-admin/environment", { method: "GET", headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` } }),
};

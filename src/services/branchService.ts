import { getAccessToken } from "./authService";
import { wasTokenRefreshed } from "./sessionRefresh";
import { withRequestTimeout } from "../utils/requestTimeout";

export interface BranchRecord {
  _id: string;
  companyCode: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  managerId?: string;
  locationConfig?: BranchAttendanceConfig;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BranchAttendanceConfig { latitude: number; longitude: number; allowedRadius: number; allowedPublicIps: string[]; }

export interface BranchInput {
  code?: string;
  name?: string;
  address?: string;
  phone?: string;
  managerId?: string;
  locationConfig?: BranchAttendanceConfig;
  isActive?: boolean;
}

export interface BranchOwnerInput { displayName: string; email: string; password: string; phone?: string; birthDate?: string; qualification?: string; }

const BRANCH_LIST_PATH = "/api/v1/auth/branches";
const BRANCH_LIST_ERROR = "Không thể tải danh sách chi nhánh. Vui lòng thử lại.";
const BRANCH_LIST_TIMEOUT = "Tải chi nhánh quá lâu. Vui lòng thử lại.";
const BRANCH_LIST_TIMEOUT_MS = 15000;
const RETRY_DELAYS_MS = [500, 1500];
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

class BranchRequestError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfterMs?: number) {
    super(message);
  }
}

function retryAfterMs(value: string | null): number | undefined {
  if (!value?.trim()) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds >= 0 ? seconds * 1000 : undefined;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

function waitForRetry(delay: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, delay);
    signal.addEventListener("abort", abort, { once: true });
  });
}

async function request<T>(path: string, init: RequestInit = {}, fallback = "Không thể cập nhật chi nhánh"): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", "Bearer " + (getAccessToken() || ""));
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = [data?.error?.message, data?.message].find((value) => typeof value === "string" && value.trim());
    const throttled = response.status === 429 ? "Hệ thống đang nhận nhiều yêu cầu. Vui lòng thử lại sau." : fallback;
    console.warn("[branchService] Request failed", {
      path,
      method: init.method || "GET",
      status: response.status,
      code: data?.error?.code || data?.code,
      requestId: response.headers.get("x-request-id") || data?.error?.requestId,
      cfRay: response.headers.get("cf-ray"),
      timestamp: new Date().toISOString(),
    });
    throw new BranchRequestError(message || throttled, response.status, retryAfterMs(response.headers.get("retry-after")));
  }
  return data?.data as T;
}

async function listBranches(signal?: AbortSignal): Promise<BranchRecord[]> {
  const deadline = Date.now() + BRANCH_LIST_TIMEOUT_MS;
  let sessionToken = getAccessToken();
  const assertCurrentSession = () => {
    const current = getAccessToken();
    if (current !== sessionToken && (!current || !wasTokenRefreshed(sessionToken, current))) {
      throw new Error("Phiên đăng nhập đã thay đổi. Hãy thử lại.");
    }
    sessionToken = current;
  };

  return withRequestTimeout(async (requestSignal) => {
    for (let attempt = 0; ; attempt++) {
      requestSignal.throwIfAborted();
      assertCurrentSession();
      try {
        const branches = await request<BranchRecord[]>(BRANCH_LIST_PATH, { signal: requestSignal }, BRANCH_LIST_ERROR);
        requestSignal.throwIfAborted();
        assertCurrentSession();
        if (!Array.isArray(branches)) throw new Error(BRANCH_LIST_ERROR);
        return branches;
      } catch (cause) {
        requestSignal.throwIfAborted();
        assertCurrentSession();
        const retryable = cause instanceof BranchRequestError ? RETRYABLE_STATUSES.has(cause.status) : cause instanceof TypeError;
        if (!retryable || attempt >= RETRY_DELAYS_MS.length) {
          if (cause instanceof TypeError) throw new Error("Không thể kết nối để tải chi nhánh. Kiểm tra kết nối và thử lại.");
          throw cause;
        }
        const delay = Math.max(RETRY_DELAYS_MS[attempt], cause instanceof BranchRequestError ? cause.retryAfterMs || 0 : 0);
        // Keep Retry-After intact; a longer server cooldown must be retried manually.
        if (Date.now() + delay >= deadline) throw cause;
        await waitForRetry(delay, requestSignal);
      }
    }
  }, BRANCH_LIST_TIMEOUT_MS, BRANCH_LIST_TIMEOUT, signal);
}

export const branchService = {
  currentIp: () => request<{ ip: string }>("/api/v1/auth/current-ip"),
  list: listBranches,
  create: (input: Required<Pick<BranchInput, "code" | "name">> & Omit<BranchInput, "code" | "name">) => request<BranchRecord>("/api/v1/auth/branches", { method: "POST", body: JSON.stringify(input) }),
  createOwner: (id: string, input: BranchOwnerInput) => request<{ branch: BranchRecord; owner: { _id: string } }>(`/api/v1/auth/branches/${encodeURIComponent(id)}/owner`, { method: "POST", body: JSON.stringify(input) }),
  removePending: (id: string) => request<BranchRecord>(`/api/v1/auth/branches/${encodeURIComponent(id)}/pending`, { method: "DELETE" }),
  update: (id: string, input: BranchInput) => request<BranchRecord>("/api/v1/auth/branches/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(input) }),
};

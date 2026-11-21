import { API_BASE_URL } from '../config';
import type { ApiErrorBody, ApiResult } from '../types';
import { clearSession } from './session';
export const INSUFFICIENT_CREDITS_EVENT = '3s:insufficient-credits';

export class ApiError extends Error {
  errors: Array<{ field: string; message: string }>;
  status: number;
  code: string;
  requestId: string;
  constructor(message: string, status: number, code = 'UNKNOWN_ERROR', requestId = '', errors: Array<{ field: string; message: string }> = []) {
    super(message); this.name = 'ApiError'; this.errors = errors; this.status = status; this.code = code; this.requestId = requestId;
  }
}
export interface RequestOptions extends RequestInit {
  retries?: number;
  retryDelayMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }

async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { retries = 0, retryDelayMs = 1500, ...fetchOptions } = options;
  const token = localStorage.getItem('accessToken') || localStorage.getItem('gym:token');
  let lastError: unknown;
  let consentVersion: string | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const send = () => fetch(`${API_BASE_URL}${path}`, {
        ...fetchOptions,
        headers: {
          ...(fetchOptions.body && !(fetchOptions.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...fetchOptions.headers,
          ...(consentVersion ? { 'X-AI-Consent': consentVersion } : {}),
        },
      });
      let response = await send();
      if (response.status === 428 && !consentVersion) {
        const disclosure = await response.json();
        if (disclosure.code !== 'AI_CONSENT_REQUIRED' || typeof disclosure.consentVersion !== 'string' || !window.confirm(`${disclosure.message}\n\nChính sách: https://3s.igentechnology.net/privacy-policy`)) {
          throw new ApiError('Đã hủy chia sẻ dữ liệu với AI.', 428, 'AI_CONSENT_DECLINED');
        }
        if ((localStorage.getItem('accessToken') || localStorage.getItem('gym:token')) !== token) throw new ApiError('Phiên đăng nhập đã thay đổi. Vui lòng thực hiện lại.', 409);
        consentVersion = disclosure.consentVersion;
        response = await send();
      }
      const rawPayload: unknown = await response.json().catch(() => ({ success: false, message: 'Phản hồi từ máy chủ không hợp lệ.' }));
      const payload = isRecord(rawPayload) ? rawPayload : {};
      if (!response.ok || payload.success === false) {
        const errorBody = payload as ApiErrorBody;
        if (response.status === 401) clearSession();
        const error = new ApiError(errorBody.message || 'Không thể thực hiện yêu cầu.', response.status, errorBody.code, errorBody.requestId, errorBody.errors || []);
        if (typeof window !== 'undefined' && error.code === 'INSUFFICIENT_CREDITS') {
          window.dispatchEvent(new CustomEvent(INSUFFICIENT_CREDITS_EVENT, { detail: { message: error.message } }));
        }

        const isRetryable = [408, 502, 503, 504].includes(response.status);
        if (attempt < retries && isRetryable) {
          console.warn(`[api] Request to ${path} returned status ${response.status}. Retrying (attempt ${attempt + 1}/${retries})...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
          continue;
        }

        throw error;
      }
      if (!('data' in payload)) throw new ApiError('Phản hồi từ máy chủ không hợp lệ.', response.status);
      return { data: payload.data as T, meta: payload.meta as ApiResult<T>['meta'], message: typeof payload.message === 'string' ? payload.message : '', ...('summary' in payload ? { summary: payload.summary } : {}) };
    } catch (err) {
      lastError = err;
      if (err instanceof ApiError && ![408, 502, 503, 504].includes(err.status)) {
        throw err;
      }
      if (attempt < retries) {
        console.warn(`[api] Network or retryable error for ${path}:`, err, `Retrying (attempt ${attempt + 1}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export const api = {
  get: <T = unknown>(path: string, options: RequestOptions = {}) => request<T>(path, options),
  post: <T = unknown>(path: string, body: unknown, options: RequestOptions = {}) =>
    request<T>(path, { ...options, method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
  patch: <T = unknown>(path: string, body: unknown = {}, options: RequestOptions = {}) =>
    request<T>(path, { ...options, method: 'PATCH', body: body instanceof FormData ? body : JSON.stringify(body) }),
  delete: <T = unknown>(path: string, options: RequestOptions = {}) => request<T>(path, { ...options, method: 'DELETE' }),
  upload: <T = unknown>(path: string, formData: FormData, options: RequestOptions = {}) => request<T>(path, { ...options, method: 'POST', body: formData }),
  uploadPatch: <T = unknown>(path: string, formData: FormData, options: RequestOptions = {}) => request<T>(path, { ...options, method: 'PATCH', body: formData }),
};

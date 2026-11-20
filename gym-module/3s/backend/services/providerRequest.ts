import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';

function providerError(status: number, cause?: unknown): AppError {
  if (status === 402) {
    return new AppError({
      status: 503,
      code: ERROR_CODES.UNAVAILABLE,
      message: 'Hệ thống gặp sự cố. Vui lòng liên hệ quản trị viên để được hỗ trợ',
      cause,
    });
  }
  if (status === 429 || status === 503) {
    return new AppError({ status: 503, code: ERROR_CODES.UNAVAILABLE, message: 'Dịch vụ bên ngoài tạm thời không khả dụng.', cause });
  }
  return new AppError({ status: 502, code: ERROR_CODES.EXTERNAL, message: 'Dịch vụ bên ngoài không phản hồi hợp lệ.', cause });
}

export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const onAbort = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error('PROVIDER_TIMEOUT')), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw providerError(response.status);
    return response;
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    throw providerError(502, cause);
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', onAbort);
  }
}

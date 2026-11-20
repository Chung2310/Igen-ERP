import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { logger } from '../config/logger.js';

export class OpenRouterRequestError extends AppError {
  constructor(
    public readonly upstreamStatus: number | undefined,
    public readonly retryable: boolean,
    public readonly requestId: string | null,
    public readonly retryAfterMs = 0,
    cause?: unknown,
  ) {
    super({
      status: upstreamStatus === 402 ? 503 : 502,
      code: upstreamStatus === 402 ? ERROR_CODES.UNAVAILABLE : ERROR_CODES.EXTERNAL,
      message: upstreamStatus === 402
        ? 'Hệ thống gặp sự cố. Vui lòng liên hệ quản trị viên để được hỗ trợ'
        : 'Dịch vụ AI tạm thời không phản hồi hợp lệ. Vui lòng thử lại.',
      cause,
    });
  }
}

// Kept separate from payment requests: only AI generation is retried here.
export async function requestOpenRouter<T>(
  url: string, init: RequestInit, timeoutMs: number, maxAttempts = 3,
): Promise<{ response: Response; data: T }> {
  for (let attempt = 1; ; attempt++) {
    const controller = new AbortController();
    const onAbort = () => controller.abort(init.signal?.reason);
    if (init.signal?.aborted) onAbort();
    else init.signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error('PROVIDER_TIMEOUT')), timeoutMs);
    let response: Response | undefined;
    let failure: OpenRouterRequestError;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
      // The deadline covers the body too; OpenRouter can send headers before generation finishes.
      const raw = await response.text();
      let data: any;
      try { data = JSON.parse(raw); } catch (cause) {
        if (response.ok) throw cause;
      }
      if (!response.ok || data?.error) {
        const embeddedStatus = Number(data?.error?.code);
        const status = !response.ok ? response.status : embeddedStatus >= 400 ? embeddedStatus : 502;
        const retryAfter = response.headers.get('retry-after');
        const delay = retryAfter === null ? 0 : /^\d+(\.\d+)?$/.test(retryAfter)
          ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now();
        throw new OpenRouterRequestError(
          status, [408, 429, 500, 502, 503, 504].includes(status),
          response.headers.get('x-request-id'),
          Number.isFinite(delay) ? Math.max(0, delay) : 0,
        );
      }
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('INVALID_PROVIDER_RESPONSE');
      }
      return { response, data: data as T };
    } catch (cause) {
      failure = cause instanceof OpenRouterRequestError ? cause : new OpenRouterRequestError(
        response?.status, !init.signal?.aborted, response?.headers.get('x-request-id') || null, 0, cause,
      );
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener('abort', onAbort);
    }
    const delay = Math.max(1500 * attempt, failure.retryAfterMs);
    const willRetry = failure.retryable && attempt < maxAttempts && delay <= timeoutMs && !init.signal?.aborted;
    logger.warn({
      context: 'OPENROUTER_REQUEST', attempt, upstreamStatus: failure.upstreamStatus,
      requestId: failure.requestId, willRetry,
      cause: failure.cause instanceof Error ? failure.cause.message : undefined,
    }, 'Gọi OpenRouter thất bại');
    if (!willRetry) throw failure;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

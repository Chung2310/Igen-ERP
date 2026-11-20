import { setTimeout as delay } from 'node:timers/promises';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { getEnv } from '../config/env.js';
import { OpenRouterRequestError, requestOpenRouter } from './openRouterRequest.js';
import { withAiBilling } from './aiBillingService.js';
import { logger } from '../config/logger.js';
import type { AiBillingContext, ProviderResult, ProviderUsage } from './creditTypes.js';

interface AiCallOptions {
  signal?: AbortSignal;
  maxAttempts?: number;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
  jsonMode?: boolean;
  requestKey?: string;
  taskType?: string;
}

/**
 * Hàm gọi API nền tảng OpenRouter với cơ chế retry tự động khi gặp 429
 */
function normalizedUsage(usage: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown; cost?: unknown } | undefined): ProviderUsage {
  const integer = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
  const result: ProviderUsage = { inputTokens: integer(usage?.prompt_tokens), outputTokens: integer(usage?.completion_tokens), totalTokens: integer(usage?.total_tokens) };
  if (usage?.cost !== undefined) {
    const cost = Number(usage.cost);
    if (!Number.isFinite(cost) || cost < 0) throw new AppError({ status: 502, code: ERROR_CODES.EXTERNAL, message: 'AI provider trả về chi phí không hợp lệ.' });
    result.providerCostMicrousd = Math.round(cost * 1_000_000);
  }
  return result;
}

async function callOpenRouter(prompt: string, options: AiCallOptions = {}): Promise<ProviderResult<string>> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new AppError({
      status: 503,
      code: ERROR_CODES.UNAVAILABLE,
      message: 'PT Assistant chưa được cấu hình.',
    });
  }

  const model = getEnv().AI_MODEL;
  const temperature = options.temperature ?? 0.1;
  const maxTokens = options.maxTokens ?? 8192;
  const reasoningEffort = (process.env.OPENROUTER_REASONING_EFFORT as any) || options.reasoningEffort || 'none';

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= (options.maxAttempts ?? 3); attempt++) {
    if (options.signal?.aborted) throw new AppError({ status: 504, code: ERROR_CODES.EXTERNAL, message: 'Đã dừng yêu cầu AI.' });
    const startedAt = Date.now();
    try {
      const bodyPayload: Record<string, any> = {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
        reasoning: { effort: reasoningEffort },
      };

      if (options.jsonMode) {
        bodyPayload.response_format = { type: 'json_object' };
        bodyPayload.plugins = [{ id: 'response-healing' }];
        bodyPayload.provider = { require_parameters: true };
      }

      logger.info({
        context: 'AI_PROVIDER', provider: 'openrouter', model, attempt,
        requestKey: options.requestKey, taskType: options.taskType,
        promptLength: prompt.length, maxTokens, reasoningEffort,
        responseFormat: options.jsonMode ? 'json_object' : 'text',
      }, 'Bắt đầu gọi OpenRouter');

      const { response, data: payload } = await requestOpenRouter(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          signal: options.signal,
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_URL || 'https://3s.igentechnology.net',
            'X-Title': '3S Gym & Wellness Fitness',
          },
          body: JSON.stringify(bodyPayload),
        },
        getEnv().PROVIDER_TIMEOUT_MS,
        1,
      );

      const data = payload as {
        id?: string;
        provider?: string;
        model?: string;
        choices?: Array<{
          finish_reason?: string;
          native_finish_reason?: string;
          message?: { content?: string; reasoning?: string };
        }>;
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown; cost?: unknown };
      };

      const choiceMsg = data.choices?.[0]?.message;
      let content = choiceMsg?.content;

      logger.info({
        context: 'AI_PROVIDER', provider: data.provider || 'openrouter',
        model: data.model || model, attempt, requestKey: options.requestKey,
        taskType: options.taskType, durationMs: Date.now() - startedAt,
        statusCode: response.status,
        openRouterRequestId: response.headers.get('x-request-id') || data.id,
        finishReason: data.choices?.[0]?.finish_reason,
        nativeFinishReason: data.choices?.[0]?.native_finish_reason,
        contentLength: content?.length || 0,
        reasoningLength: choiceMsg?.reasoning?.length || 0,
        usage: normalizedUsage(data.usage),
      }, 'OpenRouter đã phản hồi');

      // Fallback nếu model trả toàn bộ văn bản trong khối reasoning
      if (!options.jsonMode && (!content || !content.trim()) && choiceMsg?.reasoning) {
        content = choiceMsg.reasoning;
      }

      if (!content || !content.trim()) {
        logger.error({
          context: 'AI_PROVIDER', provider: data.provider || 'openrouter',
          model: data.model || model, attempt, requestKey: options.requestKey,
          taskType: options.taskType,
          finishReason: data.choices?.[0]?.finish_reason,
          nativeFinishReason: data.choices?.[0]?.native_finish_reason,
          reasoningPreview: choiceMsg?.reasoning?.slice(0, 1_000),
        }, 'OpenRouter không trả về content');
        throw new AppError({ status: 502, code: ERROR_CODES.EXTERNAL, message: 'AI provider không trả nội dung' });
      }

      if (options.jsonMode) {
        try {
          JSON.parse(content);
        } catch (cause) {
          logger.error({
            context: 'AI_PROVIDER', provider: data.provider || 'openrouter',
            model: data.model || model, attempt, requestKey: options.requestKey,
            taskType: options.taskType,
            finishReason: data.choices?.[0]?.finish_reason,
            nativeFinishReason: data.choices?.[0]?.native_finish_reason,
            responseLength: content.length,
            responseStart: content.slice(0, 1_000),
            responseEnd: content.length > 1_000 ? content.slice(-1_000) : undefined,
            err: cause,
          }, 'OpenRouter trả về JSON không hợp lệ');
          throw new AppError({
            status: 502,
            code: ERROR_CODES.EXTERNAL,
            message: 'AI provider trả về JSON không hợp lệ.',
            cause,
          });
        }
      }

      return { value: content.trim(), provider: 'openrouter', model, usage: normalizedUsage(data.usage) };
    } catch (err: any) {
      if (options.signal?.aborted) throw new AppError({ status: 504, code: ERROR_CODES.EXTERNAL, message: 'Đã dừng yêu cầu AI do hết thời gian hoặc kết nối đã đóng.', cause: err });
      lastError = err;
      const retryDelay = Math.max(1500 * attempt, err instanceof OpenRouterRequestError ? err.retryAfterMs : 0);
      const isRetryable = (err instanceof OpenRouterRequestError ? err.retryable : err?.status === 503 || err?.status === 502 || err?.code === ERROR_CODES.UNAVAILABLE || err?.code === ERROR_CODES.EXTERNAL) && retryDelay <= getEnv().PROVIDER_TIMEOUT_MS;
      logger.warn({
        context: 'AI_PROVIDER', provider: 'openrouter', model, attempt,
        requestKey: options.requestKey, taskType: options.taskType,
        durationMs: Date.now() - startedAt, retryable: isRetryable,
        willRetry: isRetryable && attempt < (options.maxAttempts ?? 3),
        err,
      }, 'Lỗi khi gọi OpenRouter');
      if (isRetryable && attempt < (options.maxAttempts ?? 3)) {
        try { await delay(retryDelay, undefined, { signal: options.signal }); } catch (cause) {
          throw new AppError({ status: 504, code: ERROR_CODES.EXTERNAL, message: 'Đã dừng yêu cầu AI.', cause });
        }
        continue;
      }
      break;
    }
  }

  if (lastError instanceof AppError) throw lastError;
  throw new AppError({
    status: 502,
    code: ERROR_CODES.EXTERNAL,
    message: 'PT Assistant tạm thời không phản hồi. Vui lòng thử lại.',
    cause: lastError,
  });
}

async function billOrLegacy(context: AiBillingContext | string, prompt: string | undefined, options: AiCallOptions) {
  if (typeof context === 'string') return (await callOpenRouter(context, options)).value;
  return withAiBilling(context, () => callOpenRouter(prompt!, {
    ...options,
    requestKey: context.requestKey,
    taskType: context.taskType,
  }));
}

/**
 * 1. Tác vụ chuyên biệt: Sinh Thực Đơn Dinh Dưỡng Chi Tiết
 */
export function generateNutritionDraft(context: AiBillingContext, prompt: string): Promise<string>;
export function generateNutritionDraft(prompt: string): Promise<string>;
export async function generateNutritionDraft(context: AiBillingContext | string, prompt?: string): Promise<string> {
  return billOrLegacy(context, prompt, {
    temperature: 0.1,
    maxTokens: 8192,
    reasoningEffort: 'none',
    jsonMode: true,
  });
}

/**
 * 2. Tác vụ chuyên biệt: Phân Tích Cơ Thể & Năng Lượng Chuyển Hóa
 */
export function generateNutritionAnalysis(context: AiBillingContext, prompt: string): Promise<string>;
export function generateNutritionAnalysis(prompt: string): Promise<string>;
export async function generateNutritionAnalysis(context: AiBillingContext | string, prompt?: string): Promise<string> {
  return billOrLegacy(context, prompt, {
    temperature: 0.1,
    maxTokens: 4096,
    reasoningEffort: 'none',
  });
}

/**
 * 3. Tác vụ chuyên biệt: Thiết Kế Giáo Án Huấn Luyện (Workout Plan)
 */
export function generateWorkoutDraft(context: AiBillingContext, prompt: string): Promise<string>;
export function generateWorkoutDraft(prompt: string): Promise<string>;
export async function generateWorkoutDraft(context: AiBillingContext | string, prompt?: string): Promise<string> {
  return billOrLegacy(context, prompt, {
    temperature: 0.1,
    maxTokens: 16384,
    reasoningEffort: 'none',
    jsonMode: true,
  });
}

/**
 * 4. Tác vụ chuyên biệt: Sinh Lộ Trình Huấn Luyện Dài Hạn (Roadmap)
 */
export function generateRoadmapDraft(context: AiBillingContext, prompt: string, signal?: AbortSignal): Promise<string>;
export function generateRoadmapDraft(prompt: string): Promise<string>;
export async function generateRoadmapDraft(context: AiBillingContext | string, prompt?: string, signal?: AbortSignal): Promise<string> {
  return billOrLegacy(context, prompt, {
    signal,
    maxAttempts: 1,
    jsonMode: true,
    temperature: 0.1,
    maxTokens: 8192,
    reasoningEffort: 'none',
  });
}

/**
 * 5. Tác vụ chuyên biệt: Trợ Lý PT & Trả Lời Câu Hỏi Nghiệp Vụ
 */
export function generateAssistantAdvice(context: AiBillingContext, prompt: string): Promise<string>;
export function generateAssistantAdvice(prompt: string): Promise<string>;
export async function generateAssistantAdvice(context: AiBillingContext | string, prompt?: string): Promise<string> {
  return billOrLegacy(context, prompt, {
    temperature: 0.2,
    maxTokens: 4096,
    reasoningEffort: 'none',
  });
}

/**
 * Hàm chung sinh văn bản (Tương thích ngược)
 */
export function generateText(context: AiBillingContext, prompt: string): Promise<string>;
export function generateText(prompt: string): Promise<string>;
export async function generateText(context: AiBillingContext | string, prompt?: string): Promise<string> {
  return billOrLegacy(context, prompt, {
    temperature: 0.1,
    maxTokens: 16384,
    reasoningEffort: 'none',
  });
}

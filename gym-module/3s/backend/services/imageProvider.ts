import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { getEnv } from '../config/env.js';
import { requestOpenRouter } from './openRouterRequest.js';
import { withAiBilling } from './aiBillingService.js';
import type { AiBillingContext, ProviderResult } from './creditTypes.js';

/** Gemini-only image generation via OpenRouter, in fallback order. */
export const IMAGE_MODEL = 'google/gemini-3.1-flash-image';
export const FALLBACK_IMAGE_MODEL = 'google/gemini-3.1-flash-lite-image';
export const FALLBACK_IMAGE_MODEL_FLASH = 'google/gemini-2.5-flash-image';
const IMAGE_MODELS = [IMAGE_MODEL, FALLBACK_IMAGE_MODEL, FALLBACK_IMAGE_MODEL_FLASH];
export const IMAGE_UNIT_COST_USD = 0.07;

export type AspectRatio = '1:1' | '4:3' | '3:4' | '3:2' | '2:3' | '16:9' | '9:16' | '21:9' | 'auto';
export type OutputFormat = 'png' | 'jpeg';

export interface GenerateImageOptions {
  /** Text description of the desired image */
  prompt: string;
  /** Aspect ratio (default: '1:1') */
  aspectRatio?: AspectRatio;
  /** Output format (default: 'jpeg') */
  outputFormat?: OutputFormat;
  /** Deterministic seed (optional) */
  seed?: number;
}

export interface GeneratedImage {
  /** Base64-encoded image bytes */
  b64Json: string;
  /** MIME type (e.g. 'image/png' or 'image/jpeg') */
  mediaType: string;
  /** USD cost of the generation */
  cost: number;
  /** Number of image tokens consumed */
  completionTokens: number;
}

async function callOpenRouterGeminiImage(
  model: string,
  apiKey: string,
  options: GenerateImageOptions
): Promise<ProviderResult<GeneratedImage>> {
  const { data } = await requestOpenRouter<any>(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://3s.igentechnology.net',
        'X-Title': '3S Gym & Wellness Fitness',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: options.prompt }],
        modalities: ['image', 'text'],
        ...(options.aspectRatio && options.aspectRatio !== 'auto'
          ? { image_config: { aspect_ratio: options.aspectRatio } } : {}),
        ...(options.seed !== undefined ? { seed: options.seed } : {}),
      }),
    },
    getEnv().PROVIDER_TIMEOUT_MS,
  );

  const choice = data.choices?.[0];
  const imgObj = choice?.message?.images?.[0];
  if (!imgObj) {
    throw new Error('OpenRouter Gemini không trả về dữ liệu ảnh trong message.images.');
  }

  const url = typeof imgObj === 'string' ? imgObj : (imgObj.image_url?.url || imgObj.url || '');
  if (!url || !url.startsWith('data:image/')) {
    throw new Error('Dữ liệu ảnh từ Gemini không đúng định dạng base64.');
  }

  const mimeMatch = url.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,/);
  const mediaType = mimeMatch ? mimeMatch[1] : 'image/png';
  const b64Json = url.replace(/^data:image\/[a-zA-Z0-9.+_-]+;base64,/, '');

  // Gemini image generation is billed at the fixed business unit price of
  // $0.07 per generated image. Keep provider metadata out of the billing
  // calculation so quota and cost records remain consistent across models.
  const cost = IMAGE_UNIT_COST_USD;
  const value: GeneratedImage = {
    b64Json,
    mediaType,
    cost,
    completionTokens: data.usage?.completion_tokens ?? 0,
  };

  return {
    value,
    provider: 'openrouter',
    model,
    usage: {
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens,
      providerCostMicrousd: Math.round(cost * 1_000_000),
    },
  };
}

/** Try only Gemini image models; surface an error if all are unavailable. */
async function generateImageRaw(options: GenerateImageOptions): Promise<ProviderResult<GeneratedImage>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AppError({
      status: 503,
      code: ERROR_CODES.UNAVAILABLE,
      message: 'Dịch vụ tạo ảnh Gemini chưa được cấu hình.',
    });
  }

  let cause: unknown;
  for (const model of IMAGE_MODELS) {
    try {
      return await callOpenRouterGeminiImage(model, apiKey, options);
    } catch (error) {
      cause = error;
      console.warn(`[imageProvider] Gemini image model (${model}) failed:`, error instanceof Error ? error.message : error);
    }
  }
  if (cause instanceof AppError) throw cause;
  throw new AppError({
    status: 502,
    code: ERROR_CODES.EXTERNAL,
    message: 'Dịch vụ tạo ảnh AI tạm thời không phản hồi. Vui lòng thử lại sau.',
    cause,
  });
}

export function generateImage(context: AiBillingContext, options: GenerateImageOptions): Promise<GeneratedImage>;
export function generateImage(options: GenerateImageOptions): Promise<GeneratedImage>;
export async function generateImage(context: AiBillingContext | GenerateImageOptions, options?: GenerateImageOptions): Promise<GeneratedImage> {
  if ('prompt' in context) return (await generateImageRaw(context)).value;
  return withAiBilling(context, () => generateImageRaw(options!));
}

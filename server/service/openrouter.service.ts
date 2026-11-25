/**
 * OpenRouter Service
 * ──────────────────
 * OpenAI-compatible client trỏ tới https://openrouter.ai/api/v1.
 * Hỗ trợ: chat completions (text + vision), image generation.
 * LLM chữ/phân tích dùng model trong chính sách dùng chung.
 * Model tạo/chỉnh ảnh và fallback ảnh được cấu hình riêng.
 */

import { DEFAULT_IMAGE_MODEL, IMAGE_EDIT_MODEL, META_MUSE_IMAGE_MODEL, RECRAFT_ASPECT_RATIOS, RECRAFT_IMAGE_MODEL, TRANSPARENT_IMAGE_EDIT_MODEL, generateImageViaImagesApi, generateRecraftImage } from "./openrouter-image-api";
import { canonicalAssistantLinkUrl, safeAssistantHttpUrl } from "../../src/components/common/assistant-link-utils";
import { AI_PROVIDER_TEMPORARY_ERROR } from "../../src/shared/ai-provider-error";
import { ERP_LLM_MODEL, ERP_LLM_FALLBACK_MODEL, llmSamplingParameters, shouldFallbackLlm } from "../../shared/llm-model";
import { withAssistantRequestControl, assertAssistantExecutionActive } from "../assistant/execution-control";
import { createHash } from 'node:crypto';
import { fetchOpenRouter } from './openrouter-transport';

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

function getApiKey(): string {
  return process.env.OPENROUTER_API_KEY || "";
}

/** Server logs only: identify the credential loaded by this process without exposing it. */
export function openRouterConfigurationDiagnostics() {
  const key = getApiKey();
  return {
    processId: process.pid,
    configured: Boolean(key),
    keyFingerprint: key ? createHash('sha256').update(key).digest('hex').slice(0, 16) : null,
    model: ERP_LLM_MODEL,
    fallbackModel: ERP_LLM_FALLBACK_MODEL,
    endpoint: `${OPENROUTER_BASE_URL}/chat/completions`,
    transport: process.env.OPENROUTER_PROXY_URL?.trim() ? 'configured-proxy' : 'direct',
  };
}
if (process.env.NODE_ENV === 'development') {
  console.info('[OpenRouter] Local configuration', JSON.stringify(openRouterConfigurationDiagnostics()));
}

/**
 * Thêm provider prefix nếu chưa có.
 * "gemini-2.5-flash" → "google/gemini-2.5-flash"
 * "claude-opus-4-5"  → "anthropic/claude-opus-4-5"
 * "qwen3.6-flash"    → "qwen/qwen3.6-flash"
 */
export function mapModelName(modelName: string): string {
  if (!modelName) return ERP_LLM_MODEL;
  if (modelName.includes("/")) return modelName; // already namespaced

  if (modelName.startsWith("gemini-")) return `google/${modelName}`;
  if (modelName.startsWith("claude-")) return `anthropic/${modelName}`;
  if (modelName.startsWith("qwen")) return `qwen/${modelName}`;
  if (modelName.startsWith("gpt-")) return `openai/${modelName}`;

  return modelName;
}

function getFallbackImageModel(): string {
  return mapModelName(process.env.OPENROUTER_FALLBACK_IMAGE_MODEL || "google/gemini-3.1-flash-image");
}

/** Lỗi mà đổi model cũng không cứu được (sai key / hết credit) → không fallback */
function isNonFallbackableError(error: any): boolean {
  const status = error?.status ?? 0;
  return status === 401 || status === 402;
}

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": process.env.APP_URL || "https://igen-erp.app",
    "X-Title": "Igen ERP",
  };
}

function logPaymentRequiredDetails(response: Response, errorText: string) {
  let providerError: any = {};
  try {
    providerError = JSON.parse(errorText)?.error || {};
  } catch {
    // Keep the client-facing error stable if OpenRouter returns a non-JSON body.
  }
  const metadata = providerError?.metadata && typeof providerError.metadata === "object" ? providerError.metadata : {};
  const safe = (value: unknown, maxLength = 160) => String(value ?? "unknown")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/gi, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, maxLength);
  const retryAfter = response.headers.get("retry-after");
  const limitSource = typeof metadata.limit_source === "string" ? metadata.limit_source : "";
  console.warn(
    `[OpenRouter] HTTP 402 | code=${safe(providerError?.code)} | limit_source=${safe(limitSource)} | provider=${safe(metadata.provider_name)} | retry_after=${safe(retryAfter)} | detail=${safe(providerError?.message, 240)}`,
  );
  return { limitSource, retryAfter };
}

function retryAfterDelayMs(value: unknown, fallbackMs: number) {
  if (typeof value !== "string" || !value.trim()) return fallbackMs;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : fallbackMs;
}

export type OpenRouterMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | OpenRouterContentPart[] }
  | { role: "assistant"; content: string };

export type OpenRouterContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export interface OpenRouterChatParams {
  /** Caller metadata retained for compatibility; the text wire model is ERP_LLM_MODEL. */
  model: string;
  /** Defaults to the shared Luna → Haiku chain; false explicitly disables failover. */
  allowFallback?: boolean;
  /** Legacy metadata; the backup is pinned to ERP_LLM_FALLBACK_MODEL. */
  fallbackModel?: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  /** Return JSON object (response_format: json_object) */
  jsonMode?: boolean;
  /** Bound the requested output size for calls with predictable response lengths. */
  maxTokens?: number;
  /** Optional JSON schema — injected into system prompt as instruction */
  responseSchema?: object;
  /** Let the model perform bounded, multi-step web searches and return source citations. */
  webSearch?: boolean;
  /** Exa search depth; use fast for current quotes and deep for research synthesis. */
  webSearchMode?: "instant" | "fast" | "auto" | "deep-lite" | "deep" | "deep-reasoning";
  maxRetries?: number;
  /** Server-only request timeout, bounded by the current assistant turn when safe execution is enabled. */
  timeoutMs?: number;
}

export interface OpenRouterCitation {
  title: string;
  url: string;
}

/**
 * Chat completions — text và/hoặc vision (base64 images).
 * Luna là model chính; Haiku là dự phòng duy nhất cho lỗi khả dụng.
 * Giữ nguyên payload, quyền, schema và deadline; không chuyển sang FreeLLM.
 */
export async function openrouterChat(params: OpenRouterChatParams): Promise<{ text: string; citations?: OpenRouterCitation[] }> {
  const { temperature = 0.7, jsonMode, responseSchema, maxRetries = 4 } = params;
  const envMaxTokens = Number(process.env.OPENROUTER_MAX_TOKENS);
  const maxTokens = params.maxTokens ?? (Number.isFinite(envMaxTokens) && envMaxTokens > 0 ? envMaxTokens : undefined);
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("[OpenRouter] OPENROUTER_API_KEY chưa được cấu hình trong .env");
  }

  const mappedModel = ERP_LLM_MODEL;

  // Nếu có responseSchema, inject vào system prompt
  let messages = [...params.messages];
  if (responseSchema) {
    const schemaInstruction = `Respond ONLY with a valid JSON object matching this schema (no markdown, no explanation):\n${JSON.stringify(responseSchema, null, 2)}`;
    const sysIdx = messages.findIndex((m) => m.role === "system");
    if (sysIdx >= 0) {
      messages[sysIdx] = {
        role: "system",
        content: (messages[sysIdx] as any).content + "\n\n" + schemaInstruction,
      };
    } else {
      messages = [{ role: "system", content: schemaInstruction }, ...messages];
    }
  }

  if (params.webSearch && !apiKey) {
    throw new Error("Nghiên cứu web cần OpenRouter API key có quyền sử dụng Web Search.");
  }
  const jsonRequested = Boolean(jsonMode || responseSchema);

  const allowFallback = params.allowFallback !== false;
  const deadlineAt = Date.now() + (params.timeoutMs ?? 40_000);
  try {
    return await chatWithRetries(OPENROUTER_BASE_URL, apiKey, mappedModel, messages, temperature, jsonRequested, maxRetries, params.webSearch, params.webSearchMode, maxTokens, params.timeoutMs, allowFallback);
  } catch (error) {
    await assertAssistantExecutionActive();
    const remainingMs = deadlineAt - Date.now();
    if (!allowFallback || !shouldFallbackLlm(error) || remainingMs <= 0) throw error;
    console.warn(`[OpenRouter] Primary unavailable; using fallback model=${ERP_LLM_FALLBACK_MODEL}`);
    return chatWithRetries(OPENROUTER_BASE_URL, apiKey, ERP_LLM_FALLBACK_MODEL, messages, temperature, jsonRequested, 1, params.webSearch, params.webSearchMode, maxTokens, remainingMs);
  }
}

async function chatWithRetries(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: OpenRouterMessage[],
  temperature: number,
  jsonMode: boolean,
  maxRetries: number,
  webSearch = false,
  webSearchMode: OpenRouterChatParams["webSearchMode"] = "deep",
  maxTokens?: number,
  timeoutMs = 40_000,
  failoverOnUnavailable = false,
): Promise<{ text: string; citations?: OpenRouterCitation[] }> {
  const body: Record<string, any> = {
    model,
    messages,
    ...llmSamplingParameters(model, temperature),
  };
  if (Number.isFinite(maxTokens) && (maxTokens as number) > 0) body.max_tokens = Math.floor(maxTokens as number);

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }
  if (webSearch) {
    body.tool_choice = "required";
    body.tools = [{
      type: "openrouter:web_search",
      parameters: {
        engine: "exa",
        mode: webSearchMode,
        max_results: 6,
        max_total_results: 20,
        max_uses: 4,
        search_context_size: "medium",
      },
    }];
  }

  let lastError: any;
  let delay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      console.log(`[OpenRouter] POST ${baseUrl}/chat/completions | model=${model} | attempt=${attempt}`);

      await assertAssistantExecutionActive();
      const data = await withAssistantRequestControl(timeoutMs, async signal => {
        const response = await fetchOpenRouter(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: buildHeaders(apiKey),
          body: JSON.stringify(body),
          signal: failoverOnUnavailable || model === ERP_LLM_FALLBACK_MODEL
            ? AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(Math.max(1, Math.floor(failoverOnUnavailable ? timeoutMs / 2 : timeoutMs)))])
            : signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          const paymentRequired = response.status === 402 ? logPaymentRequiredDetails(response, errText) : undefined;
          const err = new Error(response.status === 402 ? AI_PROVIDER_TEMPORARY_ERROR : `OpenRouter API lỗi ${response.status}: ${errText}`) as any;
          err.status = response.status;
          err.providerLimitSource = paymentRequired?.limitSource;
          err.retryAfter = paymentRequired?.retryAfter;
          throw err;
        }

        return (await response.json()) as any;
      });
      const message = data.choices?.[0]?.message;
      const text: string = typeof message?.content === "string" ? message.content : "";
      if (!text.trim()) throw Object.assign(new Error('OpenRouter returned an empty completion.'), { status: 502 });
      const parseCitation = (citation: any): OpenRouterCitation | null => {
        const rawUrl = typeof citation === "string" ? citation : citation?.url;
        if (typeof rawUrl !== "string") return null;
        const safeUrl = safeAssistantHttpUrl(rawUrl);
        if (!safeUrl) return null;
        let host: string;
        try { host = new URL(safeUrl).hostname; } catch { return null; }
        const rawTitle = typeof citation?.title === "string" ? citation.title.trim() : "";
        return {
          title: rawTitle ? rawTitle.slice(0, 240) : host,
          url: safeUrl.slice(0, 2048),
        };
      };
      const annotationSources = (Array.isArray(message?.annotations) ? message.annotations : [])
        .map((annotation: any) => parseCitation(annotation?.url_citation || annotation))
        .filter((source: OpenRouterCitation | null): source is OpenRouterCitation => source !== null);
      const topLevelSources = (Array.isArray(data.citations) ? data.citations : [])
        .map((citation: any) => parseCitation(citation))
        .filter((source: OpenRouterCitation | null): source is OpenRouterCitation => source !== null);
      const candidateSources = annotationSources.length > 0
        ? [
          ...annotationSources,
          ...topLevelSources.filter(source => {
            const canonical = canonicalAssistantLinkUrl(source.url);
            const host = new URL(source.url).hostname.replace(/^www\./i, "");
            return (canonical && text.includes(canonical)) || text.includes(source.url) || text.includes(host);
          }),
        ]
        : topLevelSources;
      const citationMap = new Map<string, OpenRouterCitation>();
      for (const source of candidateSources) {
        const key = canonicalAssistantLinkUrl(source.url) || source.url;
        const existing = citationMap.get(key);
        if (!existing) {
          citationMap.set(key, source);
          continue;
        }
        const existingHost = new URL(existing.url).hostname;
        if ((existing.title === existingHost || !existing.title) && source.title && source.title !== existingHost) {
          citationMap.set(key, source);
        }
      }
      const citations = [...citationMap.values()].slice(0, 16);
      const elapsed = Date.now() - startTime;
      console.log(`[OpenRouter] Success | model=${data.model || model} | ${elapsed}ms | len=${text.length}`);
      return { text, ...(citations.length ? { citations } : {}) };
    } catch (error: any) {
      await assertAssistantExecutionActive();
      lastError = error;
      if (failoverOnUnavailable && shouldFallbackLlm(error)) break;
      const status = error?.status ?? 0;
      const msg = error?.message || String(error);
      const inFlightBudgetExceeded = status === 402 && error?.providerLimitSource === "openrouter_in_flight_budget";
      const isRetryable =
        status === 429 || status === 503 || status === 502 ||
        inFlightBudgetExceeded ||
        msg.includes("RESOURCE_EXHAUSTED") || msg.includes("fetch failed") ||
        msg.includes("ECONNRESET") || msg.includes("ETIMEDOUT");

      if (isRetryable && attempt < maxRetries) {
        const retryDelay = inFlightBudgetExceeded ? retryAfterDelayMs(error?.retryAfter, delay) : delay;
        console.warn(`[OpenRouter] Attempt ${attempt} failed, retrying in ${retryDelay}ms... Error: ${msg}`);
        await withAssistantRequestControl(retryDelay + 100, signal => new Promise<void>((resolve, reject) => {
          const done = () => { signal?.removeEventListener("abort", abort); resolve(); };
          const timer = setTimeout(done, retryDelay);
          const abort = () => { clearTimeout(timer); reject(signal?.reason); };
          signal?.addEventListener("abort", abort, { once: true });
          if (signal?.aborted) abort();
        }));
        delay *= 2;
      } else {
        break;
      }
    }
  }

  throw lastError ?? new Error("[OpenRouter] Chat completions failed with no error details.");
}

export interface OpenRouterImageParams {
  prompt: string;
  model?: string;
  /** Keep this exact model instead of applying shared image/edit model routing. */
  exactModel?: boolean;
  aspectRatio?: string;
  resolution?: string;
  /** Use OpenRouter's Images API for providers that expose normalized output resolution tiers. */
  useImagesApi?: boolean;
  quality?: "low" | "medium" | "high" | "auto";
  background?: "auto" | "transparent" | "opaque";
  outputFormat?: "png" | "jpeg" | "webp";
  /** Reference images (base64 data URL hoặc https URL) cho image-to-image */
  referenceImages?: string[];
  allowFallback?: boolean;
  preserveInputAspectRatio?: boolean;
}

/**
 * Image API models generate/edit through Images API; other image models use chat completions.
 * Model chính lỗi thì có thể dùng model dự phòng nếu luồng cho phép.
 */
export async function openrouterGenerateImage(params: OpenRouterImageParams): Promise<{ url: string }> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("[OpenRouter] OPENROUTER_API_KEY chưa được cấu hình trong .env");

  const configuredModel = params.model
    ? mapModelName(params.model)
    : params.background === "transparent"
      ? mapModelName(process.env.IGENAI_TRANSPARENT_IMAGE_EDIT_MODEL || TRANSPARENT_IMAGE_EDIT_MODEL)
    : (process.env.OPENROUTER_IMAGE_MODEL || DEFAULT_IMAGE_MODEL);

  const allowedRatios = new Set(["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "1:4", "4:1", "1:8", "8:1", "21:9"]);
  const autoAspectRatio = params.aspectRatio === "auto";
  const ratioKey = params.aspectRatio && allowedRatios.has(params.aspectRatio) ? params.aspectRatio : "1:1";
  const model = params.exactModel
    ? configuredModel
    : params.background === "transparent"
    ? configuredModel
    : params.referenceImages?.length
    ? configuredModel === META_MUSE_IMAGE_MODEL ? configuredModel : IMAGE_EDIT_MODEL
    : (configuredModel === RECRAFT_IMAGE_MODEL && !RECRAFT_ASPECT_RATIOS.has(ratioKey))
      ? IMAGE_EDIT_MODEL
      : configuredModel;
  const finalPrompt = params.preserveInputAspectRatio || autoAspectRatio
    ? params.prompt
    : `${params.prompt}\n\nGenerate the image with a ${ratioKey} aspect ratio.`;
  const requestAspectRatio = params.preserveInputAspectRatio || autoAspectRatio
    ? params.background === "transparent" ? "auto" : undefined
    : ratioKey;

  // Build message content — text prompt + optional reference images
  const content: any[] = [{ type: "text", text: finalPrompt }];
  for (const img of params.referenceImages || []) {
    content.push({ type: "image_url", image_url: { url: img } });
  }

  console.log(`[OpenRouter Image] model=${model} | promptLen=${params.prompt.length} | aspectRatio=${ratioKey} | hasReference=${Boolean(params.referenceImages?.length)}`);

  try {
    if (params.useImagesApi) {
      const resolution = ["512", "1K", "2K", "4K"].includes(params.resolution || "")
        ? params.resolution as "512" | "1K" | "2K" | "4K"
        : "1K";
      return await generateImageViaImagesApi(apiKey, model, params.prompt, autoAspectRatio ? undefined : ratioKey, undefined, {
        inputReferences: params.referenceImages,
        outputFormat: params.outputFormat ?? "png",
        resolution,
      });
    }
    if (params.background === "transparent") {
      return await generateImageViaImagesApi(
        apiKey,
        model,
        finalPrompt,
        requestAspectRatio,
        params.quality ?? "medium",
        {
          background: params.background,
          outputFormat: params.outputFormat ?? "png",
          inputReferences: params.referenceImages,
        },
      );
    }
    if (model === META_MUSE_IMAGE_MODEL) {
      return await generateImageViaImagesApi(apiKey, model, finalPrompt, undefined, undefined, {
        inputReferences: params.referenceImages,
      });
    }
    if (!params.referenceImages?.length && model === DEFAULT_IMAGE_MODEL) return await generateImageViaImagesApi(apiKey, model, params.prompt, autoAspectRatio ? undefined : ratioKey, "low");
    if (!params.referenceImages?.length && model === RECRAFT_IMAGE_MODEL) return await generateRecraftImage(apiKey, params.prompt, autoAspectRatio ? undefined : ratioKey);
    return await generateImageWithRetries(apiKey, model, content, params.preserveInputAspectRatio || autoAspectRatio ? undefined : ratioKey, 3);
  } catch (error: any) {
    const fallbackModel = getFallbackImageModel();
    if (model === META_MUSE_IMAGE_MODEL || (!params.referenceImages?.length && (model === DEFAULT_IMAGE_MODEL || model === RECRAFT_IMAGE_MODEL)) || params.allowFallback === false || isNonFallbackableError(error) || fallbackModel === model) throw error;

    console.warn(
      `[OpenRouter Image] Model ${model} thất bại, fallback sang ${fallbackModel}. Lỗi: ${error?.message || error}`
    );
    return await generateImageWithRetries(apiKey, fallbackModel, content, params.preserveInputAspectRatio || autoAspectRatio ? undefined : ratioKey, 2);
  }
}

async function generateImageWithRetries(
  apiKey: string,
  model: string,
  content: any[],
  aspectRatio: string | undefined,
  maxAttempts: number
): Promise<{ url: string }> {
  const body: Record<string, any> = {
    model,
    messages: [{ role: "user", content }],
    // Trigger image generation theo cách chính thức của OpenRouter SDK
    modalities: ["image", "text"],
    // Gemini image models nhận tỉ lệ qua image_config của OpenRouter.
    ...(aspectRatio ? { image_config: { aspect_ratio: aspectRatio } } : {}),
  };

  let lastError: any;
  let delay = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: buildHeaders(apiKey),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        const err = new Error(`[OpenRouter] Image generation lỗi ${response.status}: ${errText}`) as any;
        err.status = response.status;
        throw err;
      }

      const data = (await response.json()) as any;

      // OpenRouter trả ảnh trong message.images (non-standard field), không phải message.content
      const images = data.choices?.[0]?.message?.images;
      if (Array.isArray(images) && images.length > 0) {
        const url = images[0]?.image_url?.url;
        if (url) return { url };
      }

      // Fallback: check content array (format cũ / model khác)
      const messageContent = data.choices?.[0]?.message?.content;
      if (typeof messageContent === "string") {
        if (messageContent.startsWith("http") || messageContent.startsWith("data:")) {
          return { url: messageContent };
        }
      } else if (Array.isArray(messageContent)) {
        for (const part of messageContent) {
          if (part?.type === "image_url" && part?.image_url?.url) return { url: part.image_url.url };
          if (part?.type === "image" && part?.source?.data) {
            return { url: `data:${part.source.media_type || "image/png"};base64,${part.source.data}` };
          }
        }
      }

      throw new Error("[OpenRouter] Image response không chứa ảnh.");
    } catch (error: any) {
      lastError = error;
      const status = error?.status ?? 0;
      const msg = error?.message || String(error);
      const isRetryable =
        status === 429 || status === 502 || status === 503 ||
        msg.includes("RESOURCE_EXHAUSTED") || msg.includes("fetch failed") ||
        msg.includes("ETIMEDOUT") || msg.includes("ECONNRESET");

      if (isRetryable && attempt < maxAttempts) {
        console.warn(`[OpenRouter Image] Attempt ${attempt} failed, retrying in ${delay}ms... Error: ${msg}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }

      break;
    }
  }

  throw lastError ?? new Error("[OpenRouter] Image response không chứa ảnh sau các lần thử.");
}

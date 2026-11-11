/**
 * OpenRouter Service
 * ──────────────────
 * OpenAI-compatible client trỏ tới https://openrouter.ai/api/v1.
 * Hỗ trợ: chat completions (text + vision), image generation.
 * Khi model chính lỗi hết retry, tự fallback sang model dự phòng
 * (OPENROUTER_FALLBACK_MODEL / OPENROUTER_FALLBACK_IMAGE_MODEL).
 */

import { DEFAULT_IMAGE_MODEL, IMAGE_EDIT_MODEL, RECRAFT_ASPECT_RATIOS, generateRecraftImage } from "./openrouter-image-api";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

function getApiKey(): string {
  return process.env.OPENROUTER_API_KEY || "";
}

/**
 * Thêm provider prefix nếu chưa có.
 * "gemini-2.5-flash" → "google/gemini-2.5-flash"
 * "claude-opus-4-5"  → "anthropic/claude-opus-4-5"
 * "qwen3.6-flash"    → "qwen/qwen3.6-flash"
 */
export function mapModelName(modelName: string): string {
  if (!modelName) return "google/gemini-2.5-flash";
  if (modelName.includes("/")) return modelName; // already namespaced

  if (modelName.startsWith("gemini-")) return `google/${modelName}`;
  if (modelName.startsWith("claude-")) return `anthropic/${modelName}`;
  if (modelName.startsWith("qwen")) return `qwen/${modelName}`;

  return modelName;
}

function getFallbackModel(): string {
  return mapModelName(process.env.OPENROUTER_FALLBACK_MODEL || "qwen/qwen3.6-flash");
}

function getFallbackImageModel(): string {
  return mapModelName(process.env.OPENROUTER_FALLBACK_IMAGE_MODEL || "google/gemini-3-pro-image");
}

/** Tầng fallback thứ 3: server LLM free tự host (OpenAI-compatible). Null nếu chưa cấu hình. */
function getFreeLlmConfig(): { baseUrl: string; apiKey: string; model: string } | null {
  const baseUrl = process.env.FREELLM_API_URL;
  const apiKey = process.env.FREELLM_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    model: process.env.FREELLM_API_MODEL || "auto",
  };
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

export type OpenRouterMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | OpenRouterContentPart[] }
  | { role: "assistant"; content: string };

export type OpenRouterContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface OpenRouterChatParams {
  model: string;
  /** Model dự phòng riêng cho tác vụ này khi model chính lỗi hoặc hết lượt. */
  fallbackModel?: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  /** Return JSON object (response_format: json_object) */
  jsonMode?: boolean;
  /** Optional JSON schema — injected into system prompt as instruction */
  responseSchema?: object;
  /** Let the model perform bounded, multi-step web searches and return source citations. */
  webSearch?: boolean;
  /** Exa search depth; use fast for current quotes and deep for research synthesis. */
  webSearchMode?: "instant" | "fast" | "auto" | "deep-lite" | "deep" | "deep-reasoning";
  maxRetries?: number;
}

export interface OpenRouterCitation {
  title: string;
  url: string;
}

/**
 * Chat completions — text và/hoặc vision (base64 images).
 * Chuỗi fallback 3 tầng:
 *   1. Model chính qua OpenRouter
 *   2. getFallbackModel() qua OpenRouter (mặc định qwen/qwen3.6-flash)
 *   3. FreeLLM server tự host (FREELLM_API_URL) nếu được cấu hình
 */
export async function openrouterChat(params: OpenRouterChatParams): Promise<{ text: string; citations?: OpenRouterCitation[] }> {
  const { model, temperature = 0.7, jsonMode, responseSchema, maxRetries = 4 } = params;
  const apiKey = getApiKey();
  const freeLlm = getFreeLlmConfig();

  if (!apiKey && !freeLlm) {
    throw new Error("[OpenRouter] OPENROUTER_API_KEY chưa được cấu hình trong .env");
  }

  const mappedModel = mapModelName(model);

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

  let lastError: any;

  // Tầng 1 + 2: OpenRouter (model chính → model fallback)
  if (apiKey) {
    try {
      return await chatWithRetries(OPENROUTER_BASE_URL, apiKey, mappedModel, messages, temperature, jsonRequested, maxRetries, params.webSearch, params.webSearchMode);
    } catch (error: any) {
      lastError = error;
      const fallbackModel = params.fallbackModel ? mapModelName(params.fallbackModel) : getFallbackModel();

      if (!isNonFallbackableError(error) && fallbackModel !== mappedModel) {
        console.warn(
          `[OpenRouter] Model ${mappedModel} thất bại sau ${maxRetries} lần thử, fallback sang ${fallbackModel}. Lỗi: ${error?.message || error}`
        );
        try {
          return await chatWithRetries(OPENROUTER_BASE_URL, apiKey, fallbackModel, messages, temperature, jsonRequested, 2, params.webSearch, params.webSearchMode);
        } catch (fallbackError: any) {
          lastError = fallbackError;
        }
      }
    }
  }

  // Tầng 3: FreeLLM server tự host
  if (freeLlm) {
    console.warn(
      `[OpenRouter] Fallback tầng 3 → FreeLLM server ${freeLlm.baseUrl} | model=${freeLlm.model}. Lỗi trước đó: ${lastError?.message || lastError || "OpenRouter chưa cấu hình"}`
    );
    if (params.webSearch) throw new Error("Fallback AI hiện không hỗ trợ tìm kiếm web.");
    return await chatWithRetries(freeLlm.baseUrl, freeLlm.apiKey, freeLlm.model, messages, temperature, jsonRequested, 2);
  }

  throw lastError ?? new Error("[OpenRouter] Chat completions failed with no error details.");
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
): Promise<{ text: string; citations?: OpenRouterCitation[] }> {
  const body: Record<string, any> = {
    model,
    messages,
    temperature,
  };

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

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: buildHeaders(apiKey),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        const err = new Error(`OpenRouter API lỗi ${response.status}: ${errText}`) as any;
        err.status = response.status;
        throw err;
      }

      const data = (await response.json()) as any;
      const message = data.choices?.[0]?.message;
      const text: string = typeof message?.content === "string" ? message.content : "";
      const sources = [
        ...(Array.isArray(message?.annotations) ? message.annotations : []).map((annotation: any) => annotation?.url_citation || annotation),
        ...(Array.isArray(data.citations) ? data.citations : []),
      ].map((citation: any): OpenRouterCitation | null => {
        const url = typeof citation === "string" ? citation : citation?.url;
        if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
        let host: string;
        try { host = new URL(url).hostname; } catch { return null; }
        return { title: typeof citation?.title === "string" && citation.title.trim() ? citation.title.trim().slice(0, 240) : host, url: url.slice(0, 2048) };
      }).filter((source: OpenRouterCitation | null): source is OpenRouterCitation => source !== null);
      const citations = [...new Map(sources.map(source => [source.url, source])).values()].slice(0, 16);
      const elapsed = Date.now() - startTime;
      console.log(`[OpenRouter] Success | model=${data.model || model} | ${elapsed}ms | len=${text.length}`);
      return { text, ...(citations.length ? { citations } : {}) };
    } catch (error: any) {
      lastError = error;
      const status = error?.status ?? 0;
      const msg = error?.message || String(error);
      const isRetryable =
        status === 429 || status === 503 || status === 502 ||
        msg.includes("RESOURCE_EXHAUSTED") || msg.includes("fetch failed") ||
        msg.includes("ECONNRESET") || msg.includes("ETIMEDOUT");

      if (isRetryable && attempt < maxRetries) {
        console.warn(`[OpenRouter] Attempt ${attempt} failed, retrying in ${delay}ms... Error: ${msg}`);
        await new Promise((r) => setTimeout(r, delay));
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
  aspectRatio?: string;
  resolution?: string;
  /** Reference images (base64 data URL hoặc https URL) cho image-to-image */
  referenceImages?: string[];
  allowFallback?: boolean;
  preserveInputAspectRatio?: boolean;
}

/**
 * Recraft tạo ảnh mới qua Images API; các model hỗ trợ ảnh tham chiếu dùng chat completions.
 * Model chính lỗi thì có thể dùng model dự phòng nếu luồng cho phép.
 */
export async function openrouterGenerateImage(params: OpenRouterImageParams): Promise<{ url: string }> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("[OpenRouter] OPENROUTER_API_KEY chưa được cấu hình trong .env");

  const configuredModel = params.model
    ? mapModelName(params.model)
    : (process.env.OPENROUTER_IMAGE_MODEL || DEFAULT_IMAGE_MODEL);

  const allowedRatios = new Set(["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"]);
  const ratioKey = params.aspectRatio && allowedRatios.has(params.aspectRatio) ? params.aspectRatio : "1:1";
  const model = configuredModel === DEFAULT_IMAGE_MODEL && (params.referenceImages?.length || !RECRAFT_ASPECT_RATIOS.has(ratioKey))
    ? IMAGE_EDIT_MODEL
    : configuredModel;
  const finalPrompt = params.preserveInputAspectRatio
    ? params.prompt
    : `${params.prompt}\n\nGenerate the image with a ${ratioKey} aspect ratio.`;

  // Build message content — text prompt + optional reference images
  const content: any[] = [{ type: "text", text: finalPrompt }];
  for (const img of params.referenceImages || []) {
    content.push({ type: "image_url", image_url: { url: img } });
  }

  console.log(`[OpenRouter Image] chat+modalities | model=${model} | promptLen=${params.prompt.length} | aspectRatio=${ratioKey}`);

  try {
    if (model === DEFAULT_IMAGE_MODEL) return await generateRecraftImage(apiKey, params.prompt, ratioKey);
    return await generateImageWithRetries(apiKey, model, content, params.preserveInputAspectRatio ? undefined : ratioKey, 3);
  } catch (error: any) {
    const fallbackModel = getFallbackImageModel();
    if (model === DEFAULT_IMAGE_MODEL || params.allowFallback === false || isNonFallbackableError(error) || fallbackModel === model) throw error;

    console.warn(
      `[OpenRouter Image] Model ${model} thất bại, fallback sang ${fallbackModel}. Lỗi: ${error?.message || error}`
    );
    return await generateImageWithRetries(apiKey, fallbackModel, content, params.preserveInputAspectRatio ? undefined : ratioKey, 2);
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

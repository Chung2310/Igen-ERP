/**
 * OpenRouter Service
 * ──────────────────
 * OpenAI-compatible client trỏ tới https://openrouter.ai/api/v1.
 * Hỗ trợ: chat completions (text + vision), image generation.
 * Khi model chính lỗi hết retry, tự fallback sang model dự phòng
 * (OPENROUTER_FALLBACK_MODEL / OPENROUTER_FALLBACK_IMAGE_MODEL).
 */

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
  messages: OpenRouterMessage[];
  temperature?: number;
  /** Return JSON object (response_format: json_object) */
  jsonMode?: boolean;
  /** Optional JSON schema — injected into system prompt as instruction */
  responseSchema?: object;
  maxRetries?: number;
}

/**
 * Chat completions — text và/hoặc vision (base64 images).
 * Chuỗi fallback 3 tầng:
 *   1. Model chính qua OpenRouter
 *   2. getFallbackModel() qua OpenRouter (mặc định qwen/qwen3.6-flash)
 *   3. FreeLLM server tự host (FREELLM_API_URL) nếu được cấu hình
 */
export async function openrouterChat(params: OpenRouterChatParams): Promise<{ text: string }> {
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

  const jsonRequested = Boolean(jsonMode || responseSchema);

  let lastError: any;

  // Tầng 1 + 2: OpenRouter (model chính → model fallback)
  if (apiKey) {
    try {
      return await chatWithRetries(OPENROUTER_BASE_URL, apiKey, mappedModel, messages, temperature, jsonRequested, maxRetries);
    } catch (error: any) {
      lastError = error;
      const fallbackModel = getFallbackModel();

      if (!isNonFallbackableError(error) && fallbackModel !== mappedModel) {
        console.warn(
          `[OpenRouter] Model ${mappedModel} thất bại sau ${maxRetries} lần thử, fallback sang ${fallbackModel}. Lỗi: ${error?.message || error}`
        );
        try {
          return await chatWithRetries(OPENROUTER_BASE_URL, apiKey, fallbackModel, messages, temperature, jsonRequested, 2);
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
  maxRetries: number
): Promise<{ text: string }> {
  const body: Record<string, any> = {
    model,
    messages,
    temperature,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
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
      const text: string = data.choices?.[0]?.message?.content || "";
      const elapsed = Date.now() - startTime;
      console.log(`[OpenRouter] Success | model=${data.model || model} | ${elapsed}ms | len=${text.length}`);
      return { text };
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
}

/**
 * Image generation qua OpenRouter /chat/completions với modalities: ["image", "text"]
 * Đây là cách chính thức theo OpenRouter SDK — /images endpoint bị geo-block Vietnam.
 * Model chính lỗi hết retry → fallback sang getFallbackImageModel().
 */
export async function openrouterGenerateImage(params: OpenRouterImageParams): Promise<{ url: string }> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("[OpenRouter] OPENROUTER_API_KEY chưa được cấu hình trong .env");

  const model = params.model
    ? mapModelName(params.model)
    : (process.env.OPENROUTER_IMAGE_MODEL || "google/gemini-3.1-flash-image");

  // Map aspect ratio string → pixel dimensions để nhúng vào prompt và image_generation_config
  const ASPECT_RATIO_MAP: Record<string, { width: number; height: number }> = {
    "1:1":  { width: 1024, height: 1024 },
    "16:9": { width: 1344, height: 768 },
    "9:16": { width: 768,  height: 1344 },
    "4:3":  { width: 1152, height: 864 },
    "3:4":  { width: 864,  height: 1152 },
    "3:2":  { width: 1216, height: 832 },
    "2:3":  { width: 832,  height: 1216 },
  };
  const ratioKey = params.aspectRatio || "1:1";
  const dimensions = ASPECT_RATIO_MAP[ratioKey] || ASPECT_RATIO_MAP["1:1"];

  // Build prompt — nhúng aspect ratio instruction vào cuối để model tôn trọng tỉ lệ
  const aspectRatioInstruction = `Generate the image with aspect ratio ${ratioKey} (${dimensions.width}x${dimensions.height} pixels).`;
  const finalPrompt = `${params.prompt}\n\n${aspectRatioInstruction}`;

  // Build message content — text prompt + optional reference images
  const content: any[] = [{ type: "text", text: finalPrompt }];
  for (const img of params.referenceImages || []) {
    content.push({ type: "image_url", image_url: { url: img } });
  }

  console.log(`[OpenRouter Image] chat+modalities | model=${model} | promptLen=${params.prompt.length} | aspectRatio=${ratioKey} | dimensions=${dimensions.width}x${dimensions.height}`);

  try {
    return await generateImageWithRetries(apiKey, model, content, dimensions, 3);
  } catch (error: any) {
    const fallbackModel = getFallbackImageModel();
    if (isNonFallbackableError(error) || fallbackModel === model) throw error;

    console.warn(
      `[OpenRouter Image] Model ${model} thất bại, fallback sang ${fallbackModel}. Lỗi: ${error?.message || error}`
    );
    return await generateImageWithRetries(apiKey, fallbackModel, content, dimensions, 2);
  }
}

async function generateImageWithRetries(
  apiKey: string,
  model: string,
  content: any[],
  dimensions: { width: number; height: number },
  maxAttempts: number
): Promise<{ url: string }> {
  const body: Record<string, any> = {
    model,
    messages: [{ role: "user", content }],
    // Trigger image generation theo cách chính thức của OpenRouter SDK
    modalities: ["image", "text"],
    // Truyền image_generation_config theo chuẩn OpenRouter (một số model hỗ trợ)
    image_generation_config: {
      width: dimensions.width,
      height: dimensions.height,
    },
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
      console.log("[OpenRouter Image Debug] Raw response:", JSON.stringify(data).slice(0, 1000));

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

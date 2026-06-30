/**
 * OpenRouter Service
 * ──────────────────
 * OpenAI-compatible client trỏ tới https://openrouter.ai/api/v1.
 * Hỗ trợ: chat completions (text + vision), image generation.
 */

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

function getApiKey(): string {
  return process.env.OPENROUTER_API_KEY || "";
}

/**
 * Thêm provider prefix nếu chưa có.
 * "gemini-2.5-flash" → "google/gemini-2.5-flash"
 * "claude-opus-4-5"  → "anthropic/claude-opus-4-5"
 */
export function mapModelName(modelName: string): string {
  if (!modelName) return "google/gemini-2.5-flash";
  if (modelName.includes("/")) return modelName; // already namespaced

  if (modelName.startsWith("gemini-")) return `google/${modelName}`;
  if (modelName.startsWith("claude-")) return `anthropic/${modelName}`;

  return modelName;
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
 */
export async function openrouterChat(params: OpenRouterChatParams): Promise<{ text: string }> {
  const { model, temperature = 0.7, jsonMode, responseSchema, maxRetries = 4 } = params;
  const apiKey = getApiKey();

  if (!apiKey) {
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

  const body: Record<string, any> = {
    model: mappedModel,
    messages,
    temperature,
  };

  if (jsonMode || responseSchema) {
    body.response_format = { type: "json_object" };
  }

  let lastError: any;
  let delay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      console.log(`[OpenRouter] POST /chat/completions | model=${mappedModel} | attempt=${attempt}`);

      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.APP_URL || "https://igen-erp.app",
          "X-Title": "Igen ERP",
        },
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
      console.log(`[OpenRouter] Success | model=${data.model || mappedModel} | ${elapsed}ms | len=${text.length}`);
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
 * Image generation qua OpenRouter endpoint /api/v1/images
 * Đây là endpoint riêng của OpenRouter, khác với /chat/completions và /images/generations
 */
export async function openrouterGenerateImage(params: OpenRouterImageParams): Promise<{ url: string }> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("[OpenRouter] OPENROUTER_API_KEY chưa được cấu hình trong .env");

  const model = params.model
    ? mapModelName(params.model)
    : (process.env.OPENROUTER_IMAGE_MODEL || "google/gemini-3.1-flash-image");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": process.env.APP_URL || "https://igen-erp.app",
    "X-Title": "Igen ERP",
  };

  console.log(`[OpenRouter Image] /images | model=${model} | promptLen=${params.prompt.length}`);

  const body: Record<string, any> = {
    model,
    prompt: params.prompt,
    n: 1,
    quality: "auto",
    // Google AI Studio bị chặn ở Vietnam — force dùng Google Vertex AI
    provider: {
      ignore: ["Google AI Studio"],
    },
  };

  if (params.aspectRatio) body.aspect_ratio = params.aspectRatio;
  if (params.resolution) body.resolution = params.resolution;
  if (params.referenceImages?.length) {
    body.input_references = params.referenceImages.map((url) => ({ url }));
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/images`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`[OpenRouter] Image generation lỗi ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as any;
  console.log("[OpenRouter Image Debug] Raw response:", JSON.stringify(data).slice(0, 500));

  const item = data.data?.[0];
  if (!item) throw new Error("[OpenRouter] Image generation không trả về data.");

  if (item.url) return { url: item.url };
  if (item.b64_json) return { url: `data:image/png;base64,${item.b64_json}` };

  throw new Error("[OpenRouter] Image generation không trả về URL hoặc base64.");
}

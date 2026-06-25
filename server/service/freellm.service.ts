/**
 * FreeLLM Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Wrapper gọi API LLM miễn phí (OpenAI-compatible) của chủ dự án.
 * Config lấy từ biến môi trường:
 *   FREELLM_API_KEY   — Bearer token xác thực
 *   FREELLM_API_URL   — Base URL (ví dụ: https://chat.chungxanhla.name.vn/v1)
 *   FREELLM_API_MODEL — Tên model, mặc định "auto"
 *
 * Interface tương thích OpenAI Chat Completions (/v1/chat/completions).
 */

export interface FreeLLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface FreeLLMChatOptions {
  /** Override model, mặc định lấy từ FREELLM_API_MODEL env */
  model?: string;
  /** Nhiệt độ sáng tạo 0-2, mặc định 0.7 */
  temperature?: number;
  /** Số token tối đa output */
  maxTokens?: number;
  /** Yêu cầu trả về JSON object */
  jsonMode?: boolean;
  /** System prompt tuỳ chỉnh */
  systemPrompt?: string;
}

export interface FreeLLMChatResult {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function getFreeLLMConfig() {
  const apiKey = process.env.FREELLM_API_KEY || "";
  const apiUrl = String(process.env.FREELLM_API_URL || "https://chat.chungxanhla.name.vn/v1").replace(/\/$/, "");
  const model = process.env.FREELLM_API_MODEL || "auto";
  return { apiKey, apiUrl, model };
}

/**
 * Kiểm tra xem FreeLLM API có được cấu hình không.
 */
export function isFreeLLMConfigured(): boolean {
  return Boolean(process.env.FREELLM_API_KEY);
}

/**
 * Gửi một cuộc trò chuyện đến FreeLLM API và nhận câu trả lời.
 */
export async function freeLLMChat(
  messages: FreeLLMMessage[],
  options: FreeLLMChatOptions = {}
): Promise<FreeLLMChatResult> {
  const { apiKey, apiUrl, model: defaultModel } = getFreeLLMConfig();

  if (!apiKey) {
    throw new Error("[FreeLLM] FREELLM_API_KEY chưa được cấu hình trong .env");
  }

  const model = options.model || defaultModel;
  const allMessages: FreeLLMMessage[] = [];

  if (options.systemPrompt) {
    allMessages.push({ role: "system", content: options.systemPrompt });
  }
  allMessages.push(...messages);

  const body: Record<string, any> = {
    model,
    messages: allMessages,
    temperature: options.temperature ?? 0.7,
  };

  if (options.maxTokens) {
    body.max_tokens = options.maxTokens;
  }

  if (options.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  console.log(`[FreeLLM] POST ${apiUrl}/chat/completions | model=${model} | msgs=${allMessages.length}`);

  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[FreeLLM] API error ${response.status}:`, errText);
    throw new Error(`FreeLLM API lỗi ${response.status}: ${errText}`);
  }

  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content || "";
  const usedModel = data.model || model;
  const usage = data.usage;

  console.log(`[FreeLLM] Success | model=${usedModel} | tokens=${usage?.total_tokens ?? "?"}`);

  return { content, model: usedModel, usage };
}

/**
 * Gửi một prompt đơn giản (single-turn) đến FreeLLM API.
 * Tiện ích rút gọn cho các use-case không cần multi-turn.
 */
export async function freeLLMComplete(
  prompt: string,
  options: FreeLLMChatOptions = {}
): Promise<string> {
  const result = await freeLLMChat([{ role: "user", content: prompt }], options);
  return result.content;
}

/**
 * Gọi FreeLLM với yêu cầu trả về JSON, tự parse và trả về object.
 * Throws nếu response không phải JSON hợp lệ.
 */
export async function freeLLMJson<T = any>(
  prompt: string,
  options: FreeLLMChatOptions = {}
): Promise<T> {
  const result = await freeLLMChat(
    [{ role: "user", content: prompt }],
    { ...options, jsonMode: true }
  );

  let cleaned = result.content.trim();
  // Strip markdown code fences nếu có
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`[FreeLLM] Phản hồi không phải JSON hợp lệ: ${cleaned.slice(0, 300)}`);
  }
}

export const freeLLMService = {
  isConfigured: isFreeLLMConfigured,
  chat: freeLLMChat,
  complete: freeLLMComplete,
  json: freeLLMJson,

  /**
   * Tối ưu prompt tiếng Việt → prompt tiếng Anh chuyên nghiệp cho AI video/image
   */
  async optimizePrompt(vietnamesePrompt: string): Promise<string> {
    return freeLLMComplete(
      `Translate and optimize the following Vietnamese creative prompt into a professional English prompt suitable for AI video/image generation. Return ONLY the optimized English prompt, no explanation:\n\n"${vietnamesePrompt}"`,
      { temperature: 0.3, maxTokens: 500 }
    );
  },

  /**
   * Phân tích và tóm tắt nội dung văn bản (tiếng Việt)
   */
  async summarize(text: string, maxWords = 150): Promise<string> {
    return freeLLMComplete(
      `Tóm tắt đoạn nội dung sau trong tối đa ${maxWords} từ bằng tiếng Việt, giữ nguyên ý chính:\n\n${text}`,
      { temperature: 0.4, maxTokens: maxWords * 5 }
    );
  },

  /**
   * Sinh nội dung marketing (caption, tiêu đề bài đăng, v.v.)
   */
  async generateMarketingContent(params: {
    topic: string;
    platform: "facebook" | "instagram" | "tiktok" | "zalo" | "general";
    tone?: "professional" | "friendly" | "humorous" | "inspirational";
    language?: "vi" | "en";
  }): Promise<{ title: string; content: string; hashtags: string[] }> {
    const { topic, platform, tone = "friendly", language = "vi" } = params;
    const langLabel = language === "vi" ? "tiếng Việt" : "English";

    return freeLLMJson<{ title: string; content: string; hashtags: string[] }>(
      `Tạo nội dung ${platform.toUpperCase()} về chủ đề: "${topic}".
Phong cách: ${tone}. Ngôn ngữ: ${langLabel}.
Trả về JSON với cấu trúc:
{
  "title": "Tiêu đề bắt mắt",
  "content": "Nội dung bài đăng đầy đủ",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}`,
      { temperature: 0.8, maxTokens: 1000 }
    );
  },

  /**
   * Trả lời câu hỏi dựa trên ngữ cảnh cho trước (RAG-style)
   */
  async answerWithContext(question: string, context: string): Promise<string> {
    return freeLLMComplete(
      `Dựa vào ngữ cảnh sau đây, hãy trả lời câu hỏi bằng tiếng Việt một cách ngắn gọn và chính xác.

Ngữ cảnh:
${context}

Câu hỏi: ${question}`,
      { temperature: 0.2, maxTokens: 800 }
    );
  },
};

import type { AssistantReply } from "./assistantService";

export interface ChatbotRequestOptions {
  token?: string | null;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function requestChatbot(
  messages: Array<{ role: string; content: string }>,
  options: ChatbotRequestOptions = {},
): Promise<AssistantReply> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000);
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl("/api/v1/chatbot/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: JSON.stringify({ messages }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !data.reply) {
      throw Object.assign(new Error(data.message || data.error || "Không nhận được phản hồi từ trợ lý ảo."), { code: data.code, status: response.status, resetAt: data.resetAt });
    }
    return {
      reply: data.reply,
      citations: Array.isArray(data.citations) ? data.citations : [],
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
      queriedAt: data.queriedAt || new Date().toISOString(),
    };
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new Error("Phản hồi mất quá nhiều thời gian. Vui lòng thử lại.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

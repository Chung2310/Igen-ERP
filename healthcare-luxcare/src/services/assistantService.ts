export interface AssistantCitation {
  id: string;
  sourceType: "knowledge" | "database";
  title: string;
  scope?: string;
  updatedAt?: string;
  queriedAt?: string;
  documentId?: string;
  chunkIndex?: number;
  revision?: string;
  url?: string;
}
export interface AssistantReply {
  status?: "answered" | "partial" | "insufficient_evidence" | "not_found";
  reply: string;
  citations: AssistantCitation[];
  suggestions: string[];
  queriedAt: string;
}

export async function askAssistant(messages: Array<{ role: string; content: string }>): Promise<AssistantReply> {
  const response = await fetch("/api/v1/chatbot/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
    },
    body: JSON.stringify({ messages }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success || !data.reply)
    throw new Error(data.message || "Không nhận được phản hồi từ trợ lý.");
  return {
    status: data.status,
    reply: data.reply,
    citations: Array.isArray(data.citations) ? data.citations : [],
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    queriedAt: data.queriedAt || new Date().toISOString(),
  };
}

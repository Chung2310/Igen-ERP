export type AgentChatMessage = { role: "user" | "assistant"; content: string; attachmentName?: string; attachmentText?: string };
export type AgentKnowledge = { title: string; kind: "text" | "link" | "file"; content: string };
export type UserAssistantAgent = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  avoid: string;
  tone: string;
  avatar: number;
  favorite: boolean;
  openingQuestions: string[];
  knowledge: Array<AgentKnowledge & { id: string; createdAt: string }>;
};
export type UserAssistantAgentInput = Omit<UserAssistantAgent, "id">;

async function agentRequest<T>(path: string, init: RequestInit): Promise<T> {
  const token = localStorage.getItem("accessToken");
  const response = await fetch(`/api/v1/chatbot/agents${path}`, {
    ...init,
    headers: { ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw new Error(result.message || "Không thể kết nối trợ lý AI.");
  return result.data as T;
}

export const assistantAgentService = {
  listAgents: async () => (await agentRequest<{ agents: UserAssistantAgent[] }>("", { method: "GET" })).agents,
  createAgent: async (agent: UserAssistantAgent) => agentRequest<UserAssistantAgent>("", { method: "POST", body: JSON.stringify(agent) }),
  updateAgent: (id: string, agent: UserAssistantAgentInput) => agentRequest<UserAssistantAgent>(`/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(agent) }),
  setAgentFavorite: (id: string, favorite: boolean) => agentRequest<UserAssistantAgent>(`/${encodeURIComponent(id)}/favorite`, { method: "PATCH", body: JSON.stringify({ favorite }) }),
  deleteAgent: (id: string) => agentRequest<{ id: string }>(`/${encodeURIComponent(id)}`, { method: "DELETE" }),
  extractFile: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return agentRequest<{ fileName: string; text: string }>("/extract", { method: "POST", body: form });
  },
  extractLink: (url: string) => agentRequest<{ url: string; title: string; text: string }>("/extract-link", { method: "POST", body: JSON.stringify({ url }) }),
  chat: (agent: { instructions: string; avoid: string; tone: string; knowledge: AgentKnowledge[] }, messages: AgentChatMessage[]) =>
    agentRequest<{ reply: string }>("/chat", { method: "POST", body: JSON.stringify({ ...agent, knowledge: agent.knowledge.map(({ title, kind, content }) => ({ title, kind, content })), messages: messages.slice(-20).map(message => ({ role: message.role, content: `${message.content}${message.attachmentText ? `\n\nTài liệu đính kèm (${message.attachmentName || "tài liệu"}):\n${message.attachmentText}` : ""}`.slice(0, 12000) })) }) }),
};

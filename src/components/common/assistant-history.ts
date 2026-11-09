import type { AssistantConversationSummary } from "../../services/assistantService";

export type AssistantHistoryCategory = "qa" | "work" | "studio" | "notebook" | "meeting" | "tools";

export const assistantHistoryCategories: { value: AssistantHistoryCategory; label: string }[] = [
  { value: "qa", label: "Trò chuyện" },
  { value: "work", label: "Thao tác" },
  { value: "studio", label: "AI Studio" },
  { value: "notebook", label: "Notebook" },
  { value: "meeting", label: "Ghi chép" },
  { value: "tools", label: "Công cụ" },
];

export function filterAssistantHistory(conversations: AssistantConversationSummary[], category: AssistantHistoryCategory) {
  if (category !== "qa" && category !== "work") return [];
  return conversations.filter(conversation => (conversation.mode === "qa" ? "qa" : "work") === category);
}

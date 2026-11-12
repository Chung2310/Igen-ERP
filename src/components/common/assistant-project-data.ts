import type { AssistantConversationSummary } from "../../services/assistantService";

export type ProjectIcon = "folder" | "globe" | "heart" | "chart" | "pen" | "file" | "book" | "briefcase" | "calendar" | "code" | "image" | "music" | "video" | "bulb" | "rocket" | "target" | "users" | "chat" | "shield" | "puzzle" | "leaf" | "gear" | "star" | "flag" | "building" | "layers" | "link" | "compass";
export type ProjectTone = "primary" | "secondary" | "tertiary" | "error";

export interface AssistantProjectConversation {
  id: string;
  title: string;
  preview: string;
  createdAt: string;
  sourceConversationId?: string;
  sourceMode?: "work" | "qa";
}

export interface AssistantProjectFile {
  id: string;
  name: string;
  size: number;
  updatedAt: string;
}

export interface AssistantProject {
  id: string;
  name: string;
  icon: ProjectIcon;
  tone: ProjectTone;
  favorite: boolean;
  instructions: string;
  model: "iGenAI";
  conversations: AssistantProjectConversation[];
  files: AssistantProjectFile[];
  createdAt: string;
}

export function readAssistantProjects(key: string): AssistantProject[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is AssistantProject =>
      Boolean(item && typeof item === "object" && typeof item.id === "string" && typeof item.name === "string")
    ).map(item => ({ ...item, conversations: Array.isArray(item.conversations) ? item.conversations : [], files: Array.isArray(item.files) ? item.files : [] }));
  } catch { return []; }
}

export function saveAssistantProjects(key: string, projects: AssistantProject[]) {
  try { localStorage.setItem(key, JSON.stringify(projects)); } catch { /* Keep the current session usable when browser storage is full. */ }
}
export function moveAssistantConversationToProject(projects: AssistantProject[], conversation: AssistantConversationSummary, projectId: string): AssistantProject[] {
  return projects.map(project => {
    const existing = project.conversations.find(item => item.sourceConversationId === conversation.conversationId);
    const remaining = project.conversations.filter(item => item.sourceConversationId !== conversation.conversationId);
    return project.id === projectId ? {
      ...project,
      conversations: [{
        id: existing?.id ?? crypto.randomUUID(),
        title: conversation.title || "Cuộc hội thoại",
        preview: conversation.preview,
        createdAt: conversation.updatedAt,
        sourceConversationId: conversation.conversationId,
        sourceMode: conversation.mode ?? "qa",
      }, ...remaining],
    } : { ...project, conversations: remaining };
  });
}

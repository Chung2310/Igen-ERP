export type AssistantMindmapLocale = "vi" | "en" | "ja";
export type AssistantMindmapWriteMode = "ai" | "preserve";
export type AssistantMindmapSourceType = "text" | "document" | "link";

export interface AssistantMindmapNode {
  label: string;
  detail: string;
  children: AssistantMindmapNode[];
}

export interface AssistantMindmapResult {
  id: string;
  title: string;
  subtitle: string;
  root: AssistantMindmapNode;
  sourceFileName: string;
  prompt: string;
  locale: AssistantMindmapLocale;
  createdAt: string;
}

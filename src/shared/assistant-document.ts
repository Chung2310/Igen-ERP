export const assistantDocumentFormats = ["xlsx", "csv", "docx", "pdf", "txt", "md", "json"] as const;
export type AssistantDocumentFormat = typeof assistantDocumentFormats[number];

export interface AssistantGeneratedFile {
  id: string;
  documentId: string;
  conversationId: string;
  version: number;
  fileName: string;
  format: AssistantDocumentFormat;
  mimeType: string;
  size: number;
}

export interface AssistantChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  files?: AssistantGeneratedFile[];
}

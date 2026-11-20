export interface KnowledgeProgress {
  stage: "reading" | "ocr" | "chunking" | "embedding" | "publishing" | "complete";
  completed?: number;
  total?: number;
  unit?: "pages" | "chunks";
  updatedAt?: string;
}
export type ReportKnowledgeProgress = (progress: KnowledgeProgress) => Promise<void>;

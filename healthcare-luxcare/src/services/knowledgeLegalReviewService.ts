import { getAccessToken } from "./authService";

export interface KnowledgeLegalReview {
  id: string;
  documentId: string;
  documentTitle: string;
  legalDocumentId: string;
  legalNumber: string;
  status: string;
  state: string;
  matchKind: string;
  sample?: string;
  matchedChunkIndexes: number[];
  relation?: "copy" | "reference";
  scope: "document" | "chunks";
  chunkIndexes: number[];
  sectionKeys: string[];
  sectionChoices: string[];
  legalAvailable: boolean;
  knowledgeRevision: string;
  legalFingerprint: string;
  reviewVersion: string;
  history: { action: string; actor: string; at: string; note?: string }[];
}
export interface KnowledgeLegalReviewList {
  canManage: boolean;
  documents: { id: string; title: string }[];
  laws: { id: string; number: string; title: string }[];
  reviews: KnowledgeLegalReview[];
}
export interface KnowledgeLegalReviewDetail {
  id: string;
  title: string;
  revision: string;
  chunks: { chunkIndex: number; text: string }[];
}
export async function knowledgeLegalReviewRequest<T>(path = "", body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/knowledge-legal-reviews${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${getAccessToken()}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Không thể xử lý rà soát pháp lý.");
  return result;
}

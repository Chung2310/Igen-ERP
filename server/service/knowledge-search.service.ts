import { KnowledgeChunkModel } from "../model/knowledge.model";
import { cosineSimilarity, embedText, tokenize } from "./knowledge-embedding";

export interface KnowledgeHit { text: string; title: string; url: string; score: number; documentId: string }

function overlapScore(query: string[], text: string): number {
  if (!query.length) return 0;
  const tokens = new Set(tokenize(text));
  return query.filter((token) => tokens.has(token)).length / query.length;
}

export const knowledgeSearchService = {
  async search(input: { companyCode: string; user: { id: string; role: string }; query: string; topK?: number }): Promise<KnowledgeHit[]> {
    const chunks = await (KnowledgeChunkModel.find({
      companyCode: input.companyCode,
      $or: [{ visibility: "company" }, { allowedUserIds: input.user.id }, { allowedRoles: input.user.role }],
    }) as any).sort({ updatedAt: -1 }).limit(5000);
    const queryEmbedding = embedText(input.query);
    const queryTokens = tokenize(input.query);
    return (chunks as any[]).map((chunk) => {
      const document = chunk.documentId && typeof chunk.documentId === "object" ? chunk.documentId : {};
      const title = String(document.sourceTitle || chunk.sourceTitle || "Tài liệu nội bộ");
      const lexical = overlapScore(queryTokens, chunk.text);
      const titleBoost = overlapScore(queryTokens, title);
      const loose = input.query && String(chunk.text).toLowerCase().includes(input.query.toLowerCase()) ? 1 : 0;
      return { text: chunk.text, title, url: String(document.sourceUrl || chunk.sourceUrl || ""), documentId: String(document._id || chunk.documentId), score: cosineSimilarity(queryEmbedding, chunk.embedding) + lexical * .9 + titleBoost * .6 + loose * .7 };
    }).sort((left, right) => right.score - left.score).slice(0, input.topK ?? 5);
  },
};

export function formatKnowledgeCitations(hits: KnowledgeHit[]): string {
  if (!hits.length) return "Không tìm thấy tài liệu nội bộ phù hợp với câu hỏi của bạn.";
  return hits.map((hit, index) => `${index + 1}. ${hit.title}\n${hit.text}${hit.url ? `\nNguồn: ${hit.url}` : ""}`).join("\n\n");
}

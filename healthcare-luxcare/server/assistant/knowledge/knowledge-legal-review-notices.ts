import { rankKnowledgeChunks, type RankableKnowledgeChunk } from "./knowledge-chunking";
import type { KnowledgeLegalMask } from "./knowledge-legal-review-retrieval";

/** Rank review state as well as the old subject, without exposing obsolete wording. */
export function rankReviewAwareCandidates<T extends RankableKnowledgeChunk & { chunkIndex: number }>(
  query: string,
  candidates: T[],
  masks: Map<string, KnowledgeLegalMask>,
) {
  const original = rankKnowledgeChunks(query, candidates);
  const notices = candidates.flatMap((candidate) => {
    const mask = masks.get(candidate.documentId!);
    if (!mask || (!mask.all && !mask.chunks.has(candidate.chunkIndex))) return [];
    return [{
      ...candidate,
      text: `Tài liệu nội bộ “${candidate.title}” cần rà soát: ${mask.reasons.join("; ")}. Đoạn chịu ảnh hưởng đang tạm ngừng dùng làm căn cứ trả lời. Cần đối chiếu nguồn pháp lý chung và cập nhật tài liệu trước khi sử dụng lại.`,
      legalReviewNotice: true,
    }];
  });
  const rankedNotices = new Map(rankKnowledgeChunks(query, notices).map((notice) => [notice.id, notice]));
  return original.map((candidate) => {
    const notice = rankedNotices.get(candidate.id);
    return notice ? { ...notice, score: Math.max(candidate.score, notice.score) } : candidate;
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

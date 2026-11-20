import { knowledgeTokens, rankKnowledgeChunks, type RankableKnowledgeChunk } from "./knowledge-chunking";

/** A passage may answer one question without covering all words in a multi-question request. */
export function rankKnowledgeQuestionParts<T extends RankableKnowledgeChunk>(query: string, chunks: T[]) {
  const questions = [...query.matchAll(/([^?;\n]+)[?;]/g)]
    .map((match) => match[1].trim())
    .filter((part) => knowledgeTokens(part).length >= 3)
    .slice(0, 4);
  const ranked = rankKnowledgeChunks(query, chunks);
  if (questions.length < 2) return ranked;
  const scores = new Map(ranked.map((item) => [item.id, item.score]));
  for (const question of questions) {
    for (const item of rankKnowledgeChunks(question, chunks)) {
      scores.set(item.id, Math.max(scores.get(item.id) || 0, item.score));
    }
  }
  return ranked
    .map((item) => ({ ...item, score: scores.get(item.id)! }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

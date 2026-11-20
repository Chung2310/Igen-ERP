import KnowledgeChunk from '../models/KnowledgeChunk.js';
import KnowledgeDocument from '../models/KnowledgeDocument.js';
import { cosineSimilarity, embedText, embedTextBillable } from './embeddingProvider.js';
import type { AiBillingContext } from './creditTypes.js';
import type { PipelineStage } from 'mongoose';
import { APP_POLICY } from '../config/env.js';

export interface VectorFilters {
  status?: 'PUBLISHED';
  topic?: string;
}

export interface VectorHit {
  documentId: string;
  title?: string;
  topic: string;
  content: string;
  score: number;
}

function normalizeWord(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Tính điểm khớp từ khóa (Keyword match score) để kết hợp với vector score (Hybrid Search)
 */
function calculateKeywordBoost(query: string, content: string, title?: string): number {
  const queryWords = query
    .split(/\s+/)
    .map(normalizeWord)
    .filter((w) => w.length >= 2);

  if (queryWords.length === 0) return 0;

  const targetText = `${title || ''} ${content}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  let matches = 0;

  for (const word of queryWords) {
    if (targetText.includes(word)) {
      matches += 1;
    }
  }

  // Tăng điểm cộng nếu xuất hiện từ khóa đặc thù (tối đa +0.5)
  return Math.min(0.5, (matches / queryWords.length) * 0.4);
}

export function searchVectors(context: AiBillingContext, query: string, filters: VectorFilters, limit: number): Promise<VectorHit[]>;
export function searchVectors(query: string, filters: VectorFilters, limit: number): Promise<VectorHit[]>;
export async function searchVectors(
  context: AiBillingContext | string,
  queryOrFilters: string | VectorFilters,
  filtersOrLimit: VectorFilters | number,
  maybeLimit?: number
): Promise<VectorHit[]> {
  const billed = typeof context !== 'string';
  const query = (billed ? queryOrFilters : context) as string;
  const filters = (billed ? filtersOrLimit : queryOrFilters) as VectorFilters;
  const limit = (billed ? maybeLimit : filtersOrLimit) as number;
  const mode = process.env.NODE_ENV === 'production' ? 'atlas' : 'local';

  const queryVector = billed ? await embedTextBillable(context as AiBillingContext, query) : embedText(query);

  if (mode === 'atlas') {
    const index = APP_POLICY.VECTOR_SEARCH_INDEX;
    try {
      const pipeline: PipelineStage[] = [
        {
          $vectorSearch: {
            index,
            path: 'embedding',
            queryVector,
            numCandidates: Math.max(limit * 10, 50),
            limit,
          },
        },
        { $lookup: { from: 'knowledgedocuments', localField: 'documentId', foreignField: '_id', as: 'document' } },
        { $unwind: '$document' },
        { $match: { 'document.status': filters.status || 'PUBLISHED', ...(filters.topic ? { topic: filters.topic } : {}) } },
        {
          $project: {
            documentId: { $toString: '$documentId' },
            title: '$document.title',
            topic: 1,
            content: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ];
      const results = await KnowledgeChunk.aggregate<VectorHit>(pipeline);
      if (results.length > 0) return results;
    } catch {
      // Fallback xuống in-memory hybrid search nếu atlas index chưa được tạo
    }
  }

  // Chế độ Local / Fallback Hybrid Search (Cosine Vector + Keyword Matching)
  const chunks = await KnowledgeChunk.find({
    embedding: { $exists: true, $ne: [] },
    ...(filters.topic ? { topic: filters.topic } : {}),
  }).lean();

  if (chunks.length === 0) return [];

  const documentIds = [...new Set(chunks.map((chunk) => String(chunk.documentId)))];
  const docs = await KnowledgeDocument.find({
    _id: { $in: documentIds },
    status: filters.status || 'PUBLISHED',
  }).lean();

  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));

  return chunks
    .flatMap((chunk) => {
      const doc = byId.get(String(chunk.documentId));
      if (!doc) return [];

      const vectorScore = cosineSimilarity(queryVector, chunk.embedding);
      const keywordBoost = calculateKeywordBoost(query, chunk.content, doc.title);
      const totalScore = vectorScore + keywordBoost;

      return [
        {
          documentId: String(doc._id),
          title: doc.title,
          topic: chunk.topic,
          content: chunk.content,
          score: totalScore,
        },
      ];
    })
    .filter((hit) => hit.score > 0.05)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

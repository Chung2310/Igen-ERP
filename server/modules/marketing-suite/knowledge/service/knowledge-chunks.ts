import type { Types } from "mongoose";
import type { IAIKnowledgeDocument } from "../model/ai-knowledge.model.ts";

type DocumentSnapshot = { _id: Types.ObjectId; chunkSetId?: Types.ObjectId | null };
type ChunkSnapshot = { documentId: Types.ObjectId };

export function activeChunkSetIds(documents: DocumentSnapshot[]) {
  return documents.map(document => document.chunkSetId || document._id);
}

/** Resolve physical revisions back to stable document IDs and discard obsolete revisions. */
export function mapActiveKnowledgeChunks<T extends ChunkSnapshot>(chunks: T[], documents: DocumentSnapshot[]) {
  const active = new Map(documents.map(document => [String(document.chunkSetId || document._id), document._id]));
  return chunks.filter(chunk => active.has(String(chunk.documentId)))
    .map(chunk => ({ ...chunk, documentId: active.get(String(chunk.documentId))! }));
}

export function knowledgeUsageFilter(channel: IAIKnowledgeDocument["channelScope"][number], purpose: IAIKnowledgeDocument["purposeScope"][number], pageId?: string) {
  const channels: IAIKnowledgeDocument["channelScope"] = ["all", channel];
  const purposes: IAIKnowledgeDocument["purposeScope"] = ["all", purpose];
  return { $and: [
    { $or: [{ channelScope: { $in: channels } }, { channelScope: { $exists: false } }] },
    { $or: [{ purposeScope: { $in: purposes } }, { purposeScope: { $exists: false } }] },
    { $or: [
      { pageScope: "all" as const }, { pageScope: { $exists: false } },
      ...(pageId ? [{ pageScope: "selected" as const, pageIds: pageId }] : []),
    ] },
  ] };
}

export function allDocumentChunkSets(documentIds: Types.ObjectId[]) {
  return { $or: [{ documentId: { $in: documentIds } }, { sourceDocumentId: { $in: documentIds } }] };
}

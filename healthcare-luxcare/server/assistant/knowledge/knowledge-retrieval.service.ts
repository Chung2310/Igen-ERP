import { logger } from "../../config/logger";
import { retainMedicalAuditReviews } from "./medical-audit-review";
import type { KnowledgeExtractionQuality, KnowledgeWorkbook } from "../../../shared/knowledge-extraction";
import crypto from "node:crypto";
import type { ReportKnowledgeProgress } from "../../../shared/knowledge-progress";
import {
  AssistantKnowledgeChunkModel,
  AssistantKnowledgeDocumentModel,
  KnowledgeRevisionChunkModel,
} from "../../model/assistant-knowledge.model";
import type { AssistantAccessContext, AssistantEvidence } from "../assistant.types";
import {
  chunkKnowledgeText,
  cosine,
  knowledgeTokens,
  normalizeKnowledgeText,
  selectKnowledgeEvidence,
  type RankableKnowledgeChunk,
} from "./knowledge-chunking";
import { getKnowledgeEmbeddingProvider } from "./knowledge-embedding.service";
import { rerankKnowledgeCandidates } from "./knowledge-reranking.service";
import { filterResourceDocuments, knowledgeAccessFilter } from "./knowledge-access";
import { getKnowledgeLegalReviewMasks, reviewAsOf } from "./knowledge-legal-review-retrieval";
import { rankReviewAwareCandidates } from "./knowledge-legal-review-notices";
import { expandKnowledgeQuery, knowledgeEvidenceBudget } from "./knowledge-query-plan";
import { knowledgeReferences, referencePartners, selectReferenceEvidence } from "./knowledge-references";

export interface KnowledgeInput {
  extractionQuality?: KnowledgeExtractionQuality;
  workbook?: KnowledgeWorkbook;
  onProgress?: ReportKnowledgeProgress;
  companyCode: string;
  title: string;
  text: string;
  sourceType: "manual" | "resource";
  createdBy: string;
  resourceId?: string;
  documentType?: string;
  category?: string;
  documentId?: string;
  visibility?: "company" | "restricted";
  branchIds?: string[];
  departmentIds?: string[];
  force?: boolean;
  sourceFileId?: string;
  replaces?: string;
  effectiveFrom?: Date | string;
  effectiveTo?: Date | string;
  auditFlags?: any[];
  auditStatus?: "clean" | "flagged" | "verified";
}
export async function upsertKnowledgeDocument(input: KnowledgeInput) {
  const companyCode = input.companyCode.trim().toUpperCase();
  const contentHash = crypto.createHash("sha256").update(normalizeKnowledgeText(input.text)).digest("hex");
  const identityKey = input.resourceId ? `resource:${input.resourceId}` : `text:${contentHash}`;
  const selector = input.documentId ? { companyCode, _id: input.documentId } : { companyCode, identityKey };
  let existing = await AssistantKnowledgeDocumentModel.findOne(selector);
  if (!existing && input.documentId) throw new Error("Tài liệu đã bị gỡ.");
  if (!existing) {
    try {
      existing = await AssistantKnowledgeDocumentModel.findOneAndUpdate(
        selector,
        {
          $setOnInsert: {
            companyCode,
            identityKey,
            title: input.title,
            contentHash,
            sourceType: input.sourceType,
            resourceId: input.resourceId,
            createdBy: input.createdBy,
            status: "failed",
            indexingStatus: "queued",
            documentType: input.documentType || "general",
            category: input.category || "",
            visibility: input.visibility || "company",
            branchIds: input.branchIds || [],
            departmentIds: input.departmentIds || [],
            replaces: input.replaces,
            effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
            effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : undefined,
            auditFlags: input.auditFlags || [],
            auditStatus: input.auditStatus || "clean",
          },
        },
        { returnDocument: "after", upsert: true },
      );
    } catch (error: any) {
      if (error.code !== 11000) throw error;
      existing = await AssistantKnowledgeDocumentModel.findOne(selector);
    }
  }
  if (!existing) throw new Error("Không thể tạo tài liệu.");
  if (!input.force && existing.status === "active" && existing.contentHash === contentHash && existing.activeRevision) {
    await AssistantKnowledgeDocumentModel.updateOne(
      { _id: existing._id, companyCode },
      { $set: { indexingStatus: "indexed", indexingError: "" } },
    );
    return { document: existing, duplicate: true, chunksCount: existing.chunksCount || 0 };
  }
  const token = crypto.randomUUID();
  const lock = await AssistantKnowledgeDocumentModel.findOneAndUpdate(
    { _id: existing._id, companyCode, $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: new Date() } }] },
    {
      $set: {
        processingToken: token,
        leaseUntil: new Date(Date.now() + 120_000),
        indexingStatus: "processing",
        indexingError: "",
      },
    },
    { returnDocument: "after" },
  );
  if (!lock) throw new Error("Tài liệu đang được lập chỉ mục. Hệ thống sẽ thử lại.");
  const heartbeat = setInterval(() => {
    void AssistantKnowledgeDocumentModel.updateOne(
      { _id: existing!._id, companyCode, processingToken: token },
      { $set: { leaseUntil: new Date(Date.now() + 120_000) } },
    ).catch(() => undefined);
  }, 30_000);
  heartbeat.unref();
  try {
    await input.onProgress?.({ stage: "chunking" });
    const chunks = chunkKnowledgeText(input.text, { title: input.title });
    if (!chunks.length) throw new Error("Tài liệu không có nội dung.");
    const provider = getKnowledgeEmbeddingProvider();
    if (provider) await input.onProgress?.({ stage: "embedding", completed: 0, total: chunks.length, unit: "chunks" });
    const vectors = provider
      ? await provider.embed(
          chunks,
          "search_document",
          input.onProgress
            ? async (completed, total) => input.onProgress!({ stage: "embedding", completed, total, unit: "chunks" })
            : undefined,
        )
      : [];
    await input.onProgress?.({ stage: "publishing" });
    await KnowledgeRevisionChunkModel.insertMany(
      chunks.map((text, chunkIndex) => ({
        companyCode,
        documentId: existing!._id,
        revision: token,
        chunkIndex,
        title: input.title,
        text,
        searchTokens: [...new Set(knowledgeTokens(`${input.title} ${text}`))],
        embedding: vectors[chunkIndex],
        embeddingModel: provider?.model,
      })),
    );
    // Publish only after every chunk is durable. CAS prevents an expired worker from publishing.
    const document = await AssistantKnowledgeDocumentModel.findOneAndUpdate(
      { _id: existing._id, companyCode, processingToken: token, leaseUntil: { $gt: new Date() } },
      {
        $set: {
          activeRevision: token,
          title: input.title,
          contentHash,
          status: "active",
          indexingStatus: "indexed",
          chunksCount: chunks.length,
          extractionQuality: input.extractionQuality || null,
          workbook: input.workbook || null,
          version: Number(existing.version || 0) + 1,
          ...(input.sourceFileId ? { sourceFileId: input.sourceFileId } : {}),
          ...(input.replaces ? { replaces: input.replaces } : {}),
          ...(input.effectiveFrom ? { effectiveFrom: new Date(input.effectiveFrom) } : {}),
          ...(input.effectiveTo ? { effectiveTo: new Date(input.effectiveTo) } : {}),
          ...(input.auditFlags && input.auditStatus
            ? retainMedicalAuditReviews(existing, contentHash, input.auditFlags, input.auditStatus)
            : {}),
        },
        $unset: { processingToken: 1, leaseUntil: 1, indexingError: 1 },
      },
      { returnDocument: "after" },
    );
    if (!document) throw new Error("Phiên lập chỉ mục đã hết hạn hoặc tài liệu đã bị gỡ.");
    if (input.replaces) {
      await AssistantKnowledgeDocumentModel.updateOne(
        { _id: input.replaces, companyCode },
        { $set: { status: "superseded", supersededBy: document._id } },
      );
    }
    return { document, chunksCount: chunks.length, duplicate: false };
  } catch (error) {
    await AssistantKnowledgeDocumentModel.updateOne(
      { _id: existing._id, companyCode, processingToken: token },
      {
        $set: {
          indexingStatus: "failed",
          indexingError: error instanceof Error ? error.message : "Không thể lập chỉ mục.",
        },
        $unset: { processingToken: 1, leaseUntil: 1 },
      },
    );
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}

export interface KnowledgeSearchInput {
  queryVariants?: readonly string[];
  legalAsOf?: string;
  context: AssistantAccessContext;
  query: string;
  topK?: number;
  category?: string;
  documentType?: string;
}
export async function searchKnowledge(input: KnowledgeSearchInput): Promise<AssistantEvidence[]> {
  const { context } = input;
  const rawDocuments = await filterResourceDocuments(
    await AssistantKnowledgeDocumentModel.find(
      {
        ...knowledgeAccessFilter(context),
        status: "active",
        isDeleted: { $ne: true },
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.documentType ? { documentType: input.documentType } : {}),
      },
      { workbook: 0 },
    ).lean(),
    context,
  );
  const queryDate = reviewAsOf(input.query, input.legalAsOf);
  const supersededIds = new Set(
    rawDocuments
      .filter((d: any) => d.replaces && (!d.effectiveFrom || new Date(d.effectiveFrom) <= queryDate))
      .map((d: any) => String(d.replaces)),
  );
  const readableDocuments = rawDocuments.filter((d: any) => {
    if (supersededIds.has(String(d._id))) return false;
    if (d.effectiveFrom && new Date(d.effectiveFrom) > queryDate) return false;
    if (d.effectiveTo && new Date(d.effectiveTo) <= queryDate) return false;
    return true;
  });
  const reviewMasks = await getKnowledgeLegalReviewMasks(readableDocuments, context.companyCode, queryDate);
  const documents = readableDocuments.filter((document) => !reviewMasks.get(String(document._id))?.routeToShared);
  if (!documents.length) return [];
  const queries = input.queryVariants || (await expandKnowledgeQuery(input.query));
  const budget = knowledgeEvidenceBudget(input.query, input.topK);
  const documentMap = new Map(documents.map((document) => [String(document._id), document]));
  const revised = documents.filter((document) => document.activeRevision);
  const tokens = [...new Set(queries.flatMap(knowledgeTokens))].slice(0, 100);
  if (!tokens.length) return [];
  const current = revised.map((document) => ({ documentId: document._id, revision: document.activeRevision }));
  const candidates = new Map<string, RankableKnowledgeChunk & { chunkIndex: number }>();
  const add = (chunk: any, semanticScore?: number) => {
    const id = String(chunk._id);
    const document = documentMap.get(String(chunk.documentId));
    if (!document || (document.activeRevision && chunk.revision !== document.activeRevision)) return;
    candidates.set(id, {
      ...candidates.get(id),
      id,
      title: document.title,
      documentId: String(document._id),
      text: chunk.text,
      chunkIndex: chunk.chunkIndex,
      ...(semanticScore !== undefined ? { semanticScore } : {}),
    });
  };
  if (current.length) {
    // Give each interpretation its own candidate budget. Union-token overlap can
    // otherwise crowd out passages answering only one paraphrase of the question.
    const lexicalQueries = [...new Set(queries)].slice(0, 4);
    const lexical = (
      await Promise.all(
        lexicalQueries.map((query) => {
          const queryTokens = [...new Set(knowledgeTokens(query))].slice(0, 100);
          return KnowledgeRevisionChunkModel.aggregate([
            { $match: { companyCode: context.companyCode, $or: current, searchTokens: { $in: queryTokens } } },
            { $addFields: { overlap: { $size: { $setIntersection: ["$searchTokens", queryTokens] } } } },
            { $sort: { overlap: -1, _id: 1 } },
            { $project: { embedding: 0, searchTokens: 0 } },
            { $group: { _id: "$documentId", chunks: { $push: "$$ROOT" } } },
            { $project: { chunks: { $slice: ["$chunks", budget.lexicalPerDocument] } } },
            { $unwind: "$chunks" },
            { $replaceRoot: { newRoot: "$chunks" } },
            { $sort: { overlap: -1, _id: 1 } },
            { $limit: 100 },
          ]);
        }),
      )
    ).flat();
    lexical.forEach((chunk) => add(chunk));
    const provider = process.env.KNOWLEDGE_RETRIEVAL_MODE === "hybrid" ? getKnowledgeEmbeddingProvider() : null;
    if (provider) {
      try {
        const queryVectors = await provider.embed([...queries], "search_query");
        const semanticScore = (embedding: number[]) =>
          Math.max(...queryVectors.map((vector) => cosine(vector, embedding)));
        const semantic = process.env.KNOWLEDGE_VECTOR_INDEX
          ? (
              await Promise.all(
                queryVectors.map((queryVector) =>
                  KnowledgeRevisionChunkModel.aggregate([
                    {
                      $vectorSearch: {
                        index: process.env.KNOWLEDGE_VECTOR_INDEX,
                        path: "embedding",
                        queryVector,
                        numCandidates: 400,
                        limit: 50,
                        filter: { companyCode: context.companyCode, embeddingModel: provider.model, $or: current },
                      },
                    },
                  ]),
                ),
              )
            ).flat()
          : null;
        if (!semantic) {
          // Exact semantic search works on ordinary MongoDB; Atlas ANN is an optional scale-up.
          let best: Array<{ chunk: any; score: number }> = [];
          for await (const chunk of KnowledgeRevisionChunkModel.find({
            companyCode: context.companyCode,
            embeddingModel: provider.model,
            $or: current,
          })
            .lean()
            .cursor()) {
            best.push({ chunk, score: semanticScore(chunk.embedding || []) });
            if (best.length >= 100) best = best.sort((a, b) => b.score - a.score).slice(0, 50);
          }
          best
            .sort((a, b) => b.score - a.score)
            .slice(0, 50)
            .forEach(({ chunk, score }) => add(chunk, score));
        }
        semantic?.forEach((chunk) => add(chunk, semanticScore(chunk.embedding || [])));
      } catch (error) {
        logger.warn(
          "[KnowledgeRetrieval] semantic_unavailable; using lexical",
          error instanceof Error ? error.name : "Error",
        );
      }
    }
  }
  // Transitional read of all legacy chunks, keeping only the best candidates in memory.
  const legacy = documents.filter((document) => !document.activeRevision).map((document) => document._id);
  if (legacy.length) {
    const rankLegacy = (items: Array<RankableKnowledgeChunk & { chunkIndex: number }>) => {
      const rankings = queries.map((query) => rankReviewAwareCandidates(query, items, reviewMasks));
      return rankings[0]
        .map((item) => ({ ...item, score: Math.max(...rankings.map((r) => r.find((c) => c.id === item.id)!.score)) }))
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    };
    let best: Array<RankableKnowledgeChunk & { chunkIndex: number }> = [];
    const cursor = AssistantKnowledgeChunkModel.find({ companyCode: context.companyCode, documentId: { $in: legacy } })
      .select("text documentId chunkIndex")
      .lean()
      .cursor();
    for await (const chunk of cursor) {
      const document = documentMap.get(String(chunk.documentId))!;
      best.push({
        id: String(chunk._id),
        documentId: String(chunk.documentId),
        title: document.title,
        text: chunk.text,
        chunkIndex: chunk.chunkIndex,
      });
      if (best.length >= 200) best = selectKnowledgeEvidence(rankLegacy(best), 100, 200_000, budget.lexicalPerDocument);
    }
    rankLegacy(best)
      .filter((item) => item.score > 0)
      .slice(0, 100)
      .forEach((item) => candidates.set(item.id, item));
  }
  const safeCandidates: Array<RankableKnowledgeChunk & { chunkIndex: number }> = [];
  const blockedCandidates: Array<RankableKnowledgeChunk & { chunkIndex: number }> = [];
  for (const candidate of candidates.values()) {
    const mask = reviewMasks.get(candidate.documentId!);
    (mask && (mask.all || mask.chunks.has(candidate.chunkIndex)) ? blockedCandidates : safeCandidates).push(candidate);
  }
  // Rank blocked passages locally solely to surface a relevant status notice.
  // Their obsolete text never reaches either the external reranker or the answer composer.
  const notices = selectKnowledgeEvidence(
    rankReviewAwareCandidates(input.query, blockedCandidates, reviewMasks),
    2,
  ).map((item) => ({ ...item, legalReviewNotice: true }));
  const seeds = await rerankKnowledgeCandidates(input.query, safeCandidates, budget.topK, queries);
  const linked: Array<typeof seeds> = [];
  // Only expand explicit references from already relevant, unmasked passages.
  // Each lookup is bounded and locked to the authorized source's active revision.
  for (const seed of seeds.slice(0, 3)) {
    const references = knowledgeReferences(seed.text);
    const document = documentMap.get(seed.documentId!)!;
    if (!references.length || !document.activeRevision) continue;
    const clauses = [...new Set(references.map((r) => `khoản\\s+${r.clause}\\s+Điều\\s+${r.article}\\b`))];
    const neighbors = await KnowledgeRevisionChunkModel.find({
      companyCode: context.companyCode,
      documentId: document._id,
      revision: document.activeRevision,
      text: { $regex: clauses.join("|"), $options: "i" },
    })
      .select("text documentId revision chunkIndex")
      .sort({ chunkIndex: 1 })
      .limit(120)
      .lean();
    const mask = reviewMasks.get(seed.documentId!);
    const allowed = neighbors
      .filter(
        (chunk) =>
          String(chunk.documentId) === seed.documentId &&
          chunk.revision === document.activeRevision &&
          !(mask && (mask.all || mask.chunks.has(chunk.chunkIndex))),
      )
      .map((chunk) => ({
        id: String(chunk._id),
        title: seed.title,
        documentId: seed.documentId,
        text: chunk.text,
        chunkIndex: chunk.chunkIndex,
      }));
    linked.push(
      referencePartners(seed, allowed, input.query).map((partner) => ({
        ...partner,
        score: seed.score * 0.95,
        coverage: 0,
      })),
    );
  }
  // Preserve the seeds before supporting context, within the original
  // global count/character limits. Reference expansion only raises the per-file cap.
  const expanded = linked.length ? selectReferenceEvidence(seeds, linked, budget) : seeds;
  const ranked: Array<RankableKnowledgeChunk & { chunkIndex: number; score: number; legalReviewNotice?: boolean }> = [
    ...expanded,
    ...notices,
  ];
  return ranked.map((item) => {
    const document = documentMap.get(item.documentId!)!;
    return {
      id: item.id,
      sourceType: "knowledge",
      title: item.title,
      ...(document.extractionQuality?.status === "partial"
        ? { extractionWarnings: document.extractionQuality.warnings as string[] }
        : {}),
      content:
        document.extractionQuality?.status === "partial"
          ? `Lưu ý: tài liệu mới đọc được một phần. ${document.extractionQuality.warnings.join(" ")}\n${item.text}`
          : item.text,
      score: item.score,
      category: document.category,
      documentType: item.legalReviewNotice ? "legal_review" : document.documentType,
      citation: {
        id: item.id,
        sourceType: "knowledge",
        title: item.title,
        documentId: item.documentId,
        chunkIndex: item.chunkIndex,
        revision: document.activeRevision || "legacy",
        updatedAt: document.updatedAt?.toISOString(),
        url: `/kho-tri-thuc?document=${item.documentId}&chunk=${item.chunkIndex}&revision=${document.activeRevision || "legacy"}`,
      },
    };
  });
}

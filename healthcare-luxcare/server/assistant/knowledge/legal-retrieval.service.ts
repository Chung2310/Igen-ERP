import { LegalDocumentModel } from "../../model/legal-document.model";
import { KnowledgeRevisionChunkModel } from "../../model/assistant-knowledge.model";
import { LEGAL_COMPANY } from "./legal-policy";
import { effectiveLegalUnits, legalAsOf } from "./legal-sections";
import { hasKnowledgePermission } from "./knowledge-access";
import { knowledgeTokens, selectKnowledgeEvidence } from "./knowledge-chunking";
import { rankKnowledgeQuestionParts } from "./knowledge-question-ranking";
import { searchKnowledge, type KnowledgeSearchInput } from "./knowledge-retrieval.service";
import type { AssistantEvidence } from "../assistant.types";
import { expandKnowledgeQuery, knowledgeEvidenceBudget } from "./knowledge-query-plan";

export async function searchLegalKnowledge(input: KnowledgeSearchInput): Promise<AssistantEvidence[]> {
  if (
    !hasKnowledgePermission(input.context, "read") ||
    !input.context.companyCode ||
    input.context.companyCode === LEGAL_COMPANY
  )
    return [];
  if (input.documentType && input.documentType !== "legal") return [];
  if (input.category && input.category !== "Pháp lý") return [];
  const dateMatch = input.query.match(/(?:tại ngày|tính đến ngày|vào ngày)\s+(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i);
  const datedQuestion = dateMatch?.[1];
  const query = dateMatch ? input.query.replace(dateMatch[0], "").trim() : input.query;
  const date = datedQuestion?.includes("/") ? datedQuestion.split("/").reverse().join("-") : datedQuestion;
  const now = legalAsOf(input.legalAsOf || date);
  // Read lifecycle and replacement relationships in one query. Eligibility is evaluated
  // on every request; no scheduler/cache can leave an expired predecessor active.
  const all = await LegalDocumentModel.find({
    approvedAt: { $exists: true },
    $or: [{ companyCodes: { $size: 0 } }, { companyCodes: input.context.companyCode }],
  }).lean();
  const units = effectiveLegalUnits(all, input.context.companyCode, now);
  const revisions = units
    .filter((unit) => unit.document.approvedRevision)
    .map((unit) => ({
      documentId: unit.document.knowledgeDocumentId,
      revision: unit.document.structureRevision || unit.document.approvedRevision,
      ...(unit.sectionKey ? { legalSectionKey: unit.sectionKey } : {}),
    }));
  if (!revisions.length) return [];
  const queries = [query, ...(input.queryVariants || []).filter((q) => q !== input.query)];
  const budget = knowledgeEvidenceBudget(input.query, input.topK);
  const tokens = [...new Set(queries.flatMap(knowledgeTokens))].slice(0, 100);
  if (!tokens.length) return [];
  const chunks = await KnowledgeRevisionChunkModel.aggregate([
    { $match: { companyCode: LEGAL_COMPANY, searchTokens: { $in: tokens }, $or: revisions } },
    { $addFields: { overlap: { $size: { $setIntersection: ["$searchTokens", tokens] } } } },
    { $sort: { overlap: -1, _id: 1 } },
    { $limit: 100 },
    { $project: { embedding: 0, searchTokens: 0 } },
  ]);
  const candidates = chunks.flatMap((chunk) =>
    units
      .filter(
        (unit) =>
          String(unit.document.knowledgeDocumentId) === String(chunk.documentId) &&
          chunk.revision === (unit.document.structureRevision || unit.document.approvedRevision) &&
          (!unit.sectionKey || chunk.legalSectionKey === unit.sectionKey),
      )
      .map((unit) => ({
        id: `legal:${chunk._id}${unit.targetKey ? `:${unit.targetKey}` : ""}`,
        documentId: `${chunk.documentId}${unit.targetKey ? `:${unit.targetKey}` : ""}`,
        title: `${unit.document.title}${unit.targetLabel ? ` — ${unit.targetLabel}` : ""}`,
        text: String(chunk.text),
        chunkIndex: Number(chunk.chunkIndex),
        unit,
      })),
  );
  const rankings = queries.map((q) => rankKnowledgeQuestionParts(q, candidates));
  const merged = rankings[0]
    .map((item) => ({ ...item, score: Math.max(...rankings.map((r) => r.find((c) => c.id === item.id)!.score)) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const ranked = selectKnowledgeEvidence(merged, budget.topK, budget.maxCharacters, budget.maxPerDocument);
  return ranked.map((item) => {
    const d = item.unit.document;
    const target = item.unit.targetLabel ? `${item.unit.targetLabel} của ${item.unit.root.number}` : "";
    const effective = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }).format(d.effectiveFrom);
    return {
      id: item.id,
      sourceType: "knowledge",
      title: `${d.number} — ${d.title}`,
      score: item.score,
      documentType: "legal",
      category: "Pháp lý",
      content: `Văn bản pháp lý: ${d.number}. Cơ quan: ${d.issuer}. Hiệu lực từ: ${effective}. Phạm vi: ${d.applicability}. Tra cứu cho doanh nghiệp đang hỏi tại ${now.toISOString()}.${target ? ` Phần được đối chiếu: ${target}.` : ""}${item.unit.action === "repeal" ? " Đây là căn cứ BÃI BỎ phần này; không trình bày nội dung cũ là quy định đang áp dụng." : " Đây là phần nội dung còn hiệu lực tại thời điểm tra cứu."}\n${item.text}`,
      citation: {
        id: item.id,
        sourceType: "knowledge",
        title: `${d.number} — ${d.title}${target ? ` (${target})` : ""}`,
        documentId: String(d._id),
        revision: d.structureRevision || d.approvedRevision,
        chunkIndex: item.chunkIndex,
        scope: d.applicability,
        updatedAt: d.approvedAt?.toISOString(),
        url: d.sourceUrl,
      },
    };
  });
}

export async function searchCombinedKnowledge(input: KnowledgeSearchInput): Promise<AssistantEvidence[]> {
  const queryVariants = hasKnowledgePermission(input.context, "read")
    ? await expandKnowledgeQuery(input.query)
    : [input.query];
  const planned = { ...input, queryVariants, topK: knowledgeEvidenceBudget(input.query, input.topK).topK };
  const [internal, legal] = await Promise.all([searchKnowledge(planned), searchLegalKnowledge(planned)]);
  // Keep both sources: internal procedures must not crowd out authoritative legal evidence.
  return [...legal, ...internal];
}

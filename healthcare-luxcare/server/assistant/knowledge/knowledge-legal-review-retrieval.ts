import { KnowledgeLegalReviewModel } from "../../model/knowledge-legal-review.model";
import { LegalDocumentModel } from "../../model/legal-document.model";
import {
  knowledgeReviewRevision,
  knowledgeReviewStatus,
  legalDependencySnapshot,
} from "./knowledge-legal-review-policy";
import { legalAsOf } from "./legal-sections";
import type { ScannableKnowledgeDocument } from "./knowledge-legal-scan.service";
import { LEGAL_COMPANY } from "./legal-policy";

export interface KnowledgeLegalMask {
  routeToShared: boolean;
  all: boolean;
  chunks: Set<number>;
  reasons: string[];
}
export async function getKnowledgeLegalReviewMasks(
  documents: ScannableKnowledgeDocument[],
  companyCode: string,
  asOf?: Date,
) {
  const masks = new Map<string, KnowledgeLegalMask>();
  if (!documents.length || companyCode === LEGAL_COMPANY) return masks;
  const links = await KnowledgeLegalReviewModel.find({
    companyCode,
    documentId: { $in: documents.map((d) => String(d._id)) },
    state: "confirmed",
  }).lean();
  if (!links.length) return masks;
  const laws = await LegalDocumentModel.find({ approvedAt: { $exists: true } }).lean();
  const byId = new Map(documents.map((d) => [String(d._id), d]));
  for (const link of links) {
    const document = byId.get(String(link.documentId));
    if (!document || document.companyCode !== companyCode) continue;
    const snapshot = legalDependencySnapshot(
      link.legalDocumentId,
      link.sectionKeys || [],
      laws,
      companyCode,
      asOf || new Date(),
    );
    const status = knowledgeReviewStatus(link, knowledgeReviewRevision(document), snapshot);
    if (status === "current") continue;
    const mask = masks.get(String(document._id)) || {
      routeToShared: false,
      all: false,
      chunks: new Set<number>(),
      reasons: [],
    };
    // Copies always route to the canonical catalog, even after a local reindex or legal withdrawal.
    if (link.relation === "copy") mask.routeToShared = true;
    else {
      if (status === "document_changed" || link.scope !== "chunks") mask.all = true;
      (link.chunkIndexes || []).forEach((index) => mask.chunks.add(index));
      mask.reasons.push(
        status === "document_changed"
          ? "tài liệu nội bộ đã đổi phiên bản, cần kiểm tra lại liên kết pháp lý"
          : `căn cứ pháp lý ${snapshot.number} đã thay đổi hoặc không còn hiệu lực trong phạm vi áp dụng`,
      );
    }
    masks.set(String(document._id), mask);
  }
  return masks;
}
export function reviewAsOf(query: string, explicit?: string) {
  const date = query.match(/(?:tại ngày|tính đến ngày|vào ngày)\s+(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i)?.[1];
  return legalAsOf(explicit || (date?.includes("/") ? date.split("/").reverse().join("-") : date));
}

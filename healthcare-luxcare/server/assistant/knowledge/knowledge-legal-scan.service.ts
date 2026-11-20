import crypto from "node:crypto";
import {
  AssistantKnowledgeDocumentModel,
  AssistantKnowledgeChunkModel,
  KnowledgeRevisionChunkModel,
} from "../../model/assistant-knowledge.model";
import { LegalDocumentModel } from "../../model/legal-document.model";
import { KnowledgeLegalReviewModel } from "../../model/knowledge-legal-review.model";
import { hasLegalNumber, knowledgeReviewRevision } from "./knowledge-legal-review-policy";
import { legalApplies, LEGAL_COMPANY } from "./legal-policy";

export interface ScannableKnowledgeDocument {
  _id: unknown;
  companyCode: string;
  title: string;
  activeRevision?: string | null;
  version?: number;
  contentHash?: string;
  updatedAt?: Date;
  legalScanCatalog?: string | null;
  legalScannedUpdatedAt?: Date | null;
}
export async function reviewDocumentChunks(document: ScannableKnowledgeDocument) {
  return document.activeRevision
    ? KnowledgeRevisionChunkModel.find({
        companyCode: document.companyCode,
        documentId: document._id,
        revision: document.activeRevision,
      })
        .select("text chunkIndex")
        .sort({ chunkIndex: 1 })
        .lean()
    : AssistantKnowledgeChunkModel.find({ companyCode: document.companyCode, documentId: document._id })
        .select("text chunkIndex")
        .sort({ chunkIndex: 1 })
        .lean();
}
export async function loadLegalReviewCatalog() {
  const laws = await LegalDocumentModel.find({ approvedAt: { $exists: true } }).lean();
  const version = crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        laws.map((law) => [String(law._id), law.updatedAt?.toISOString()]).sort((a, b) => a[0].localeCompare(b[0])),
      ),
    )
    .digest("hex");
  return { laws, version };
}
export async function scanKnowledgeLegalDocument(
  document: ScannableKnowledgeDocument,
  catalog: Awaited<ReturnType<typeof loadLegalReviewCatalog>>,
) {
  if (document.companyCode === LEGAL_COMPANY) return 0;
  await KnowledgeLegalReviewModel.init();
  const chunks = await reviewDocumentChunks(document);
  const revision = knowledgeReviewRevision(document);
  let matches = 0;
  for (const law of catalog.laws.filter((law) => legalApplies(law, document.companyCode))) {
    const identical = Boolean(law.approvedContentHash && document.contentHash === law.approvedContentHash);
    const matched = chunks.filter((chunk) => hasLegalNumber(chunk.text, law.number));
    if (!identical && !matched.length && !hasLegalNumber(document.title, law.number)) continue;
    const selector = { companyCode: document.companyCode, documentId: document._id, legalDocumentId: law._id };
    const createdAt = new Date();
    // Idempotent suggestions never replace a manager's confirmed baseline or dismissal.
    try {
      await KnowledgeLegalReviewModel.updateOne(
        selector,
        {
          $setOnInsert: {
            ...selector,
            createdAt,
            updatedAt: createdAt,
            state: "suggested",
            matchKind: identical ? "identical" : "reference",
            matchedRevision: revision,
            matchedChunkIndexes: matched.map((c) => c.chunkIndex),
            sample: (matched[0]?.text || chunks[0]?.text || document.title).slice(0, 400),
          },
        },
        { upsert: true, timestamps: false },
      );
    } catch (error: any) {
      if (error.code !== 11000) throw error;
    }
    await KnowledgeLegalReviewModel.updateOne(
      { ...selector, state: { $in: ["suggested", "dismissed"] }, matchedRevision: { $ne: revision } },
      {
        $set: {
          state: "suggested",
          matchKind: identical ? "identical" : "reference",
          matchedRevision: revision,
          matchedChunkIndexes: matched.map((c) => c.chunkIndex),
          sample: (matched[0]?.text || chunks[0]?.text || document.title).slice(0, 400),
        },
      },
    );
    matches++;
  }
  return matches;
}

let cachedCatalog: { value: Awaited<ReturnType<typeof loadLegalReviewCatalog>>; until: number } | undefined;
/** One leased document per idle worker tick; catalog refresh is bounded to 30 seconds. */
export async function processKnowledgeLegalScan(): Promise<boolean> {
  if (process.env.KNOWLEDGE_LEGAL_REVIEW_WORKER_ENABLED === "false") return false;
  const now = new Date();
  if (!cachedCatalog || cachedCatalog.until <= now.getTime())
    cachedCatalog = { value: await loadLegalReviewCatalog(), until: now.getTime() + 30_000 };
  const catalog = cachedCatalog.value;
  if (!catalog.laws.length) return false;
  const token = crypto.randomUUID();
  const document = await AssistantKnowledgeDocumentModel.findOneAndUpdate(
    {
      companyCode: { $ne: LEGAL_COMPANY },
      status: "active",
      $and: [
        {
          $or: [
            { legalScanCatalog: { $ne: catalog.version } },
            { $expr: { $ne: ["$legalScannedUpdatedAt", "$updatedAt"] } },
          ],
        },
        { $or: [{ legalScanLeaseUntil: { $exists: false } }, { legalScanLeaseUntil: { $lte: now } }] },
        { $or: [{ legalScanNextAt: { $exists: false } }, { legalScanNextAt: { $lte: now } }] },
      ],
    },
    { $set: { legalScanToken: token, legalScanLeaseUntil: new Date(now.getTime() + 120_000) } },
    { returnDocument: "after", sort: { legalScannedUpdatedAt: 1, _id: 1 }, timestamps: false },
  ).lean();
  if (!document) return false;
  try {
    await scanKnowledgeLegalDocument(document, catalog);
    await AssistantKnowledgeDocumentModel.updateOne(
      { _id: document._id, companyCode: document.companyCode, legalScanToken: token, updatedAt: document.updatedAt },
      {
        $set: { legalScanCatalog: catalog.version, legalScannedUpdatedAt: document.updatedAt },
        $unset: { legalScanToken: 1, legalScanLeaseUntil: 1, legalScanNextAt: 1 },
      },
      { timestamps: false },
    );
  } catch (error) {
    await AssistantKnowledgeDocumentModel.updateOne(
      { _id: document._id, companyCode: document.companyCode, legalScanToken: token },
      {
        $set: { legalScanNextAt: new Date(Date.now() + 60_000) },
        $unset: { legalScanToken: 1, legalScanLeaseUntil: 1 },
      },
      { timestamps: false },
    );
    throw error;
  }
  return true;
}

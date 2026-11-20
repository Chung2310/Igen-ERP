import crypto from "node:crypto";
import Joi from "joi";
import { LegalDocumentModel } from "../model/legal-document.model";
import { AssistantKnowledgeDocumentModel, KnowledgeRevisionChunkModel } from "../model/assistant-knowledge.model";
import { readKnowledgeSource } from "../assistant/knowledge/knowledge-source.service";
import { extractKnowledgeFile } from "../assistant/knowledge/knowledge-file-extractor";
import { canApproveLegal, canManageLegal, LEGAL_COMPANY } from "../assistant/knowledge/legal-policy";
import { chunkKnowledgeText, knowledgeTokens } from "../assistant/knowledge/knowledge-chunking";
import {
  effectiveLegalUnits,
  legalAsOf,
  suggestLegalSections,
  validateLegalSections,
} from "../assistant/knowledge/legal-sections";
import { visibleLegalDocument } from "./legal-document.service";

type Actor = { id: string; role: string; companyCode?: string };
async function structureSource(user: Actor, id: string) {
  const document = await visibleLegalDocument(user, id);
  const knowledge = await AssistantKnowledgeDocumentModel.findOne({
    _id: document.knowledgeDocumentId,
    companyCode: LEGAL_COMPANY,
  }).lean();
  const revision = document.approvedRevision || knowledge?.activeRevision;
  const sourceId = document.sourceFileId || knowledge?.sourceFileId;
  if (!sourceId || !revision) throw new Error("Chờ file xử lý thành công trước khi kiểm tra cấu trúc.");
  const source = await readKnowledgeSource(LEGAL_COMPANY, sourceId);
  const extracted = await extractKnowledgeFile({
    originalname: source.filename,
    mimetype: source.mimeType,
    buffer: source.buffer,
  });
  return { document, revision, text: extracted.text };
}

export async function getLegalStructure(user: Actor, id: string) {
  const { document, revision, text } = await structureSource(user, id);
  const matches = document.structureSourceRevision === revision;
  return {
    document,
    sourceRevision: revision,
    text,
    sections: matches && document.sections.length ? document.sections : suggestLegalSections(text),
    saved: matches && Boolean(document.structureRevision),
    canEdit:
      document.status === "draft"
        ? canManageLegal(user) && (user.role !== "blog_author" || document.createdBy === user.id)
        : document.status === "approved" && !document.structureRevision && canApproveLegal(user),
  };
}

const structureSchema = Joi.object({
  updatedAt: Joi.string().isoDate().required(),
  sourceRevision: Joi.string().max(100).required(),
  reviewed: Joi.boolean().valid(true).required(),
  sections: Joi.array()
    .min(1)
    .max(500)
    .items(
      Joi.object({
        key: Joi.string()
          .pattern(/^[a-z0-9][a-z0-9/_-]{0,99}$/)
          .required(),
        label: Joi.string().trim().max(200).required(),
        start: Joi.number().integer().min(0).required(),
        end: Joi.number().integer().min(1).required(),
      }).unknown(false),
    )
    .required(),
}).unknown(false);

export async function saveLegalStructure(user: Actor, id: string, body: unknown) {
  if (!canManageLegal(user)) throw new Error("Bạn không có quyền kiểm tra cấu trúc pháp lý.");
  const parsed = structureSchema.validate(body);
  if (parsed.error) throw new Error(parsed.error.message);
  const input = parsed.value;
  const { document, revision, text } = await structureSource(user, id);
  if (
    document.status === "withdrawn" ||
    (document.status === "approved" && (!canApproveLegal(user) || document.structureRevision)) ||
    (document.status === "draft" && user.role === "blog_author" && document.createdBy !== user.id)
  )
    throw new Error("Cấu trúc đã duyệt được giữ cố định; chỉ được cấu trúc một lần với văn bản đã công bố.");
  if (document.updatedAt.toISOString() !== input.updatedAt || revision !== input.sourceRevision)
    throw new Error("File hoặc thông tin đã thay đổi. Vui lòng mở lại cấu trúc.");
  validateLegalSections(input.sections, text);
  const structureRevision = crypto.randomUUID();
  const chunks = input.sections.flatMap((section: { key: string; label: string; start: number; end: number }) =>
    chunkKnowledgeText(text.slice(section.start, section.end), { title: `${document.number} — ${section.label}` }).map(
      (chunk) => ({
        companyCode: LEGAL_COMPANY,
        documentId: document.knowledgeDocumentId,
        revision: structureRevision,
        legalSectionKey: section.key,
        title: document.title,
        text: chunk,
        searchTokens: [...new Set(knowledgeTokens(`${document.title} ${section.label} ${chunk}`))],
      }),
    ),
  );
  if (!chunks.length) throw new Error("Không có nội dung điều/khoản để lập chỉ mục.");
  await KnowledgeRevisionChunkModel.init();
  await KnowledgeRevisionChunkModel.insertMany(
    chunks.map((chunk: object, chunkIndex: number) => ({ ...chunk, chunkIndex })),
  );
  const result = await LegalDocumentModel.findOneAndUpdate(
    { _id: id, status: document.status, updatedAt: document.updatedAt },
    {
      $set: {
        sections: input.sections,
        structureRevision,
        structureSourceRevision: revision,
        structuredBy: user.id,
        structuredAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );
  if (!result) throw new Error("Văn bản vừa thay đổi. Mở lại cấu trúc trước khi lưu.");
  return result;
}

/** Reviewer/reader comparison view, with a date and source coordinates for every current unit. */
export async function getEffectiveLegalText(user: Actor, id: string, date?: unknown) {
  const document = await visibleLegalDocument(user, id);
  const rootId = document.amends || document._id;
  const all = await LegalDocumentModel.find({ approvedAt: { $exists: true } }).lean();
  const root = all.find((d) => String(d._id) === String(rootId));
  if (!root) throw new Error("Văn bản gốc chưa được duyệt.");
  // Editors may review a targeted law even when their own account is in SYSTEM.
  const companyCode = canManageLegal(user)
    ? root.companyCodes[0] || user.companyCode || "SYSTEM"
    : user.companyCode || "";
  const at = legalAsOf(date);
  const units = effectiveLegalUnits(all, companyCode, at).filter((unit) => String(unit.root._id) === String(rootId));
  // Read each immutable original once: the human comparison view must not repeat
  // search-chunk prefixes and overlap windows inside a provision.
  const sources = new Map<string, string>();
  for (const sourceId of new Set(units.map((unit) => String(unit.document._id)))) {
    sources.set(sourceId, (await structureSource(user, sourceId)).text);
  }
  return {
    rootNumber: root.number,
    asOf: at.toISOString(),
    units: units.map((unit) => ({
      targetKey: unit.targetKey,
      label: unit.targetLabel || root.title,
      action: unit.action || "original",
      sourceNumber: unit.document.number,
      sourceUrl: unit.document.sourceUrl,
      sourceDocumentId: String(unit.document._id),
      sectionKey: unit.sectionKey,
      text: (() => {
        const text = sources.get(String(unit.document._id)) || "";
        if (!unit.sectionKey) return text;
        const section = unit.document.sections.find((section) => section.key === unit.sectionKey);
        return section ? text.slice(section.start, section.end) : "";
      })(),
    })),
  };
}

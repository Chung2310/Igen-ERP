import { CompanyModel } from "../../../model/company.model";
import { LegalChunkModel, LegalDocumentModel, LegalSyncStateModel, LegalVersionModel } from "../models/legal-reference.model";
import { createLegalDocument, createLegalRevision, type LegalDocumentInput, type LegalUpload } from "./legal-document.service";
import { MAX_LEGAL_FILE_BYTES } from "./legal-reference.service";

const DEFAULT_SEARCH_URL = "https://data.moj.gov.vn/api/v1/publising/lgsp/redirect/tim-kiem-van-ban";
const DEFAULT_DETAIL_URL = "https://data.moj.gov.vn/api/v1/publising/lgsp/redirect/chi-tiet-van-ban";
const DEFAULT_ATTACHMENTS_URL = "https://data.moj.gov.vn/api/v1/publising/lgsp/redirect/tai-file-dinh-kem";
const PAGE_SIZE = 50;

export type VbplScope = {
  jurisdiction: "central" | "ministry" | "local";
  donViIds: number[];
  documentTypeIds: number[];
  documentKinds: number[];
  province?: string;
};

export type VbplSyncConfig = {
  userKey: string;
  searchUrl: string;
  detailUrl: string;
  attachmentsUrl: string;
  scopes: VbplScope[];
  pageLimit: number;
  pageSize: number;
};

export type VbplSyncStats = {
  pagesScanned: number;
  documentsFound: number;
  documentsAdded: number;
  revisionsAdded: number;
  unchanged: number;
  reviewRequired: number;
  missingOriginal: number;
};

type JsonRecord = Record<string, unknown>;
type VbplSourceDocument = JsonRecord & { ID?: number | string };

const emptyStats = (): VbplSyncStats => ({ pagesScanned: 0, documentsFound: 0, documentsAdded: 0, revisionsAdded: 0, unchanged: 0, reviewRequired: 0, missingOriginal: 0 });
const activeSyncs = new Set<string>();

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function parseVbplScopes(value: string | undefined): VbplScope[] {
  if (!value?.trim()) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error("VBPL_SYNC_SCOPES_JSON phải là một mảng phạm vi.");
  return parsed.flatMap((item): VbplScope[] => {
    if (!item || typeof item !== "object") return [];
    const scope = item as Record<string, unknown>;
    if (!["central", "ministry", "local"].includes(String(scope.jurisdiction))) return [];
    const ids = (candidate: unknown) => Array.isArray(candidate)
      ? [...new Set(candidate.map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 500)
      : [];
    return [{
      jurisdiction: scope.jurisdiction as VbplScope["jurisdiction"],
      donViIds: ids(scope.donViIds),
      documentTypeIds: ids(scope.documentTypeIds),
      documentKinds: ids(scope.documentKinds).filter((id) => [1, 2, 3].includes(id)),
      province: typeof scope.province === "string" ? scope.province.trim().slice(0, 120) : "",
    }];
  });
}

export function getVbplSyncConfig(env: NodeJS.ProcessEnv = process.env): VbplSyncConfig {
  let scopes: VbplScope[];
  try { scopes = parseVbplScopes(env.VBPL_SYNC_SCOPES_JSON); }
  catch (error) { throw Object.assign(error instanceof Error ? error : new Error("VBPL scope config is invalid."), { status: 503 }); }
  const userKey = (env.VBPL_USER_KEY || "").trim();
  if (!userKey) throw Object.assign(new Error("Chưa cấu hình VBPL_USER_KEY để đồng bộ với dịch vụ Bộ Tư pháp."), { status: 503 });
  if (!scopes.length) throw Object.assign(new Error("Chưa chọn phạm vi đồng bộ trong VBPL_SYNC_SCOPES_JSON."), { status: 503 });
  const validateServiceUrl = (value: string | undefined, fallback: string, key: string) => {
    const raw = (value || fallback).trim();
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" || url.hostname !== "data.moj.gov.vn") throw new Error();
      return url.toString();
    } catch { throw Object.assign(new Error(`${key} phải là URL HTTPS thuộc data.moj.gov.vn.`), { status: 503 }); }
  };
  return {
    userKey,
    searchUrl: validateServiceUrl(env.VBPL_SEARCH_URL, DEFAULT_SEARCH_URL, "VBPL_SEARCH_URL"),
    detailUrl: validateServiceUrl(env.VBPL_DETAIL_URL, DEFAULT_DETAIL_URL, "VBPL_DETAIL_URL"),
    attachmentsUrl: validateServiceUrl(env.VBPL_ATTACHMENTS_URL, DEFAULT_ATTACHMENTS_URL, "VBPL_ATTACHMENTS_URL"),
    scopes,
    pageLimit: boundedInteger(env.VBPL_SYNC_PAGE_LIMIT, 2, 1, 100),
    pageSize: boundedInteger(env.VBPL_SYNC_PAGE_SIZE, PAGE_SIZE, 10, 100),
  };
}

export function isVbplSyncConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  try { getVbplSyncConfig(env); return true; } catch { return false; }
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function parseEmbeddedJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return "";
  try { return JSON.parse(trimmed); } catch { return value; }
}

export function unwrapVbplData(value: unknown): unknown {
  let current: unknown = value;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parsed = parseEmbeddedJson(current);
    if (parsed !== current) { current = parsed; continue; }
    const envelope = record(current);
    if (envelope.errorCode && String(envelope.errorCode) !== "0") throw new Error(String(envelope.errorDesc || "Dịch vụ VBPL trả về lỗi."));
    if (typeof envelope.statusCode === "number" && envelope.statusCode >= 400) throw new Error(String(envelope.message || "Dịch vụ VBPL trả về lỗi."));
    if (envelope.data !== undefined) { current = envelope.data; continue; }
    break;
  }
  return current;
}

function parseSearchPage(value: unknown): { documents: VbplSourceDocument[]; total: number } {
  const body = record(unwrapVbplData(value));
  const documents = Array.isArray(body.LtsVanBan) ? body.LtsVanBan.map(record) as VbplSourceDocument[]
    : Array.isArray(body.items) ? body.items.map(record) as VbplSourceDocument[]
      : Array.isArray(body.Documents) ? body.Documents.map(record) as VbplSourceDocument[]
        : Array.isArray(unwrapVbplData(value)) ? (unwrapVbplData(value) as unknown[]).map(record) as VbplSourceDocument[]
          : [];
  const totalValue = Number(body.TotalRecord ?? body.total ?? body.Total ?? 0);
  return { documents, total: Number.isFinite(totalValue) && totalValue >= 0 ? totalValue : documents.length };
}

function parseSingleDocument(value: unknown): VbplSourceDocument {
  const body = unwrapVbplData(value);
  if (Array.isArray(body)) return record(body[0]) as VbplSourceDocument;
  const row = record(body);
  if (Array.isArray(row.LtsVanBan)) return record(row.LtsVanBan[0]) as VbplSourceDocument;
  return row as VbplSourceDocument;
}

function dataRequest(page: number, config: VbplSyncConfig, scope: VbplScope, documentKind: number, itemId?: number): JsonRecord {
  const tGridRequest = JSON.stringify({
    take: config.pageSize,
    skip: (page - 1) * config.pageSize,
    page,
    pageSize: config.pageSize,
    sort: [{ field: "ID", dir: "desc" }],
  });
  return itemId ? {
    ItemID: itemId,
    DonVi: scope.donViIds,
    IsSearch: 0,
    t_gridRequest: tGridRequest,
  } : {
    DonVi: scope.donViIds,
    KieuVanBan: documentKind,
    Keyword: "",
    SearchIn: ["Title", "VBPQCoquanbanhanh", "VBPQTrichYeu"],
    isTiengAnhOrVN: 1,
    LoaiVanBan: scope.documentTypeIds,
    t_gridRequest: tGridRequest,
  };
}

async function callMoj(url: string, userKey: string, payload: JsonRecord, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Key": userKey, Accept: "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw new Error(`Dịch vụ dữ liệu Bộ Tư pháp trả về HTTP ${response.status}.`);
  return body;
}

function stringValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    const nested = record(value);
    for (const key of ["LookupValue", "Title", "Name", "Value"]) if (typeof nested[key] === "string" && String(nested[key]).trim()) return String(nested[key]).trim();
  }
  return "";
}

function sourceDate(value: unknown): string | undefined {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  const text = stringValue(value);
  if (!text) return undefined;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function cleanAuthority(value: string): string {
  const parts = value.split(/;#|\|/).map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) || value;
}

function inferLegalStatus(statusInput: string, effectiveDate?: string, expiryDate?: string): LegalDocumentInput["status"] {
  const normalized = statusInput.toLocaleLowerCase("vi-VN");
  if (/một phần|partially/.test(normalized)) return "partially_effective";
  if (/bãi bỏ|repealed/.test(normalized)) return "repealed";
  if (/hết hiệu lực|expired/.test(normalized)) return "expired";
  if (/chưa có hiệu lực|upcoming/.test(normalized)) return "upcoming";
  if (/còn hiệu lực|effective/.test(normalized)) return "effective";
  const now = Date.now();
  if (expiryDate && Date.parse(expiryDate) < now) return "expired";
  if (effectiveDate && Date.parse(effectiveDate) > now) return "upcoming";
  return "unknown";
}

function relatedSymbols(value: unknown): string[] {
  const text = typeof value === "string" ? value : JSON.stringify(value || "");
  const matches = text.match(/\b\d{1,4}\s*\/\s*\d{4}\s*\/\s*[A-ZÀ-ỸĐ0-9]+(?:[-/][A-ZÀ-ỸĐ0-9]+)*\b/gi) || [];
  return [...new Set(matches.map((item) => item.replace(/\s+/g, "").toLocaleUpperCase("vi-VN")))].slice(0, 20);
}

export function normalizeVbplSourceDocument(source: VbplSourceDocument, scope: VbplScope, kind: number): (LegalDocumentInput & { id: string; sourceHtml: string; sourceModifiedAt?: string }) | null {
  const id = stringValue(source.ID, source.Id, source.ItemID);
  const symbol = stringValue(source.VBPQSokyhieu, source.Symbol);
  if (!id || !symbol) return null;
  const title = stringValue(source.VBPQTrichYeu, source.TrichYeu, source.Title1, source.Title, symbol);
  const authority = cleanAuthority(stringValue(source.VBPQCoquanbanhanh, source.IssuingAuthority, "Cơ quan ban hành chưa xác định"));
  const issueDate = sourceDate(source.VBPQNgayBanHanh ?? source.IssueDate);
  const effectiveDate = sourceDate(source.VBPQNgaycohieuluc ?? source.EffectiveDate);
  const expiryDate = sourceDate(source.VBPQNgayHetHieuLuc ?? source.ExpiryDate);
  const rawStatus = stringValue(source.VBPQTinhTrangHieuLuc, source.Status);
  const relationFields = ["VBPQVanbanduocsuadoi", "VBPQVanBanSuaDoiBoSung", "VBPQVanBanThayThe", "VBPQVanBanBaiBo", "VBHopNhatVanBanNguonTV"];
  const relationData = relationFields.map((field) => source[field]).filter(Boolean);
  const extractedRelations = relationFields.flatMap((field, index) => relatedSymbols(source[field]).map((relatedSymbol) => ({
    symbol: relatedSymbol,
    relation: index === relationFields.length - 1 ? "consolidates" as const : "amends" as const,
    affectedArticles: [] as string[],
  })));
  const defaultSourceUrl = `https://vbpl.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=${encodeURIComponent(id)}`;
  const sourceUrlInput = stringValue(source.VBPQUrl, source.Url, source.SourceUrl);
  let sourceUrl = defaultSourceUrl;
  try {
    const candidate = new URL(sourceUrlInput);
    if (candidate.protocol === "https:" && (candidate.hostname === "vbpl.vn" || candidate.hostname.endsWith(".vbpl.vn") || candidate.hostname === "vbpl.moj.gov.vn")) sourceUrl = candidate.toString();
  } catch { /* Use the official document page constructed from its source ID. */ }
  return {
    id,
    symbol,
    title,
    issuingAuthority: authority,
    jurisdiction: scope.jurisdiction,
    province: scope.province || stringValue(source.VBPQDiaDanh),
    field: stringValue(source.VBPQLinhVuc, source.VBPQNganh),
    issueDate,
    effectiveDate,
    expiryDate,
    status: inferLegalStatus(rawStatus, effectiveDate, expiryDate),
    sourceUrl,
    sourceSystem: "vbpl",
    sourceDocumentId: id,
    sourceModifiedAt: sourceDate(source.Modified ?? source.EditorModified ?? source.VBPQNgayCapNhat),
    relatedDocuments: extractedRelations,
    requiresRelationReview: relationData.length > 0 && extractedRelations.length === 0,
    isConsolidated: kind === 3 || /văn bản hợp nhất/i.test(`${source.Title || ""} ${title}`),
    sourceHtml: stringValue(source.VBPQToanVan, source.FullText, source.Content),
  };
}

function attachmentUrls(document: VbplSourceDocument): Array<{ url: string; name: string }> {
  const candidates = [document.ListFileAttach, document.LtsFileAttach, document.LtsFileAttachClone, document.txtAttachments, document.Attachments]
    .flatMap((value) => {
      const parsed = parseEmbeddedJson(value);
      return Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    });
  const result: Array<{ url: string; name: string }> = [];
  for (const candidate of candidates) {
    const row = record(candidate);
    let url = stringValue(row.Url, row.url, row.ServerRelativeUrl, row.FileRef, typeof candidate === "string" ? candidate : "");
    if (!url) continue;
    try {
      const parsed = url.startsWith("/") ? new URL(url, "https://vbpl.vn") : new URL(url);
      if (parsed.protocol !== "https:" || !(parsed.hostname === "vbpl.vn" || parsed.hostname.endsWith(".vbpl.vn") || parsed.hostname === "vbpl.moj.gov.vn")) continue;
      url = parsed.toString();
    } catch { continue; }
    result.push({ url, name: stringValue(row.Name, row.name, row.FileName, row.filename) || url.split("/").at(-1) || "van-ban-goc" });
  }
  return result.slice(0, 5);
}

function decodeAttachment(value: unknown): LegalUpload | null {
  const body = record(unwrapVbplData(value));
  const result = Array.isArray(body.Result) ? body.Result : Array.isArray(body.results) ? body.results : [body];
  for (const item of result) {
    const row = record(item);
    const filename = stringValue(row.Name, row.FileName, row.filename, "van-ban-goc.pdf").slice(-180);
    const base64 = stringValue(row.DataFile, row.dataFile, row.Base64);
    if (!base64) continue;
    const clean = base64.replace(/^data:[^,]+;base64,/i, "").replace(/\s/g, "");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) continue;
    const buffer = Buffer.from(clean, "base64");
    if (!buffer.length || buffer.length > MAX_LEGAL_FILE_BYTES) continue;
    const extension = filename.split(".").pop()?.toLowerCase();
    const valid = extension === "pdf" ? buffer.subarray(0, 4).toString("ascii") === "%PDF"
      : extension === "docx" ? buffer.subarray(0, 2).toString("ascii") === "PK"
        : extension === "txt" || extension === "html" || extension === "htm";
    if (!valid) continue;
    const mimetype = extension === "pdf" ? "application/pdf" : extension === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : extension?.startsWith("htm") ? "text/html; charset=utf-8" : "text/plain; charset=utf-8";
    return { buffer, originalname: filename, mimetype };
  }
  return null;
}

async function getOriginalFile(detail: VbplSourceDocument, source: ReturnType<typeof normalizeVbplSourceDocument>, config: VbplSyncConfig, fetchImpl: typeof fetch): Promise<LegalUpload | null> {
  for (const attachment of attachmentUrls(detail)) {
    try {
      const response = await callMoj(config.attachmentsUrl, config.userKey, { lstAttachUrl: [attachment.url] }, fetchImpl);
      const file = decodeAttachment(response);
      if (file) return file;
    } catch { /* Try the next official attachment, then the source text snapshot. */ }
  }
  if (!source?.sourceHtml || Buffer.byteLength(source.sourceHtml, "utf8") > MAX_LEGAL_FILE_BYTES) return null;
  return {
    buffer: Buffer.from(source.sourceHtml, "utf8"),
    originalname: `${source.symbol.replace(/[^\p{L}\p{N}._-]+/gu, "_")}.html`,
    mimetype: "text/html; charset=utf-8",
  };
}

async function findAndStoreDocument(companyCode: string, actorId: string, scope: VbplScope, kind: number, searchItem: VbplSourceDocument, config: VbplSyncConfig, fetchImpl: typeof fetch, stats: VbplSyncStats) {
  const sourceId = stringValue(searchItem.ID, searchItem.Id, searchItem.ItemID);
  if (!sourceId || !/^\d+$/.test(sourceId)) return;
  const detailResponse = await callMoj(config.detailUrl, config.userKey, dataRequest(1, config, scope, kind, Number(sourceId)), fetchImpl);
  const detail = parseSingleDocument(detailResponse);
  const source = normalizeVbplSourceDocument({ ...searchItem, ...detail }, scope, kind);
  if (!source) return;
  const file = await getOriginalFile(detail, source, config, fetchImpl);
  if (!file) { stats.missingOriginal += 1; return; }

  const company = companyCode.trim().toUpperCase();
  const existing = await LegalDocumentModel.findOne({ companyCode: company, sourceSystem: "vbpl", $or: [{ sourceDocumentId: source.id }, { symbol: source.symbol }] });
  if (!existing) {
    const { sourceHtml: _sourceHtml, id: _id, sourceModifiedAt, ...input } = source;
    const result = await createLegalDocument(company, actorId, { ...input, sourceModifiedAt }, file);
    stats.documentsAdded += 1;
    if (result.document.reviewRequired) stats.reviewRequired += 1;
    return;
  }

  const revision = await createLegalRevision(company, actorId, String(existing._id), file, source.sourceUrl, source.sourceModifiedAt, {
    status: source.status,
    effectiveDate: source.effectiveDate,
    expiryDate: source.expiryDate,
  });
  if (!revision.duplicate) {
    existing.reviewRequired = true;
    await existing.save();
    stats.revisionsAdded += 1;
    stats.reviewRequired += 1;
    return;
  }
  stats.unchanged += 1;
  existing.sourceDocumentId = source.id;
  existing.sourceSystem = "vbpl";
  existing.symbol = source.symbol;
  existing.title = source.title;
  existing.issuingAuthority = source.issuingAuthority;
  existing.jurisdiction = source.jurisdiction;
  existing.province = source.province;
  existing.field = source.field;
  existing.issueDate = source.issueDate ? new Date(source.issueDate) : undefined;
  existing.effectiveDate = source.effectiveDate ? new Date(source.effectiveDate) : undefined;
  existing.expiryDate = source.expiryDate ? new Date(source.expiryDate) : undefined;
  existing.status = source.status || "unknown";
  existing.sourceUrl = source.sourceUrl || "";
  await existing.save();
  if (existing.currentVersionId) await LegalChunkModel.updateMany({ companyCode: company, documentId: existing._id, versionId: existing.currentVersionId }, { $set: {
    issuingAuthority: source.issuingAuthority,
    field: source.field || "",
    status: source.status || "unknown",
    effectiveFrom: source.effectiveDate ? new Date(source.effectiveDate) : undefined,
    effectiveTo: source.expiryDate ? new Date(source.expiryDate) : undefined,
    sourceUrl: source.sourceUrl || "",
  } });
}

export async function runVbplSync(companyCodeInput: string, actorId = "legal-reference-sync", options: { pageLimit?: number; env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {}) {
  const config = getVbplSyncConfig(options.env);
  const companyCode = companyCodeInput.trim().toUpperCase();
  if (!companyCode) throw Object.assign(new Error("Thiếu mã doanh nghiệp cho lần đồng bộ."), { status: 400 });
  const pageLimit = options.pageLimit && Number.isInteger(options.pageLimit) ? Math.max(1, Math.min(100, options.pageLimit)) : config.pageLimit;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const stats = emptyStats();
  const previousState = await LegalSyncStateModel.findOne({ companyCode }).select("cursors").lean();
  const cursors = { ...record(previousState?.cursors) } as Record<string, number>;
  for (const [scopeIndex, scope] of config.scopes.entries()) {
    for (const kind of scope.documentKinds.length ? scope.documentKinds : [1]) {
      const cursorKey = `${scopeIndex}:${scope.jurisdiction}:${scope.donViIds.join("-")}:${kind}`;
      let page = Math.max(1, Number(cursors[cursorKey]) || 1);
      let scanned = 0;
      for (; scanned < pageLimit; scanned += 1) {
        const response = await callMoj(config.searchUrl, config.userKey, dataRequest(page, config, scope, kind), fetchImpl);
        const result = parseSearchPage(response);
        stats.pagesScanned += 1;
        stats.documentsFound += result.documents.length;
        for (const document of result.documents) {
          try { await findAndStoreDocument(companyCode, actorId, scope, kind, document, config, fetchImpl, stats); }
          catch (error) { console.warn("[LegalReferenceSync] Document skipped after source error", stringValue(document.ID), error instanceof Error ? error.message : "unknown error"); }
        }
        const reachedEnd = !result.documents.length || result.documents.length < config.pageSize || (result.total > 0 && page * config.pageSize >= result.total);
        page = reachedEnd ? 1 : page + 1;
        cursors[cursorKey] = page;
        if (reachedEnd) break;
      }
    }
  }
  await LegalSyncStateModel.updateOne({ companyCode }, { $set: { cursors } });
  return stats;
}

async function runAndSave(companyCode: string, actorId: string, pageLimit?: number) {
  const now = new Date();
  await LegalSyncStateModel.findOneAndUpdate({ companyCode }, { $set: { status: "running", configuredScopes: getVbplSyncConfig().scopes.length, startedAt: now, lastError: "", pagesScanned: 0, documentsFound: 0, documentsAdded: 0, revisionsAdded: 0, unchanged: 0, reviewRequired: 0, missingOriginal: 0 } }, { upsert: true, setDefaultsOnInsert: true });
  try {
    const stats = await runVbplSync(companyCode, actorId, { pageLimit });
    await LegalSyncStateModel.updateOne({ companyCode }, { $set: { ...stats, status: "completed", completedAt: new Date(), lastSuccessAt: new Date(), lastError: "" } });
    return stats;
  } catch (error) {
    await LegalSyncStateModel.updateOne({ companyCode }, { $set: { status: "failed", completedAt: new Date(), lastError: (error instanceof Error ? error.message : "Lỗi đồng bộ.").slice(0, 500) } });
    throw error;
  }
}

export function startVbplSync(companyCodeInput: string, actorId: string, pageLimit?: number): boolean {
  const companyCode = companyCodeInput.trim().toUpperCase();
  if (!companyCode || activeSyncs.has(companyCode)) return false;
  activeSyncs.add(companyCode);
  void runAndSave(companyCode, actorId, pageLimit).catch((error) => console.error("[LegalReferenceSync]", companyCode, error instanceof Error ? error.message : "Sync failed"))
    .finally(() => activeSyncs.delete(companyCode));
  return true;
}

export async function runScheduledVbplSync() {
  if (!isVbplSyncConfigured()) return { configured: false, started: 0 };
  const companies = await CompanyModel.find({ lifecycleStatus: "active", enabledModules: "legal-reference" }).select("code").lean();
  let started = 0;
  for (const company of companies) if (startVbplSync(String(company.code || ""), "legal-reference-scheduler")) started += 1;
  return { configured: true, started };
}

export function startVbplSyncScheduler(intervalMs = boundedInteger(process.env.VBPL_SYNC_INTERVAL_MS, 6 * 60 * 60 * 1000, 60_000, 7 * 24 * 60 * 60 * 1000)) {
  if (!isVbplSyncConfigured()) {
    console.info("[LegalReferenceSync] Scheduler disabled; configure VBPL_USER_KEY and VBPL_SYNC_SCOPES_JSON to enable source sync.");
    return () => undefined;
  }
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await runScheduledVbplSync(); }
    catch (error) { console.error("[LegalReferenceSyncScheduler]", error instanceof Error ? error.message : "Sync cycle failed"); }
    finally { running = false; }
  };
  void run();
  const timer = setInterval(() => { void run(); }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

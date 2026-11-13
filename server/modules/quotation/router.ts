import { quoteApprovalBlockers, quoteHasApprovalBlockers } from "./quote-approval";
import { acceptanceFinancials, settlementContractContext } from "./acceptance-export";
import { publicErrorMessage } from "./public-errors";
import { registerCatalogRoutes } from "./catalog.routes";
import { createCatalogProduct, importCatalogProducts } from "./catalog.service";
import { mapCatalogRow, type CatalogImportRow } from "./catalog-validation";
import { canQuotation } from "./context";
import { summarizeQuotationOverview } from "./overview";
// Business handlers ported from Quote-assistance@9fa13e5. ERP adapters own identity, scope, files and jobs.
import { createQuotationRouter } from "./router-adapter";
import { assertQuotationPermission } from "./context";
import { quotationContext } from "./context";
import { aiSubscriptionService } from "../../service/ai-usage.service";
import { runQuotationAi } from "./ai-transport";
import { queueQuotationExport } from "./jobs";
import { storeQuotationExport } from "./storage";
import express from "express";

import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { createRequire } from "node:module";

import { Binary, ObjectId, type Db, type Document, type Filter } from "mongodb";

import PdfPrinter from "pdfmake";

import { config } from "./config.js";

import { directDocumentEditorEnabled } from "./document-edit-ai.js";

import { logger } from "./logger.js";

import { connectDatabase } from "./db.js";

import { analyzeRequest, suggestUnmatchedExplicitRequestLines } from "./ai.js";

import { parseCustomerQuotePrompt, suggestCustomerQuote } from "./customer-quote-ai.js";

import { mergeBudgetPlanAfterClarification, recalculationInput, recomputeBudgetPlanTotals, suggestBudgetPlan, type SavedBudgetPlan } from "./budget-planner.js";

import { extractPriceListRows, type PriceList, type PriceListAnalysisRow } from "./price-list.js";

import { requestFileContent, type RequestFile } from "./request-file.js";

import { downloadCompanyFile, uploadCompanyFile } from "./cloudinary.js";

import { assertCatalogSelection, calculateQuote, recalculateSnapshot, roundMoney } from "./pricing.js";

import { estimateFromCustomerQuote } from "./quote-from-customer.js";

import { makeDocumentWord } from "./document-word.js";

import { contractTemplateMode, renderAcceptanceFile, renderContractFile } from "./contract-template.js";

import { recalculateEstimateWithClarifications, adjustEstimateWithRequirements, estimateAnswers, estimateForRegeneration } from "./quote-estimate-adjustment.js";
import { resolveQuotationJobContext } from "./access";

import { extractCatalogProducts, previewCatalogImport, type PriceListColumnRole, type PriceListSheetMapping } from "./price-list-import.js";

import { cleanMissingInformation, extractQuoteTerms, isAnsweredQuoteChargeQuestion, isResolvedQuoteTermWarning, isShippingInformation, isSupplementalProductInformation, isTaxInformation } from "./quote-terms.js";

import { budgetPlanAsQuote, makeBudgetPlanExcel, makeQuoteExcel } from "./quote-excel.js";

import { assertXlsxWorksheetsPreserved, createTemplateFillPlan, currentTemplate, inspectTemplate, inspectUploadedTemplate, previewDocxHtml, renderAiMappedXlsxTemplate, renderTemplate, savedTemplate, templateDetails, templateFormats, type QuoteTemplate } from "./quote-template.js";

import type { AcceptanceRecord, CatalogItem, Company, CompanyFile, CompanyProfileDetails, ContactRequestStatus, Contract, GeneratedExportJob, PlanContactRequest, Quote, QuoteRequest, QuoteStatus, SessionUser, SubscriptionPlan, UserAccount } from "./types.js";
const app = createQuotationRouter();

const require = createRequire(process.cwd() + "/package.json");

type PdfDocumentDefinition = Parameters<InstanceType<typeof PdfPrinter>["createPdfKitDocument"]>[0];


function sameProductLineName(first: string, second: string) {
  const tokens = (value: string): string[] => value.toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").match(/[a-z0-9]+/g) ?? [];
  const firstTokens = tokens(first);
  const secondTokens = tokens(second);
  const smaller = firstTokens.length <= secondTokens.length ? firstTokens : secondTokens;
  const larger = firstTokens.length <= secondTokens.length ? secondTokens : firstTokens;
  return firstTokens.join(" ") === secondTokens.join(" ")
    || (smaller.length >= 2 && smaller.every((token) => larger.includes(token)));
}


function removeAnsweredSupplementalPriceQuestions(fields: string[], lines: Quote["lines"]) {
  return fields.filter((field) => {
    const normalizedField = field.toLocaleLowerCase("vi").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
    if (!normalizedField.startsWith("cau hoi bo sung:") || !/\b(don gia|gia|price|pricing)\b/.test(normalizedField)) return true;
    return !lines.some((line) => line.source === "supplemental"
      && !line.priceUnavailable
      && line.name.trim()
      && line.unit.trim()
      && Number.isFinite(line.quantity) && line.quantity > 0
      && Number.isFinite(line.unitPrice) && line.unitPrice >= 0
      && sameProductLineName(field, line.name));
  });
}


function quoteForResponse(quote: Quote): Quote {
  const terms = { validityDays: quote.validityDays, completionDate: quote.completionDate };
  const information = cleanMissingInformation(quote.informationNeeded ?? [], quote.lines?.length > 0)
    .filter((field) => !isResolvedQuoteTermWarning(field, terms));
  const informationNeeded = removeAnsweredSupplementalPriceQuestions(information, quote.lines ?? []);
  const taxRateConfirmed = quote.taxRateConfirmed ?? !information.some(isTaxInformation);
  const shippingFeeConfirmed = quote.shippingFeeConfirmed ?? (quote.shippingFee != null || !information.some(isShippingInformation));
  const confirmedInformationNeeded = informationNeeded.filter((field) =>
    !(taxRateConfirmed && isTaxInformation(field)) && !(shippingFeeConfirmed && isShippingInformation(field))
    && !isAnsweredQuoteChargeQuestion(field, { taxRate: quote.taxRate, taxRateConfirmed, shippingFee: quote.shippingFee ?? (shippingFeeConfirmed ? 0 : null), shippingFeeConfirmed }),
  );
  if (!taxRateConfirmed && !confirmedInformationNeeded.some(isTaxInformation)) confirmedInformationNeeded.push("VAT: cần xác nhận thuế suất.");
  if (!shippingFeeConfirmed && !confirmedInformationNeeded.some(isShippingInformation)) confirmedInformationNeeded.push("Phí vận chuyển: cần xác nhận số tiền hoặc xác nhận miễn phí.");
  const unresolved = quote.requiresAiRecalculation === true || confirmedInformationNeeded.some((field) => isSupplementalProductInformation(field)
    ? !quote.lines.some((line) => line.source === "supplemental" && line.supplementalFor === field && !line.priceUnavailable)
    : !quote.additionalInformation?.[field]?.trim())
    || !taxRateConfirmed || !shippingFeeConfirmed;
  const status = quote.status === "draft" || quote.status === "needs_info"
    ? unresolved ? "needs_info" : "draft"
    : quote.status;
  return {
    ...quote,
    informationNeeded: confirmedInformationNeeded,
    taxRateConfirmed,
    taxAmount: taxRateConfirmed ? quote.taxAmount : 0,
    shippingFee: quote.shippingFee ?? (shippingFeeConfirmed ? 0 : null),
    shippingFeeConfirmed,
    total: Math.round((quote.subtotal + (taxRateConfirmed ? quote.taxAmount : 0) + (shippingFeeConfirmed ? quote.shippingFee ?? 0 : 0) + Number.EPSILON) * 100) / 100,
    status,
  };
}


async function customerQuoteWithPrices(db: Db, quote: Quote): Promise<Quote> {
  if (quote.kind !== "customer" || quote.customerPricesCaptured || !quote.lines.some((line) => line.unitPrice === 0)) return quote;
  const ids = quote.lines.map((line) => asId(line.catalogItemId)).filter((id): id is ObjectId => id !== null);
  const skus = quote.lines.map((line) => line.sku).filter(Boolean);
  const products = ids.length || skus.length
    ? await db.collection<CatalogItem>("catalogItems").find({ companyId: quote.companyId, $or: [{ _id: { $in: ids } }, { sku: { $in: skus } }] }).toArray()
    : [];
  const byId = new Map(products.map((item) => [String(item._id), item]));
  const bySku = new Map(products.map((item) => [item.sku, item]));
  return {
    ...quote,
    lines: quote.lines.map((line) => {
      if (line.unitPrice !== 0) return line;
      const product = byId.get(line.catalogItemId) ?? bySku.get(line.sku);
      return product
        ? { ...line, unitPrice: product.price, priceFromCurrentCatalog: true }
        : { ...line, priceUnavailable: true };
    }),
  };
}


function quoteHasUnresolvedInformation(quote: Quote) {
  return quoteHasApprovalBlockers(quoteForResponse(quote));
}


async function quoteInputContext(db: Db, quote: Quote) {
  const sourceQuoteId = quote.sourceQuote?.id ? asId(quote.sourceQuote.id) : null;
  const sourceQuote = sourceQuoteId ? await db.collection<Quote>("quotes").findOne({ _id: sourceQuoteId, companyId: quote.companyId }, { projection: { sourceRequirements: 1 } }) : null;
  const requestId = asId(quote.requestId);
  const source = requestId
    ? await db.collection<QuoteRequest>("quoteRequests").findOne({ _id: requestId, companyId: quote.companyId }, { projection: { requestText: 1, requestFile: 1, createdBy: 1, items: 1, suggestedProducts: 1 } })
    : null;
  let attachedText = "";
  const requestFileId = source?.requestFile ? asId(source.requestFile.id) : null;
  if (requestFileId && source?.requestFile && !/\.pdf$/i.test(source.requestFile.originalFilename)) {
    const file = await db.collection<RequestFile>("requestFiles").findOne({ _id: requestFileId, companyId: quote.companyId, uploadedBy: source.createdBy });
    if (file) {
      try {
        attachedText = (await requestFileContent(file))
          .map((part) => typeof part.text === "string" ? part.text : "")
          .filter(Boolean).join("\n");
      } catch { /* Use the text and extracted product details already saved with the request. */ }
    }
  }
  return [
    sourceQuote?.sourceRequirements ?? "",
    quote.sourceRequirements ?? "",
    source?.requestText ?? "",
    attachedText,
    ...(source?.items ?? []).flatMap((item) => Object.entries(item.attributes ?? {}).flat()),
    ...(source?.suggestedProducts ?? []).flatMap((product) => [product.name, product.description]),
  ].filter(Boolean).join("\n");
}





interface PlatformSepaySettingsDocument extends Document {
  _id: string;
  sepaySettings?: {
    bankCode: string;
    accountNumber: string;
    accountName: string;
    paymentPrefix: string;
    webhookApiKeyEncrypted?: string;
  };
  updatedAt: Date;
}


interface EffectiveSepaySettings {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  paymentPrefix: string;
  webhookApiKey: string;
}


interface CatalogImportSettingsDocument extends Document {
  companyId: string;
  sheets: PriceListSheetMapping[];
  createdAt: Date;
  updatedAt: Date;
}


type SubscriptionPaymentStatus = "pending" | "paid" | "superseded";


interface SubscriptionPayment extends Document {
  code: string;
  companyId: string;
  createdBy: string;
  planCode: string;
  planName: string;
  amount: number;
  status: SubscriptionPaymentStatus;
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  sepayTransactionId?: string;
  subscriptionStartsAt?: Date;
  subscriptionExpiresAt?: Date;
}
function userOf(_request: express.Request) { return quotationContext().user; }


function scoped<T extends Document & { companyId: string }>(db: Db, collection: string, user: SessionUser) {
  return db.collection<T>(collection).find({ companyId: user.companyId } as Filter<T>);
}


function asId(value: string | string[] | undefined) {
  if (typeof value !== "string") return undefined;
  return ObjectId.isValid(value) ? new ObjectId(value) : undefined;
}


function fail(response: express.Response, message: string, status = 400) {
  response.status(status).json({ error: publicErrorMessage(message) });
}


function validText(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maximum;
}


function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 250 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}


const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;


function vietnamMonthPeriod(now = new Date()) {
  const vietnamNow = new Date(now.getTime() + VIETNAM_UTC_OFFSET_MS);
  const start = new Date(Date.UTC(vietnamNow.getUTCFullYear(), vietnamNow.getUTCMonth(), 1) - VIETNAM_UTC_OFFSET_MS);
  const end = new Date(Date.UTC(vietnamNow.getUTCFullYear(), vietnamNow.getUTCMonth() + 1, 1) - VIETNAM_UTC_OFFSET_MS);
  return { start, end };
}
async function subscriptionUsage(db: Db, companyId: string) { const ctx=quotationContext(); const {start,end}=vietnamMonthPeriod(); const [quoteUsed, templateUsed, ai]=await Promise.all([db.collection('quotes').countDocuments({companyId,createdAt:{$gte:start,$lt:end}}),db.collection('quoteTemplates').countDocuments({companyId,deletedAt:{$exists:false}}),aiSubscriptionService.summary(ctx.companyCode)]); const plan={code:'erp',name:'Gói ERP',description:'Quyền sử dụng theo cấu hình ERP',monthlyPrice:null,quoteLimit:null,aiLimit:ai?.aiLimit??0,templateLimit:null,active:true,featured:false,displayOrder:0,createdAt:start,updatedAt:start};return {plan,subscriptionExpiresAt:ai?.expiresAt??null,quotes:{used:quoteUsed,limit:null,remaining:null,periodStart:start.toISOString(),periodEnd:end.toISOString()},templates:{used:templateUsed,limit:null,remaining:null},ai:{used:ai?.used??0,limit:ai?.aiLimit??0,remaining:ai?.remaining??0,periodStart:start.toISOString(),periodEnd:end.toISOString()}}; }


function quoteQuotaMessage(plan: SubscriptionPlan) {
  return `Gói ${plan.name} đã hết ${plan.quoteLimit} lượt tạo báo giá trong tháng này. Hạn mức sẽ được làm mới vào đầu tháng sau.`;
}


class AiQuotaExceededError extends Error {}
async function withAiUsage<T>(_db: Db, _user: SessionUser, kind: string, work: () => Promise<T>): Promise<T> { return runQuotationAi(kind, work); }


function templateQuotaMessage(plan: SubscriptionPlan) {
  return `Gói ${plan.name} đã đạt giới hạn ${plan.templateLimit} mẫu tài liệu. Hãy liên hệ quản trị viên để nâng cấp gói.`;
}


async function enforceTemplateQuota(request: express.Request, response: express.Response, next: express.NextFunction) {
  try {
    const usage = await subscriptionUsage(await connectDatabase(), userOf(request).companyId);
    if (usage.templates.limit !== null && usage.templates.used >= usage.templates.limit) {
      return fail(response, templateQuotaMessage(usage.plan), 429);
    }
    next();
  } catch (error) {
    next(error);
  }
}


async function enforceQuoteQuota(request: express.Request, response: express.Response, next: express.NextFunction) {
  try {
    const usage = await subscriptionUsage(await connectDatabase(), userOf(request).companyId);
    if (usage.quotes.limit !== null && usage.quotes.used >= usage.quotes.limit) {
      return fail(response, quoteQuotaMessage(usage.plan), 429);
    }
    next();
  } catch (error) {
    next(error);
  }
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}


function isDuplicateKey(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
}


function currentCatalogFilter(companyId: string): Document {
  const today = new Date().toISOString().slice(0, 10);
  return {
    companyId,
    deletedAt: null,
    active: true,
    $and: [
      { $or: [{ effectiveFrom: { $exists: false } }, { effectiveFrom: null }, { effectiveFrom: { $lte: today } }] },
      { $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: today } }] },
    ],
  };
}


function parseCatalogImportMapping(encoded: string | undefined, rows: PriceListAnalysisRow[]): PriceListSheetMapping[] | undefined {
  if (!encoded) return undefined;
  let parsed: unknown;
  try { parsed = JSON.parse(decodeURIComponent(encoded)); }
  catch { throw new Error("Cấu hình ghép cột không hợp lệ. Hãy xem trước file và chọn lại các cột."); }
  const allowedRoles = new Set<PriceListColumnRole>(["sku", "name", "unit", "price", "currency", "description", "effectiveFrom", "effectiveTo", "attribute", "ignore"]);
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 20) throw new Error("Chọn từ 1 đến 20 sheet để nhập.");
  const mappings: PriceListSheetMapping[] = [];
  const mappedSheets = new Set<string>();
  for (const value of parsed) {
    if (!isRecord(value) || typeof value.sheet !== "string" || !value.sheet.trim() || value.sheet.length > 100 || !Number.isInteger(value.headerRow) || Number(value.headerRow) < 1 || Number(value.headerRow) > 30 || !Array.isArray(value.roles) || value.roles.length === 0 || value.roles.length > 200) {
      throw new Error("Cấu hình sheet hoặc tiêu đề cột không hợp lệ.");
    }
    if (mappedSheets.has(value.sheet)) throw new Error(`Sheet ${value.sheet} chỉ được chọn một lần.`);
    mappedSheets.add(value.sheet);
    if (!value.roles.every((role) => typeof role === "string" && allowedRoles.has(role as PriceListColumnRole))) {
      throw new Error("Cách ghép cột không hợp lệ.");
    }
    const header = rows.find((row) => row.sheet === value.sheet && row.row === Number(value.headerRow));
    if (!header || header.cells.length !== value.roles.length) throw new Error(`Tiêu đề sheet ${value.sheet} không khớp với file đã xem trước. Hãy xem trước file và chọn lại cột.`);
    mappings.push({ sheet: value.sheet, headerRow: Number(value.headerRow), headers: header.cells, roles: value.roles as PriceListColumnRole[] });
  }
  return mappings;
}


async function writeAudit(db: Db, user: SessionUser, action: string, entityType: string, entityId: string, details: Record<string, unknown> = {}) {
  await db.collection("auditLogs").insertOne({
    companyId: user.companyId,
    actorId: user.id,
    action,
    entityType,
    entityId,
    details,
    createdAt: new Date(),
  });
}


function uploadedFileDetails(file: CompanyFile) {
  return {
    _id: file._id?.toHexString(),
    originalFilename: file.originalFilename,
    mimeType: file.mimeType,
    bytes: file.bytes,
    createdAt: file.createdAt,
  };
}


class GeneratedExportStorageError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GeneratedExportStorageError";
  }
}
function generatedExportErrorStatus(error: unknown) { return Number((error as any)?.statusCode || (error as any)?.status || 422); }
export async function storeGeneratedExport(db: Db, user: SessionUser, filename: string, mimeType: string, bytes: Buffer) { return storeQuotationExport(db, user, filename, mimeType, bytes); }
async function queueGeneratedExport(_db: Db, _user: SessionUser, kind: string, sourceId: string, _work: () => Promise<{ filename: string; mimeType: string; bytes: Buffer }>) { return queueQuotationExport(kind, sourceId); }
export async function renderCustomerQuoteExport(db: Db, user: SessionUser, sourceQuote: Quote) {
  if (!sourceQuote.template) throw new Error("Báo giá khách chưa lưu mẫu file đã chọn.");
  const template = await savedTemplate(db, sourceQuote.companyId, sourceQuote.template);
  if (!("quote" === template.category || template.category == null)) throw new Error("Mẫu đã chọn không còn là mẫu báo giá.");
  const quote = await customerQuoteWithPrices(db, sourceQuote);
  const inputContext = await quoteInputContext(db, quote);
  let bytes: Buffer;
  if (template.extension === "xlsx") {
    bytes = await withAiUsage(db, user, "customer_quote_export_template", () => renderAiMappedXlsxTemplate(template, quote, inputContext));
  } else if (directDocumentEditorEnabled()) {
    bytes = await withAiUsage(db, user, "customer_quote_export_template", () => renderTemplate(template, quote, inputContext));
  } else {
    const plan = await withAiUsage(db, user, "customer_quote_export_template", () => createTemplateFillPlan(template, quote, inputContext));
    const quoteWithPlan = { ...quote, templateFillPlan: plan };
    if (quote._id) await db.collection<Quote>("quotes").updateOne({ _id: quote._id, companyId: quote.companyId }, { $set: { templateFillPlan: plan } });
    bytes = await renderTemplate(template, quoteWithPlan, inputContext);
  }
  const extension = template.extension;
  const filename = `${quote.quoteNumber}${quote.status === "approved" ? "" : "-nhap"}.${extension}`;
  const mimeType = templateFormats[extension];
  if (!mimeType) throw new Error("Định dạng mẫu báo giá không được hỗ trợ để lưu.");
  return { filename, mimeType, bytes };
}


async function queueCustomerQuoteExport(db: Db, user: SessionUser, quote: Quote) {
  if (!quote._id) throw new Error("Báo giá chưa được lưu nên không thể tạo file.");
  return queueGeneratedExport(db, user, "customer_quote", quote._id.toHexString(), () => renderCustomerQuoteExport(db, user, quote));
}


async function ensureCustomerQuoteExport(db: Db, user: SessionUser, quote: Quote) {
  if (!quote._id) throw new Error("Báo giá chưa được lưu nên không thể tạo file.");
  const latestJob = await db.collection<GeneratedExportJob>("generatedExportJobs").findOne({
    companyId: user.companyId,
    sourceId: quote._id.toHexString(),
    kind: "customer_quote",
  }, { sort: { createdAt: -1 } });
  if (latestJob && latestJob.status !== "failed") return { jobId: latestJob._id!.toHexString(), status: latestJob.status };
  return queueCustomerQuoteExport(db, user, quote);
}


function quoteLineDetails(line: Quote["lines"][number]) {
  const description = line.description?.trim() ? [`Mô tả: ${line.description.trim()}`] : [];
  const catalogDetails = Object.entries(line.catalogAttributes ?? {}).map(([key, value]) => `${key}: ${value}`);
  const requestedDetails = Object.entries(line.attributes ?? {}).map(([key, value]) => `Yêu cầu ${key}: ${value}`);
  return [...description, ...catalogDetails, ...requestedDetails].join(" · ");
}


function makePdf(quote: Quote) {
  const virtualFonts = require("pdfmake/build/vfs_fonts.js") as Record<string, string>;
  const loadFont = (fileName: string) => {
    const contents = virtualFonts[fileName];
    if (!contents) throw new Error(`PDF font is missing: ${fileName}`);
    return Buffer.from(contents, "base64");
  };
  const printer = new PdfPrinter({
    Roboto: {
      normal: loadFont("Roboto-Regular.ttf"),
      bold: loadFont("Roboto-Medium.ttf"),
      italics: loadFont("Roboto-Italic.ttf"),
      bolditalics: loadFont("Roboto-MediumItalic.ttf"),
    },
  });
  const definition: PdfDocumentDefinition = {
    pageSize: "A4",
    pageMargins: [48, 48, 48, 54],
    defaultStyle: { font: "Roboto", fontSize: 10, color: "#26343c" },
    content: [
      { text: "BÁO GIÁ", style: "title" },
      { text: `Số ${quote.quoteNumber}`, style: "subtitle", margin: [0, 4, 0, 24] },
      { text: "THÔNG TIN KHÁCH HÀNG", style: "section" },
      { columns: [{ width: "*", text: `Khách hàng: ${quote.customerName}` }, { width: "*", text: `Email: ${quote.customerEmail || "—"}`, alignment: "right" }], margin: [0, 5, 0, 22] },
      ...(quote.customerPhone ? [{ text: `Số điện thoại: ${quote.customerPhone}`, margin: [0, 0, 0, 12] as [number, number, number, number] }] : []),
      {
        table: {
          headerRows: 1,
          widths: [52, "*", 55, 42, 80, 85],
          body: [
            ["Mã hàng", "Tên sản phẩm", "SL", "ĐVT", "Đơn giá", "Thành tiền"],
            ...quote.lines.map((line) => [
              line.sku,
              `${line.name}${quoteLineDetails(line) ? `\n${quoteLineDetails(line)}` : ""}`,
              { text: String(line.quantity), alignment: "right" as const },
              { text: line.unit, alignment: "center" as const },
              { text: formatMoney(line.unitPrice, quote.currency), alignment: "right" as const },
              { text: formatMoney(line.lineTotal, quote.currency), alignment: "right" as const },
            ]),
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => rowIndex === 0 ? "#eaf2ef" : null,
          hLineColor: () => "#dce4e1",
          vLineColor: () => "#dce4e1",
          paddingLeft: () => 7,
          paddingRight: () => 7,
          paddingTop: () => 8,
          paddingBottom: () => 8,
        },
      },
      {
        columns: [
          { width: "*", text: "Giá được tính từ bảng giá đã xác nhận tại thời điểm tạo báo giá.", color: "#74817f", fontSize: 8, margin: [0, 16, 0, 0] },
          { width: 210, table: { widths: ["*", 95], body: [
            ["Tạm tính", { text: formatMoney(quote.subtotal, quote.currency), alignment: "right" }],
            ["Phí vận chuyển", { text: formatMoney(quote.shippingFee ?? 0, quote.currency), alignment: "right" }],
            [`Thuế (${(quote.taxRate * 100).toLocaleString("vi-VN")}%)`, { text: formatMoney(quote.taxAmount, quote.currency), alignment: "right" }],
            [{ text: "TỔNG CỘNG", bold: true }, { text: formatMoney(quote.total, quote.currency), bold: true, alignment: "right" }],
          ] }, layout: "noBorders", margin: [0, 12, 0, 0] },
        ],
      },
      ...[
        ...(quote.validityDays == null ? [] : [`Hiệu lực báo giá: ${quote.validityDays} ngày`]),
        ...(quote.completionDate ? [`Hạn hoàn thành: ${new Date(`${quote.completionDate}T00:00:00Z`).toLocaleDateString("vi-VN", { timeZone: "UTC" })}`] : []),
      ].map((text) => ({ text, margin: [0, 4, 0, 0] as [number, number, number, number] })),
      { text: `Ngày tạo: ${new Date(quote.createdAt).toLocaleDateString("vi-VN")}`, color: "#74817f", fontSize: 8, margin: [0, 36, 0, 0] },
    ],
    styles: {
      title: { fontSize: 26, bold: true, color: "#1e4d40", characterSpacing: 0.4 },
      subtitle: { fontSize: 10, color: "#74817f" },
      section: { fontSize: 9, bold: true, color: "#45635b", characterSpacing: 0.8 },
    },
  };
  const document = printer.createPdfKitDocument(definition);
  return document;
}


function makePdfBuffer(quote: Quote): Promise<Buffer> {
  const document = makePdf(quote);
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.end();
  });
}


function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${new Intl.NumberFormat("vi-VN").format(amount)} ${currency}`;
  }
}


app.get("/usage", async (request, response) => {
  const usage = await subscriptionUsage(await connectDatabase(), userOf(request).companyId);
  response.json({ ...usage, subscriptionExpiresAt: usage.subscriptionExpiresAt?.toISOString() ?? null, plan: usage.plan });
});


app.get("/quote-templates", async (request, response) => {
  const db = await connectDatabase();
  const user = userOf(request);
  const category = (request.query.category === undefined ? "quote" : String(request.query.category)) as NonNullable<QuoteTemplate["category"]>;
  if (!["quote", "estimate", "contract", "acceptance", "settlement"].includes(category)) return fail(response, "Loại mẫu không hợp lệ.");
  const cursor = request.query.cursor === undefined ? undefined : asId(String(request.query.cursor));
  if (request.query.cursor !== undefined && !cursor) return fail(response, "Trang danh sách mẫu không hợp lệ.");
  const company = await db.collection<Company>("companies").findOne({ _id: new ObjectId(user.companyId) }, { projection: { quoteTemplateId: 1 } });
  const templates = await db.collection<QuoteTemplate>("quoteTemplates")
    .find({ companyId: user.companyId, deletedAt: { $exists: false }, category: category === "quote" ? { $in: ["quote", null] } : category === "acceptance" ? { $in: ["acceptance", "settlement"] } : category, ...(cursor ? { _id: { $lt: cursor } } : {}) }, { projection: { data: 0, fillPlanCache: 0, xlsxFillPlanCache: 0 } })
    .sort({ _id: -1 }).limit(13).toArray();
  const page = templates.slice(0, 12);
  response.json({ templates: page.map(templateDetails), defaultTemplateId: category === "quote" ? company?.quoteTemplateId ?? null : page[0]?._id?.toHexString() ?? null, nextCursor: templates.length > 12 ? page[11]._id!.toHexString() : null });
});


app.get("/quote-template", async (request, response) => {
  const template = await currentTemplate(await connectDatabase(), userOf(request).companyId);
  response.json({ template: template ? templateDetails(template) : null });
});


app.post("/quote-template", enforceTemplateQuota, express.raw({ type: "application/octet-stream", limit: "10mb" }), async (request, response) => {
  const category = request.header("x-template-category") || "quote";
  if (!["quote", "estimate", "contract", "acceptance", "settlement"].includes(category)) return fail(response, "Loại mẫu không hợp lệ.");
  if (!Buffer.isBuffer(request.body) || !request.body.length) return fail(response, "Hãy chọn file mẫu báo giá.");
  let name: string;
  try { name = decodeURIComponent(request.header("x-template-name") ?? "").trim(); }
  catch { return fail(response, "Tên mẫu không hợp lệ."); }
  if (!name || name.length > 200 || /[\u0000-\u001f\u007f]/.test(name)) return fail(response, "Vui lòng nhập tên mẫu, tối đa 200 ký tự.");
  let originalFilename: string;
  try { originalFilename = decodeURIComponent(request.header("x-file-name") ?? "").split(/[\\/]/).pop()!.replace(/[\u0000-\u001f]/g, "").trim(); }
  catch { return fail(response, "Tên file không hợp lệ."); }
  if (!originalFilename || originalFilename.length > 255) return fail(response, "Tên file không hợp lệ.");
  const extension = originalFilename.split(".").pop()!.toLowerCase();
  try { await inspectUploadedTemplate(request.body, extension); }
  catch (error) { return fail(response, error instanceof Error ? error.message : "Không đọc được mẫu báo giá.", 422); }
  const db = await connectDatabase();
  const user = userOf(request);
  const companyId = new ObjectId(user.companyId);
  if (!await db.collection<Company>("companies").findOne({ _id: companyId })) return fail(response, "Không tìm thấy doanh nghiệp.", 404);
  const usage = await subscriptionUsage(db, user.companyId);
  if (usage.templates.limit !== null && usage.templates.used >= usage.templates.limit) return fail(response, templateQuotaMessage(usage.plan), 429);
  const template: QuoteTemplate = { companyId: user.companyId, category: category as QuoteTemplate["category"], name, originalFilename, extension, bytes: request.body.length, data: new Binary(request.body), createdAt: new Date(), uploadedBy: user.id };
  const result = await db.collection<QuoteTemplate>("quoteTemplates").insertOne(template);
  template._id = result.insertedId;
  if (category === "quote") await db.collection<Company>("companies").updateOne({ _id: companyId }, { $set: { quoteTemplateId: result.insertedId.toHexString(), updatedAt: new Date() } });
  await writeAudit(db, user, "quote_template_uploaded", "company", user.companyId, { templateId: result.insertedId.toHexString(), originalFilename, category });
  response.status(201).json({ template: templateDetails(template) });
});


app.patch("/quote-template/:id/category", async (request, response) => {
  const id = asId(request.params.id);
  const category = request.body?.category;
  if (!id || !["quote", "estimate", "contract", "acceptance", "settlement"].includes(category)) return fail(response, "Loại mẫu không hợp lệ.");
  const db = await connectDatabase();
  const user = userOf(request);
  const templates = db.collection<QuoteTemplate>("quoteTemplates");
  const current = await templates.findOne({ _id: id, companyId: user.companyId, deletedAt: { $exists: false } });
  if (!current) return fail(response, "Không tìm thấy mẫu.", 404);
  if (!["docx", "xlsx", "pdf"].includes(current.extension)) return fail(response, "Hãy chọn mẫu Word (.docx), Excel (.xlsx) hoặc PDF.", 422);
  const updated = await templates.findOneAndUpdate(
    { _id: id, companyId: user.companyId, deletedAt: { $exists: false } },
    { $set: { category, updatedAt: new Date() } }, { returnDocument: "after" },
  );
  if (!updated) return fail(response, "Không tìm thấy mẫu.", 404);
  if (current.category === "quote" || current.category == null || category === "quote") {
    const replacement = await templates.find({ companyId: user.companyId, deletedAt: { $exists: false }, category: { $in: ["quote", null] } }, { projection: { _id: 1 } }).sort({ _id: -1 }).limit(1).next();
    await db.collection<Company>("companies").updateOne(
      { _id: new ObjectId(user.companyId), quoteTemplateId: id.toHexString() },
      replacement ? { $set: { quoteTemplateId: replacement._id!.toHexString(), updatedAt: new Date() } } : { $set: { updatedAt: new Date() }, $unset: { quoteTemplateId: "" } },
    );
    if (category === "quote") await db.collection<Company>("companies").updateOne({ _id: new ObjectId(user.companyId) }, { $set: { quoteTemplateId: id.toHexString(), updatedAt: new Date() } });
  }
  await writeAudit(db, user, "quote_template_recategorized", "quoteTemplate", id.toHexString(), { from: current.category ?? "quote", to: category });
  response.json({ template: templateDetails(updated) });
});


app.delete("/quote-template/:id", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã mẫu không hợp lệ.");
  const db = await connectDatabase();
  const user = userOf(request);
  const templates = db.collection<QuoteTemplate>("quoteTemplates");
  const removed = await templates.findOneAndUpdate(
    { _id: id, companyId: user.companyId, deletedAt: { $exists: false } },
    { $set: { deletedAt: new Date() } },
    { returnDocument: "before", projection: { name: 1, originalFilename: 1 } },
  );
  if (!removed) return fail(response, "Không tìm thấy mẫu báo giá.", 404);
  const replacement = await templates.find({ companyId: user.companyId, deletedAt: { $exists: false }, category: { $in: ["quote", null] } }, { projection: { _id: 1 } })
    .sort({ _id: -1 }).limit(1).next();
  await db.collection<Company>("companies").updateOne(
    { _id: new ObjectId(user.companyId), quoteTemplateId: id.toHexString() },
    replacement
      ? { $set: { quoteTemplateId: replacement._id!.toHexString(), updatedAt: new Date() } }
      : { $set: { updatedAt: new Date() }, $unset: { quoteTemplateId: "" } },
  );
  await writeAudit(db, user, "quote_template_deleted", "quoteTemplate", id.toHexString(), { name: removed.name || removed.originalFilename });
  response.json({ deleted: true });
});


app.get("/quote-template/:id/file", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã mẫu không hợp lệ.");
  const db = await connectDatabase();
  const template = await db.collection<QuoteTemplate>("quoteTemplates").findOne({ _id: id, companyId: userOf(request).companyId }, { projection: { fillPlanCache: 0, xlsxFillPlanCache: 0 } });
  if (!template) return fail(response, "Không tìm thấy mẫu.", 404);
  const bytes = Buffer.from(template.data.buffer);
  if (request.query.preview === "1" && template.extension === "docx") {
    response.type("html").setHeader("Content-Disposition", "inline").send(previewDocxHtml(bytes, template.originalFilename));
    return;
  }
  response.setHeader("Content-Type", templateFormats[template.extension]);
  response.setHeader("Content-Disposition", `${request.query.preview === "1" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(template.originalFilename)}`);
  response.send(bytes);
});


app.get("/price-list/:id/file", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã bảng giá không hợp lệ.");
  const file = await (await connectDatabase()).collection<PriceList>("priceLists").findOne({ _id: id, companyId: userOf(request).companyId }, { projection: { analysisRows: 0 } });
  if (!file) return fail(response, "Không tìm thấy bảng giá.", 404);
  response.type(file.originalFilename.split(".").pop() === "csv" ? "text/csv" : "application/octet-stream")
    .setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.originalFilename)}`)
    .send(Buffer.from(file.data.buffer));
});


app.get("/files", async (request, response) => {
  const db = await connectDatabase();
  const user = userOf(request);
  const files = await db.collection<CompanyFile>("companyFiles")
    .find({ companyId: user.companyId, kind: { $in: ["budget", "estimate", "estimate_draft", "customer_quote", ...(canQuotation("quotation-contract:read") ? ["contract"] : []), ...(canQuotation("quotation-acceptance:read") ? ["acceptance", "settlement"] : [])] } })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  response.json({ files: files.map(uploadedFileDetails) });
});


app.get("/export-jobs/:id", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã tác vụ xuất không hợp lệ.");
  const user = userOf(request);
  const job = await (await connectDatabase()).collection<GeneratedExportJob>("generatedExportJobs").findOne({
    _id: id,
    companyId: user.companyId,
    createdBy: user.id,
  });
  if (!job) return fail(response, "Không tìm thấy tác vụ xuất.", 404);
  response.json({ job: {
    id: job._id?.toHexString(),
    kind: job.kind,
    status: job.status,
    filename: job.filename,
    fileId: job.fileId,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  } });
});


app.get("/generated-export-files/latest", async (request, response) => {
  const sourceId = asId(String(request.query.sourceId ?? ""));
  const kind = String(request.query.kind ?? "");
  const allowedKinds = new Set(["budget", "contract", "acceptance", "settlement", "customer_quote", "estimate", "estimate_draft"]);
  if (!sourceId || !allowedKinds.has(kind)) return fail(response, "Loại hoặc mã hồ sơ xuất file không hợp lệ.");
  const user = userOf(request);
  const db = await connectDatabase();
  const latestCustomerJob = kind === "customer_quote" ? await db.collection<GeneratedExportJob>("generatedExportJobs").findOne({
    companyId: user.companyId,
    sourceId: sourceId.toHexString(),
    kind,
  }, { sort: { createdAt: -1 } }) : null;
  const job = kind === "customer_quote" ? latestCustomerJob : await db.collection<GeneratedExportJob>("generatedExportJobs").findOne({
    companyId: user.companyId,
    sourceId: sourceId.toHexString(),
    kind,
    status: "completed",
    fileId: { $exists: true },
  }, { sort: { updatedAt: -1 } });
  const fileId = job?.status === "completed" && job.fileId ? asId(job.fileId) : null;
  let file = fileId
    ? await db.collection<CompanyFile>("companyFiles").findOne({ _id: fileId, companyId: user.companyId })
    : null;
  if (!file && (kind !== "customer_quote" || !latestCustomerJob)) {
    const filenameCandidates: string[] = [];
    if (kind === "budget") {
      filenameCandidates.push(`phuong-an-${sourceId.toHexString()}.xlsx`);
    } else if (kind === "contract") {
      const contract = await db.collection<Contract>("contracts").findOne({ _id: sourceId, companyId: user.companyId });
      if (contract) filenameCandidates.push(`${contract.contractNumber}.docx`, `${contract.contractNumber}.pdf`);
    } else if (kind === "acceptance" || kind === "settlement") {
      const record = await db.collection<AcceptanceRecord>("acceptanceRecords").findOne({ _id: sourceId, companyId: user.companyId });
      if (record) filenameCandidates.push(kind === "settlement"
        ? `Ho-so-quyet-toan-${record.acceptanceNumber}.xlsx`
        : `${record.acceptanceNumber}.docx`);
    } else {
      const quote = await db.collection<Quote>("quotes").findOne({ _id: sourceId, companyId: user.companyId });
      if (quote) {
        if (kind === "customer_quote") filenameCandidates.push(...["xlsx", "docx", "pdf"].flatMap((extension) => [`${quote.quoteNumber}.${extension}`, `${quote.quoteNumber}-nhap.${extension}`]));
        else if (kind === "estimate_draft") filenameCandidates.push(`${quote.quoteNumber}-nhap.xlsx`);
        else filenameCandidates.push(`${quote.quoteNumber}.xlsx`, `${quote.quoteNumber}.docx`, `${quote.quoteNumber}.pdf`);
      }
    }
    if (filenameCandidates.length) {
      file = await db.collection<CompanyFile>("companyFiles").find({
        companyId: user.companyId,
        originalFilename: { $in: filenameCandidates },
      }).sort({ createdAt: -1 }).limit(1).next();
    }
  }
  if (file && kind === "estimate" && file.mimeType === templateFormats.xlsx) {
    const quote = await db.collection<Quote>("quotes").findOne({ _id: sourceId, companyId: user.companyId });
    const templateId = quote?.template?.id ? asId(quote.template.id) : null;
    const template = templateId
      ? await db.collection<QuoteTemplate>("quoteTemplates").findOne({ _id: templateId, companyId: user.companyId, extension: "xlsx" })
      : null;
    if (template) {
      const matchesTemplate = async (candidate: CompanyFile) => {
        try {
          assertXlsxWorksheetsPreserved(template, await downloadCompanyFile(candidate.assetId, config.cloudinary));
          return true;
        } catch {
          return false;
        }
      };
      if (!(await matchesTemplate(file))) {
        const savedFiles = await db.collection<CompanyFile>("companyFiles").find({
          companyId: user.companyId,
          originalFilename: file.originalFilename,
          mimeType: templateFormats.xlsx,
        }).sort({ createdAt: -1 }).toArray();
        file = null;
        for (const candidate of savedFiles) {
          if (await matchesTemplate(candidate)) {
            file = candidate;
            break;
          }
        }
      }
    }
  }
  response.json({ file: file ? {
    id: file._id?.toHexString(),
    filename: file.originalFilename,
    mimeType: file.mimeType,
    createdAt: file.createdAt,
  } : null, job: latestCustomerJob ? {
    id: latestCustomerJob._id?.toHexString(),
    status: latestCustomerJob.status,
    error: latestCustomerJob.error,
    filename: latestCustomerJob.filename,
    createdAt: latestCustomerJob.createdAt,
    updatedAt: latestCustomerJob.updatedAt,
  } : null });
});


app.get("/files/:id/download", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã tệp không hợp lệ.");
  const user = userOf(request);
  const file = await (await connectDatabase()).collection<CompanyFile>("companyFiles").findOne({ _id: id, companyId: user.companyId });
  if (!file) return fail(response, "Không tìm thấy tệp.", 404);
  try {
    const bytes = await downloadCompanyFile(file.assetId, config.cloudinary);
    response.setHeader("Content-Type", file.mimeType)
      .setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.originalFilename)}`)
      .setHeader("X-Content-Type-Options", "nosniff")
      .send(bytes);
  } catch (error) { return fail(response, error instanceof Error ? error.message : "Không thể tải tệp.", 502); }
});


app.get("/files/:id/preview", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã tệp không hợp lệ.");
  const user = userOf(request);
  const file = await (await connectDatabase()).collection<CompanyFile>("companyFiles").findOne({ _id: id, companyId: user.companyId });
  if (!file) return fail(response, "Không tìm thấy tệp.", 404);
  try {
    const bytes = await downloadCompanyFile(file.assetId, config.cloudinary);
    response.setHeader("Content-Type", file.mimeType).setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.originalFilename)}`).setHeader("X-Content-Type-Options", "nosniff").send(bytes);
  } catch (error) { return fail(response, error instanceof Error ? error.message : "Không thể tải tệp xem trước.", 502); }
});


app.post("/files", express.raw({ type: "application/octet-stream", limit: "10mb" }), async (request, response) => {
  if (!Buffer.isBuffer(request.body) || request.body.length === 0) return fail(response, "Hãy chọn tệp cần tải lên.");
  const encodedName = request.header("x-file-name") ?? "";
  let requestedName = "";
  try { requestedName = decodeURIComponent(encodedName); } catch { return fail(response, "Tên tệp không hợp lệ."); }
  const originalFilename = requestedName.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f]/g, "").trim() ?? "";
  if (!originalFilename || originalFilename.length > 255) return fail(response, "Tên tệp không hợp lệ.");
  const extension = originalFilename.match(/\.[^.]+$/)?.[0].toLocaleLowerCase("en") ?? "";
  const mimeByExtension: Record<string, string> = {
    ".csv": "text/csv",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  const allowedMimeType = mimeByExtension[extension];
  const requestedMimeType = request.header("x-file-type")?.split(";")[0].trim().toLocaleLowerCase("en") ?? "";
  if (!allowedMimeType || (requestedMimeType && requestedMimeType !== "application/octet-stream" && requestedMimeType !== allowedMimeType)) {
    return fail(response, "Định dạng tệp chưa được hỗ trợ. Hãy dùng ảnh PNG/JPG/WEBP/GIF, PDF, CSV hoặc Excel.");
  }
  if (request.body.length > 10 * 1024 * 1024) return fail(response, "Tệp không được vượt quá 10 MB.");

  const db = await connectDatabase();
  const user = userOf(request);
  if (!config.cloudinaryConfigured) return fail(response, "Cloudinary chưa được cấu hình trong file .env của máy chủ.", 409);
  let uploaded;
  try {
    uploaded = await uploadCompanyFile(request.body, originalFilename, allowedMimeType, user.companyId, config.cloudinary);
  } catch (error) {
    return fail(response, error instanceof Error ? error.message : "Không thể tải tệp lên Cloudinary.", 502);
  }
  const file: CompanyFile = {
    companyId: user.companyId,
    uploadedBy: user.id,
    originalFilename,
    mimeType: allowedMimeType,
    bytes: request.body.length,
    publicId: uploaded.publicId,
    assetId: uploaded.assetId,
    resourceType: uploaded.resourceType,
    createdAt: new Date(),
  };
  const result = await db.collection<CompanyFile>("companyFiles").insertOne(file);
  file._id = result.insertedId;
  await writeAudit(db, user, "company_file_uploaded", "file", file._id.toHexString(), {
    originalFilename,
    mimeType: allowedMimeType,
    bytes: file.bytes,
  });
  response.status(201).json({ file: uploadedFileDetails(file) });
});


app.get("/dashboard", async (request, response) => {
  const db = await connectDatabase();
  const user = userOf(request);
  const quotes = db.collection<Quote>("quotes");
  const [total, drafts, pending, approved, recent] = await Promise.all([
    quotes.countDocuments({ companyId: user.companyId, kind: { $ne: "customer" } }),
    quotes.countDocuments({ companyId: user.companyId, kind: { $ne: "customer" }, status: "draft" }),
    quotes.countDocuments({ companyId: user.companyId, kind: { $ne: "customer" }, status: "pending_review" }),
    quotes.countDocuments({ companyId: user.companyId, kind: { $ne: "customer" }, status: "approved" }),
    quotes.find({ companyId: user.companyId, kind: { $ne: "customer" } }).sort({ createdAt: -1, _id: -1 }).limit(3).toArray(),
  ]);
  response.json({ counts: { total, drafts, pending, approved }, recent });
});


app.get("/price-list", async (request, response) => {
  const files = await (await connectDatabase()).collection<PriceList>("priceLists").find({ companyId: userOf(request).companyId }, { projection: { data: 0, analysisRows: 0 } }).sort({ updatedAt: -1, _id: -1 }).toArray();
  response.json({ files });
});


app.post("/price-list/preview", express.raw({ type: "application/octet-stream", limit: "5mb" }), async (request, response) => {
  if (!Buffer.isBuffer(request.body) || !request.body.length) return fail(response, "Hãy chọn file bảng giá.");
  let originalFilename: string;
  try { originalFilename = decodeURIComponent(request.header("x-file-name") ?? "").split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g, "").trim(); }
  catch { return fail(response, "Tên file không hợp lệ."); }
  if (!originalFilename || originalFilename.length > 255 || !/\.(csv|xlsx|xls)$/i.test(originalFilename)) return fail(response, "Chọn file CSV, XLSX hoặc XLS.");
  const user = userOf(request);
  const file: PriceList = { companyId: user.companyId, originalFilename, bytes: request.body.length, data: new Binary(request.body), uploadedBy: user.id, updatedAt: new Date() };
  try {
    file.analysisRows = extractPriceListRows(file);
    const db = await connectDatabase();
    const saved = await db.collection<CatalogImportSettingsDocument>("catalogImportMappings").findOne({ companyId: user.companyId });
    response.json({ preview: previewCatalogImport(file, saved?.sheets ?? []) });
  } catch (error) { return fail(response, error instanceof Error ? error.message : "Không đọc được bảng giá.", 422); }
});


app.post("/price-list", express.raw({ type: "application/octet-stream", limit: "5mb" }), async (request, response) => {
  if (!Buffer.isBuffer(request.body) || !request.body.length) return fail(response, "Hãy chọn file bảng giá.");
  let originalFilename: string;
  try { originalFilename = decodeURIComponent(request.header("x-file-name") ?? "").split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g, "").trim(); }
  catch { return fail(response, "Tên file không hợp lệ."); }
  if (!originalFilename || originalFilename.length > 255 || !/\.(csv|xlsx|xls)$/i.test(originalFilename)) return fail(response, "Chọn file CSV, XLSX hoặc XLS.");
  const rawMapping = request.header("x-catalog-import-mapping");
  let mappings: PriceListSheetMapping[] | undefined;
  const user = userOf(request);
  const file: PriceList = { companyId: user.companyId, originalFilename, bytes: request.body.length, data: new Binary(request.body), uploadedBy: user.id, updatedAt: new Date() };
  let imported: Awaited<ReturnType<typeof extractCatalogProducts>>;
  try {
    file.analysisRows = extractPriceListRows(file);
    mappings = parseCatalogImportMapping(rawMapping, file.analysisRows);
    imported = await extractCatalogProducts(file, mappings);
  }
  catch (error) { return fail(response, error instanceof Error ? error.message : "Không đọc được bảng giá.", 422); }
  const db = await connectDatabase();
  const now = new Date();
  const catalogCollection = db.collection<CatalogItem>("catalogItems");
  const existingItems = await catalogCollection.find({ companyId: user.companyId, sku: { $in: imported.products.map((product) => product.sku) } })
    .project({ sku: 1, name: 1, price: 1, currency: 1 })
    .toArray();
  const existingBySku = new Map(existingItems.map((item) => [item.sku, item]));
  const priceChanges = imported.products.flatMap((product) => {
    const previous = existingBySku.get(product.sku);
    if (!previous || (previous.price === product.price && previous.currency === product.currency)) return [];
    return [{ sku: product.sku, before: { price: previous.price, currency: previous.currency }, after: { price: product.price, currency: product.currency } }];
  });
  const catalogResult = await importCatalogProducts(imported.products, originalFilename);
  file.productCount = imported.products.length;
  file.skippedRows = imported.skippedRows;
  file.updatedAt = now;
  const saved = await db.collection<PriceList>("priceLists").insertOne(file);
  if (mappings) {
    const settings = db.collection<CatalogImportSettingsDocument>("catalogImportMappings");
    const previousMappings = await settings.findOne({ companyId: user.companyId });
    const normalizeHeader = (header: string) => header.toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, " ").trim();
    const sameTemplate = (left: PriceListSheetMapping, right: PriceListSheetMapping) => left.sheet === right.sheet
      && left.headers.length === right.headers.length
      && left.headers.every((header, index) => normalizeHeader(header) === normalizeHeader(right.headers[index] ?? ""));
    const mergedMappings = [...(previousMappings?.sheets ?? []).filter((saved) => !mappings!.some((mapping) => sameTemplate(saved, mapping))), ...mappings].slice(-50);
    await settings.updateOne(
      { companyId: user.companyId },
      { $set: { sheets: mergedMappings, updatedAt: now }, $setOnInsert: { companyId: user.companyId, createdAt: now } },
      { upsert: true },
    );
  }
  await writeAudit(db, user, "price_list_uploaded", "company", user.companyId, { originalFilename, productCount: imported.products.length, skippedRows: imported.skippedRows });
  await writeAudit(db, user, "catalog_imported", "catalog", user.companyId, { source: originalFilename, count: imported.products.length, inserted: catalogResult.upsertedCount, updated: catalogResult.matchedCount, priceChanges });
  response.status(201).json({
    file: { _id: saved.insertedId.toHexString(), originalFilename, bytes: file.bytes, updatedAt: file.updatedAt, productCount: file.productCount, skippedRows: file.skippedRows },
    imported: { productCount: imported.products.length, inserted: catalogResult.upsertedCount, updated: catalogResult.matchedCount, skippedRows: imported.skippedRows },
  });
});


registerCatalogRoutes(app);

app.post("/catalog/import/preview", (request, response) => {
  const rows: unknown = request.body?.rows;
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 2000) {
    fail(response, "Tệp cần có từ 1 đến 2.000 dòng dữ liệu.");
    return;
  }
  const normalized: CatalogImportRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const result = mapCatalogRow(row, index + 2, config.currency);
    if (result.ok === false) errors.push(result.error);
    else if (seen.has(result.value.sku.toLocaleLowerCase("vi"))) errors.push(`Dòng ${index + 2}: mã hàng bị lặp trong tệp.`);
    else {
      seen.add(result.value.sku.toLocaleLowerCase("vi"));
      normalized.push(result.value);
    }
  });
  response.json({ rows: normalized, errors, validCount: normalized.length, invalidCount: errors.length });
});


app.post("/catalog/import/confirm", async (request, response) => {
  if (request.body?.confirmed !== true || !Array.isArray(request.body?.rows)) {
    fail(response, "Cần xác nhận dữ liệu đã xem trước.");
    return;
  }
  const rows = request.body.rows as unknown[];
  if (rows.length === 0 || rows.length > 2000) {
    fail(response, "Tệp cần có từ 1 đến 2.000 dòng dữ liệu.");
    return;
  }
  const normalized: CatalogImportRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const result = mapCatalogRow(row, index + 2, config.currency);
    if (result.ok === false) errors.push(result.error);
    else if (seen.has(result.value.sku.toLocaleLowerCase("vi"))) errors.push(`Dòng ${index + 2}: mã hàng bị lặp trong tệp.`);
    else {
      seen.add(result.value.sku.toLocaleLowerCase("vi"));
      normalized.push(result.value);
    }
  });
  if (errors.length) {
    response.status(422).json({ error: "Có lỗi trong dữ liệu nhập.", errors });
    return;
  }
  const db = await connectDatabase();
  const user = userOf(request);
  const now = new Date();
  const catalogCollection = db.collection<CatalogItem>("catalogItems");
  const previousItems = await catalogCollection.find({ companyId: user.companyId, sku: { $in: normalized.map((row) => row.sku) } })
    .project({ sku: 1, price: 1, currency: 1 })
    .toArray();
  const previousBySku = new Map(previousItems.map((item) => [item.sku, item]));
  const priceChanges = normalized.flatMap((row) => {
    const previous = previousBySku.get(String(row.sku));
    if (!previous || (previous.price === row.price && previous.currency === row.currency)) return [];
    return [{ sku: row.sku, before: { price: previous.price, currency: previous.currency }, after: { price: row.price, currency: row.currency } }];
  });
  const result = await importCatalogProducts(normalized, "Nhập dữ liệu");
  await writeAudit(db, user, "catalog_imported", "catalog", user.companyId, { count: normalized.length, priceChanges });
  response.json({ imported: normalized.length, inserted: result.upsertedCount, updated: result.modifiedCount });
});


app.post("/request-files", enforceQuoteQuota, express.raw({ type: "application/octet-stream", limit: "10mb" }), async (request, response) => {
  if (!Buffer.isBuffer(request.body) || !request.body.length) return fail(response, "Hãy chọn file yêu cầu.");
  let originalFilename: string;
  try { originalFilename = decodeURIComponent(request.header("x-file-name") ?? "").split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g, "").trim(); }
  catch { return fail(response, "Tên file không hợp lệ."); }
  if (!originalFilename || originalFilename.length > 255) return fail(response, "Tên file không hợp lệ.");
  const user = userOf(request);
  const file: RequestFile = { companyId: user.companyId, uploadedBy: user.id, originalFilename, bytes: request.body.length, data: new Binary(request.body), createdAt: new Date() };
  try { await requestFileContent(file); }
  catch (error) { return fail(response, error instanceof Error ? error.message : "Không đọc được file yêu cầu.", 422); }
  const saved = await (await connectDatabase()).collection<RequestFile>("requestFiles").insertOne(file);
  response.status(201).json({ file: { id: saved.insertedId.toHexString(), originalFilename, bytes: file.bytes } });
});


app.get("/request-files/:id/preview", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã file yêu cầu không hợp lệ.");
  const user = userOf(request);
  const file = await (await connectDatabase()).collection<RequestFile>("requestFiles").findOne({ _id: id, companyId: user.companyId });
  if (!file) return fail(response, "Không tìm thấy file yêu cầu.", 404);
  const extension = file.originalFilename.split(".").pop()?.toLowerCase() ?? "";
  const mimeTypes: Record<string, string> = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain; charset=utf-8", csv: "text/csv; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel" };
  if (!mimeTypes[extension]) return fail(response, "Định dạng file này chưa hỗ trợ xem trước.", 415);
  if (extension === "docx") {
    response.type("html").setHeader("Content-Disposition", "inline").send(previewDocxHtml(Buffer.from(file.data.buffer), file.originalFilename));
    return;
  }
  response.setHeader("Content-Type", mimeTypes[extension]).setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.originalFilename)}`).setHeader("X-Content-Type-Options", "nosniff").send(Buffer.from(file.data.buffer));
});


app.post("/quote-requests", async (request, response) => {
  const { customerName = "", customerEmail = "", customerPhone = "", requestText = "", idempotencyKey } = request.body ?? {};
  const requestFileId = request.body?.requestFileId ? asId(String(request.body.requestFileId)) : undefined;
  const templateId = asId(String(request.body?.templateId ?? ""));
  const priceListId = asId(String(request.body?.priceListId ?? ""));
  if (!validText(idempotencyKey, 100) || typeof customerName !== "string" || customerName.length > 250 || typeof customerPhone !== "string" || customerPhone.length > 50 || typeof customerEmail !== "string" || customerEmail.length > 250 || typeof requestText !== "string" || requestText.length > 10_000 || (!requestText.trim() && !requestFileId) || (request.body?.requestFileId && !requestFileId) || !templateId || (request.body?.priceListId !== undefined && !priceListId)) {
    fail(response, "Hãy chọn mẫu dự toán và nhập yêu cầu khách hàng hoặc tải file yêu cầu (văn bản tối đa 10.000 ký tự).");
    return;
  }
  const db = await connectDatabase();
  const user = userOf(request);
  const requests = db.collection<QuoteRequest>("quoteRequests");
  const existing = await requests.findOne({ companyId: user.companyId, idempotencyKey });
  if (existing) {
    response.status(200).json({ request: existing });
    return;
  }
  const usage = await subscriptionUsage(db, user.companyId);
  if (usage.quotes.limit !== null && usage.quotes.used >= usage.quotes.limit) return fail(response, quoteQuotaMessage(usage.plan), 429);
  const template = await db.collection<QuoteTemplate>("quoteTemplates").findOne({ _id: templateId, companyId: user.companyId, deletedAt: { $exists: false }, category: "estimate" }, { projection: { data: 0, fillPlanCache: 0, xlsxFillPlanCache: 0 } });
  const priceList = priceListId ? await db.collection<PriceList>("priceLists").findOne({ _id: priceListId, companyId: user.companyId }, { projection: { data: 0, analysisRows: 0 } }) : null;
  if (!template || (priceListId && !priceList)) return fail(response, "Mẫu dự toán hoặc bảng giá không thuộc doanh nghiệp hoặc không còn tồn tại.", 404);
  const requestFile = requestFileId ? await db.collection<RequestFile>("requestFiles").findOne({ _id: requestFileId, companyId: user.companyId, uploadedBy: user.id }, { projection: { data: 0 } }) : null;
  if (requestFileId && !requestFile) return fail(response, "Không tìm thấy file yêu cầu đã tải lên.", 404);
  const document: QuoteRequest = {
    companyId: user.companyId,
    template: { id: template._id!.toHexString(), name: template.name || template.originalFilename, originalFilename: template.originalFilename },
    ...(priceList ? { priceListId: priceListId!.toHexString(), priceListFilename: priceList.originalFilename } : {}),
    ...(requestFile ? { requestFile: { id: requestFile._id.toHexString(), originalFilename: requestFile.originalFilename } } : {}),
    idempotencyKey,
    customerName: customerName.trim(),
    customerEmail: customerEmail.trim(),
    customerPhone: customerPhone.trim(),
    requestText: requestText.trim(),
    status: "not_found",
    items: [],
    missingFields: [],
    createdBy: user.id,
    createdAt: new Date(),
  };
  try {
    const result = await requests.insertOne(document);
    response.status(201).json({ request: { ...document, _id: result.insertedId } });
  } catch (error) {
    if (isDuplicateKey(error)) {
      const saved = await requests.findOne({ companyId: user.companyId, idempotencyKey });
      if (saved) {
        response.status(200).json({ request: saved });
        return;
      }
    }
    throw error;
  }
});


app.get("/quote-requests", async (request, response) => {
  const db = await connectDatabase();
  const user = userOf(request);
  const items = await scoped<QuoteRequest>(db, "quoteRequests", user).sort({ createdAt: -1 }).limit(50).toArray();
  response.json({ requests: items });
});


app.post("/quote-requests/:id/analyze", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã yêu cầu không hợp lệ.");
  const db = await connectDatabase();
  const user = userOf(request);
  const requests = db.collection<QuoteRequest>("quoteRequests");
  const quoteRequest = await requests.findOne({ _id: id, companyId: user.companyId });
  if (!quoteRequest) return fail(response, "Không tìm thấy yêu cầu.", 404);
  if (quoteRequest.analyzedAt) {
    const ids = [...quoteRequest.items.map(item => asId(item.catalogItemId)), ...(quoteRequest.candidates ?? []).map(item => asId(String(item._id)))].filter(Boolean);
    const currentProducts = await db.collection<CatalogItem>("catalogItems").find({ ...currentCatalogFilter(user.companyId), _id: { $in: ids } }).toArray();
    if (quoteRequest.items.some(item => !currentProducts.some(product => String(product._id) === item.catalogItemId))) return fail(response, "Danh mục sản phẩm đã thay đổi. Hãy sửa yêu cầu và phân tích lại.", 409);
    if (quoteRequest.items.some(item => currentProducts.find(product => String(product._id) === item.catalogItemId)?.unit !== item.unit)) return fail(response, "Đơn vị sản phẩm đã thay đổi. Hãy sửa yêu cầu và phân tích lại.", 409);
    const shippingRequested = isShippingInformation(quoteRequest.requestText);
    const shippingIds = new Set(shippingRequested
      ? (quoteRequest.candidates ?? []).filter((item) => isShippingInformation(`${item.name} ${item.description}`)).map((item) => String(item._id))
      : [],
    );
    const items = quoteRequest.items.filter((item) => !shippingIds.has(item.catalogItemId));
    const missingFields = quoteRequest.missingFields.map((field) => /(?:số chuyến|so chuyen|trip count)/i.test(field) ? "Xác nhận phí vận chuyển" : field);
    if (shippingRequested && !missingFields.some(isShippingInformation)) missingFields.push("Xác nhận phí vận chuyển");
    const suggestedProducts = (quoteRequest.suggestedProducts ?? []).filter((product) =>
      !shippingRequested || !isShippingInformation(product.name),
    );
    const inferredProducts = suggestUnmatchedExplicitRequestLines(quoteRequest.requestText, quoteRequest.candidates ?? [])
      .filter((product) => !isShippingInformation(product.name));
    for (const inferred of inferredProducts) {
      const alreadySuggested = suggestedProducts.some((product) => {
        return product.quantity === inferred.quantity && sameProductLineName(product.name, inferred.name);
      });
      if (!alreadySuggested && suggestedProducts.length < 30) suggestedProducts.push(inferred);
    }
    const boundSuggestions = suggestedProducts.slice(0, 30).map((product, index) => ({
      ...product,
      informationField: product.informationField || `Sản phẩm cần bổ sung giá #${index + 1}: ${product.name}`,
    }));
    const suggestionFields = new Set(boundSuggestions.map((product) => product.informationField));
    const otherMissingFields = missingFields.filter((field) =>
      !suggestionFields.has(field)
      && !(boundSuggestions.length && isSupplementalProductInformation(field))
      && !/^Cần rà soát kết quả ghép sản phẩm tự động\.?$/i.test(field),
    );
    const normalizedMissingFields = [...new Set([
      ...otherMissingFields.slice(0, Math.max(0, 30 - boundSuggestions.length)),
      ...boundSuggestions.map((product) => product.informationField!),
    ])];
    await requests.updateOne({ _id: id, companyId: user.companyId }, {
      $set: { suggestedProducts: boundSuggestions, missingFields: normalizedMissingFields, candidates: currentProducts },
    });
    const status = items.length
      ? quoteRequest.status === "ambiguous" || normalizedMissingFields.length || boundSuggestions.length ? "ambiguous" as const : "matched" as const
      : quoteRequest.status;
    response.json({ analysis: { status, items, missingFields: normalizedMissingFields, suggestedProducts: boundSuggestions, customerName: quoteRequest.customerName, customerEmail: quoteRequest.customerEmail }, candidates: currentProducts });
    return;
  }
  const usage = await subscriptionUsage(db, user.companyId);
  if (usage.quotes.limit !== null && usage.quotes.used >= usage.quotes.limit) return fail(response, quoteQuotaMessage(usage.plan), 429);
  const priceLists = quoteRequest.priceListId
    ? await db.collection<PriceList>("priceLists").find({ companyId: user.companyId, _id: new ObjectId(quoteRequest.priceListId) }).toArray()
    : [];
  if (quoteRequest.priceListId && !priceLists.length) return fail(response, "Không tìm thấy bảng giá đã chọn.", 404);
  const catalog = await db.collection<CatalogItem>("catalogItems").find(currentCatalogFilter(user.companyId)).limit(5000).toArray();
  if (!catalog.length) return fail(response, "Chưa có sản phẩm trong danh mục. Hãy thêm bảng giá trước khi tạo báo giá.", 422);
  const requestFile = quoteRequest.requestFile ? await db.collection<RequestFile>("requestFiles").findOne({ _id: new ObjectId(quoteRequest.requestFile.id), companyId: user.companyId, uploadedBy: quoteRequest.createdBy }) : null;
  if (quoteRequest.requestFile && !requestFile) return fail(response, "Không tìm thấy file yêu cầu.", 404);
  const analysisRequestId = typeof response.locals.requestId === "string" ? response.locals.requestId : undefined;
  let result: Awaited<ReturnType<typeof analyzeRequest>> & { candidates?: CatalogItem[]; customerName?: string; customerEmail?: string };
  try {
    result = await withAiUsage(db, user, "quote_request_analyze", async () => {
      const fileContent = requestFile ? await requestFileContent(requestFile) : [];
      return analyzeRequest(quoteRequest.requestText, catalog, [], fileContent, analysisRequestId);
    });
  } catch (error) {
    if (error instanceof AiQuotaExceededError) return fail(response, error.message, 429);
    throw error;
  }
  const suggestedProducts = (result.suggestedProducts ?? []).slice(0, 30);
  if (suggestedProducts.length) {
    const boundProducts = suggestedProducts.map((product, index) => ({
      ...product,
      informationField: `Sản phẩm cần bổ sung giá #${index + 1}: ${product.name}`,
    }));
    const otherMissingFields = result.missingFields.filter((field) => !isSupplementalProductInformation(field));
    result.suggestedProducts = boundProducts;
    result.missingFields = [...new Set([...otherMissingFields.slice(0, Math.max(0, 30 - boundProducts.length)), ...boundProducts.map((product) => product.informationField!)])];
  }
  result.customerName = quoteRequest.customerName.trim() || result.customerName || "";
  result.customerEmail = quoteRequest.customerEmail.trim() || result.customerEmail || "";
  const candidates = result.candidates ?? catalog.filter((candidate) => result.items.some((item) => item.catalogItemId === String(candidate._id)));
  await requests.updateOne({ _id: id, companyId: user.companyId }, { $set: { ...result, candidates, ...(priceLists.length ? { priceListFilenames: priceLists.map((file) => file.originalFilename) } : {}), analyzedAt: new Date() } });
  await writeAudit(db, user, "request_analyzed", "quoteRequest", id.toHexString(), { status: result.status, itemCount: result.items.length });
  response.json({ analysis: result, candidates });
});


app.get("/overview", async (request, response) => {
  const from = String(request.query.from || "");
  const to = String(request.query.to || "");
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  };
  if (!validDate(from) || !validDate(to) || from > to) return fail(response, "Khoảng ngày thống kê không hợp lệ.");
  const start = new Date(`${from}T00:00:00+07:00`);
  const end = new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86_400_000);
  const db = await connectDatabase();
  const companyId = userOf(request).companyId;
  const range = { companyId, createdAt: { $gte: start, $lt: end } };
  const [quotes, contracts, acceptances] = await Promise.all([
    db.collection<Quote>("quotes").find(range, { projection: { kind: 1, status: 1, total: 1, totalUnknown: 1, currency: 1, customerName: 1, "lines.name": 1, "lines.quantity": 1, "lines.unit": 1, createdAt: 1 } }).toArray(),
    canQuotation("quotation-contract:read") ? db.collection<Contract>("contracts").find(range, { projection: { status: 1 } }).toArray() : Promise.resolve(null),
    canQuotation("quotation-acceptance:read") ? db.collection<AcceptanceRecord>("acceptanceRecords").find(range, { projection: { status: 1 } }).toArray() : Promise.resolve(null),
  ]);
  response.json(summarizeQuotationOverview(from, to, quotes, contracts, acceptances));
});

app.get("/quotes", async (request, response) => {
  const db = await connectDatabase();
  const user = userOf(request);
  const collection = db.collection<Quote>("quotes");
  const status = request.query.status;
  const filter: Document = { companyId: user.companyId };
  if (request.query.kind === "customer") filter.kind = "customer";
  else filter.kind = { $ne: "customer" };
  if (typeof status === "string" && ["draft", "needs_info", "pending_review", "approved", "rejected"].includes(status)) filter.status = status;
  if (request.query.page === undefined) {
    const quotes = await collection.find(filter).sort({ createdAt: -1, _id: -1 }).limit(100).toArray();
    response.json({ quotes: quotes.map(quoteForResponse) });
    return;
  }

  const requestedPage = Number(request.query.page);
  if (!Number.isInteger(requestedPage) || requestedPage < 1) return fail(response, "Trang báo giá không hợp lệ.");
  const pageSize = 9;
  const search = typeof request.query.search === "string" ? request.query.search.trim().slice(0, 100) : "";
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "i");
    filter.$or = [
      { quoteNumber: pattern },
      { customerName: pattern },
      { customerEmail: pattern },
      { customerPhone: pattern },
    ];
  }
  const sortBy = typeof request.query.sort === "string" ? request.query.sort : "newest";
  const sort: Record<string, 1 | -1> = sortBy === "oldest" ? { createdAt: 1, _id: 1 }
    : sortBy === "total_desc" ? { total: -1, _id: -1 }
    : sortBy === "total_asc" ? { total: 1, _id: -1 }
    : sortBy === "customer" ? { customerName: 1, _id: -1 }
    : { createdAt: -1, _id: -1 };
  const [total, statusRows] = await Promise.all([
    collection.countDocuments(filter),
    collection.aggregate<{ _id: QuoteStatus; count: number; revenue: number }>([
      { $match: { companyId: user.companyId, kind: filter.kind, fileCreationPending: { $exists: true } } },
      { $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, "$total", 0] } } } },
    ]).toArray(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const quotes = await collection.find(filter).sort(sort).skip((page - 1) * pageSize).limit(pageSize).toArray();
  const counts = Object.fromEntries(statusRows.map((row) => [row._id, row.count]));
  response.json({
    quotes: quotes.map(quoteForResponse),
    page,
    pageSize,
    total,
    totalPages,
    stats: {
      total: statusRows.reduce((sum, row) => sum + row.count, 0),
      drafts: counts.draft ?? 0,
      pending: counts.pending_review ?? 0,
      approved: counts.approved ?? 0,
      needsInfo: counts.needs_info ?? 0,
      rejected: counts.rejected ?? 0,
      approvedRevenue: statusRows.reduce((sum, row) => sum + row.revenue, 0),
    },
  });
});


app.post("/customer-quotes/suggest", async (request, response) => {
  const prompt = request.body?.prompt;
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 3000) return fail(response, "Hãy nhập yêu cầu báo giá, tối đa 3.000 ký tự.");
  const inputs = parseCustomerQuotePrompt(prompt);
  const db = await connectDatabase();
  const user = userOf(request);
  const catalog = await db.collection<CatalogItem>("catalogItems").find(currentCatalogFilter(user.companyId)).sort({ sku: 1 }).limit(1000).toArray();
  try { response.json(await withAiUsage(db, user, "customer_quote_suggest", () => suggestCustomerQuote(inputs, catalog))); }
  catch (error) { fail(response, error instanceof Error ? error.message : "Không thể đề xuất hạng mục.", error instanceof AiQuotaExceededError ? 429 : 422); }
});


app.get("/budget-plans", async (request, response) => {
  const plans = await (await connectDatabase()).collection<SavedBudgetPlan>("budgetPlans")
    .find({ companyId: userOf(request).companyId }).sort({ createdAt: -1, _id: -1 }).limit(30).toArray();
  response.json({ plans: plans.map(({ _id, input, result, createdAt, updatedAt }) => ({ id: String(_id), input, result: recomputeBudgetPlanTotals(result), createdAt, updatedAt: updatedAt || createdAt })) });
});


app.patch("/budget-plans/:id", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã phương án không hợp lệ.");
  const db = await connectDatabase();
  const user = userOf(request);
  const plans = db.collection<SavedBudgetPlan>("budgetPlans");
  const plan = await plans.findOne({ _id: id, companyId: user.companyId });
  if (!plan) return fail(response, "Không tìm thấy phương án.", 404);
  const body = request.body ?? {};
  let result = structuredClone(plan.result);
  const validQuantity = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1_000_000;
  if (body.action === "quantity") {
    const line = result.lines.find((entry) => entry.catalogItemId === body.catalogItemId);
    if (!line || !validQuantity(body.quantity)) return fail(response, "Sản phẩm hoặc số lượng không hợp lệ.", 422);
    line.quantity = body.quantity;
    line.lineTotal = Math.round((line.unitPrice * body.quantity + Number.EPSILON) * 100) / 100;
    line.quantityBasis = "measured";
    line.quantityNote = "Số lượng do người dùng xác nhận";
  } else if (body.action === "answer" || body.action === "recalculate") {
    if (body.action === "answer" && (!validText(body.question, 500) || !result.questions.includes(body.question) || !validText(body.answer, 500))) return fail(response, "Câu hỏi hoặc câu trả lời không hợp lệ.", 422);
    const clarification = body.action === "answer" ? { question: String(body.question), answer: String(body.answer).trim() } : undefined;
    const catalog = await db.collection<CatalogItem>("catalogItems").find(currentCatalogFilter(user.companyId)).sort({ sku: 1 }).limit(1000).toArray();
    if (!catalog.length) return fail(response, "Bảng giá chưa có sản phẩm đang áp dụng.", 422);
    try {
      const updatedResult = await withAiUsage(db, user, body.action === "answer" ? "budget_plan_answer" : "budget_plan_recalculate", async () => {
        const proposed = await suggestBudgetPlan(recalculationInput(plan.input, result, clarification), catalog);
        const merged = mergeBudgetPlanAfterClarification(result, proposed, clarification);
        await plans.updateOne({ _id: id, companyId: user.companyId }, { $set: { result: merged, updatedAt: new Date() } });
        await writeAudit(db, user, "budget_plan_updated", "budgetPlan", id.toHexString(), { action: body.action });
        return merged;
      });
      const updated = await plans.findOne({ _id: id, companyId: user.companyId });
      return response.json({ id: id.toHexString(), input: plan.input, result: updatedResult, createdAt: plan.createdAt, updatedAt: updated!.updatedAt });
    } catch (error) {
      return fail(response, error instanceof Error ? error.message : "Không thể tính lại phương án.", error instanceof AiQuotaExceededError ? 429 : 422);
    }
  } else if (body.action === "assumption") {
    if (!Number.isInteger(body.index) || body.index < 0 || body.index >= result.assumptions.length || !validText(body.text, 250)) return fail(response, "Giả định không hợp lệ.", 422);
    const changed = result.assumptions[body.index] !== body.text.trim();
    result.assumptions[body.index] = body.text.trim();
    result.assumptionConfirmations = result.assumptions.map((_, index) => index === body.index || result.assumptionConfirmations?.[index] === true);
    if (changed) for (const line of result.lines) {
      if (line.quantityBasis !== "estimated") continue;
      line.quantity = null;
      line.lineTotal = null;
      line.quantityNote = "Giả định đã sửa; cần nhập lại số lượng";
    }
  } else if (body.action === "missing") {
    if (!validText(body.name, 250) || !result.missingProducts.includes(body.name) || (body.quantity !== null && body.quantity !== undefined && !validQuantity(body.quantity))) return fail(response, "Hạng mục hoặc số lượng không hợp lệ.", 422);
    const catalog = db.collection<CatalogItem>("catalogItems");
    let item: CatalogItem | null = null;
    if (body.catalogItemId) {
      const itemId = asId(body.catalogItemId);
      if (!itemId) return fail(response, "Sản phẩm thay thế không hợp lệ.", 422);
      item = await catalog.findOne({ _id: itemId, ...currentCatalogFilter(user.companyId) });
      if (!item) return fail(response, "Sản phẩm thay thế không còn trong bảng giá.", 422);
    } else if (isRecord(body.newProduct)) {
      assertQuotationPermission("quotation-price-book:manage");
      const created = await createCatalogProduct({ ...body.newProduct, description: "Bổ sung từ phương án đề xuất", currency: config.currency }, randomUUID());
      item = created.item;
    } else return fail(response, "Hãy chọn sản phẩm hoặc thêm sản phẩm mới.", 422);
    if (!result.lines.some((line) => line.catalogItemId === String(item._id))) {
      result.lines.push({ catalogItemId: String(item._id), sku: item.sku, name: item.name, description: item.description, catalogAttributes: item.attributes ?? {}, unit: item.unit, unitPrice: item.price, currency: item.currency, quantity: body.quantity ?? null, lineTotal: body.quantity ? Math.round((item.price * body.quantity + Number.EPSILON) * 100) / 100 : null, reason: `Bổ sung cho hạng mục: ${body.name}`, ...(body.quantity ? { quantityBasis: "measured" as const, quantityNote: "Số lượng do người dùng xác nhận" } : {}) });
    }
    result.missingProducts = result.missingProducts.filter((name) => name !== body.name);
    result.resolvedMissingProducts = [...new Set([...(result.resolvedMissingProducts ?? []), body.name])];
  } else return fail(response, "Thao tác không hợp lệ.", 422);
  const updatedResult = recomputeBudgetPlanTotals(result);
  await plans.updateOne({ _id: id, companyId: user.companyId }, { $set: { result: updatedResult, updatedAt: new Date() } });
  await writeAudit(db, user, "budget_plan_updated", "budgetPlan", id.toHexString(), { action: body.action });
  const updated = await plans.findOne({ _id: id, companyId: user.companyId });
  response.json({ id: id.toHexString(), input: plan.input, result: updatedResult, createdAt: plan.createdAt, updatedAt: updated!.updatedAt });
});


app.get("/budget-plans/:id/export", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã phương án không hợp lệ.");
  const db = await connectDatabase();
  const plan = await db.collection<SavedBudgetPlan>("budgetPlans")
    .findOne({ _id: id, companyId: userOf(request).companyId });
  if (!plan) return fail(response, "Không tìm thấy phương án.", 404);
  const templateId = request.query.templateId === undefined || request.query.templateId === "none" ? null : asId(String(request.query.templateId));
  if (request.query.templateId !== undefined && request.query.templateId !== "none" && !templateId) return fail(response, "Mã mẫu tài liệu không hợp lệ.");
  const exportQuote = budgetPlanAsQuote(plan);
  const user = userOf(request);
  const defaultFilename = `phuong-an-${id.toHexString()}.xlsx`;
  let selectedTemplate: QuoteTemplate | null = null;
  if (templateId) {
    selectedTemplate = await db.collection<QuoteTemplate>("quoteTemplates").findOne({ _id: templateId, companyId: plan.companyId, deletedAt: { $exists: false }, category: { $in: ["quote", null] } });
    if (!selectedTemplate) return fail(response, "Không tìm thấy mẫu tài liệu.", 404);
    if (!["docx", "xlsx", "pdf"].includes(selectedTemplate.extension)) return fail(response, "Hãy chọn mẫu Word, Excel hoặc PDF.", 422);
  }
  const extension = selectedTemplate?.extension ?? "xlsx";
  const filename = `phuong-an-${id.toHexString()}.${extension}`;
  const mimeType = templateFormats[extension]!;
  const render = async () => ({
    filename,
    mimeType,
    bytes: selectedTemplate
      ? await withAiUsage(db, user, "budget_plan_export_template", () => selectedTemplate!.extension === "xlsx"
        ? renderAiMappedXlsxTemplate(selectedTemplate!, exportQuote, plan.input.description)
        : renderTemplate(selectedTemplate!, exportQuote, plan.input.description))
      : await withAiUsage(db, user, "budget_plan_export_default", () => renderAiMappedXlsxTemplate(
        generatedExportTemplate(user, defaultFilename, "xlsx", makeBudgetPlanExcel(plan)), exportQuote, plan.input.description,
      )),
  });
  if (request.query.background === "1") {
    try {
      const job = await queueGeneratedExport(db, user, "budget", id.toHexString(), render);
      return response.status(202).json(job);
    } catch (error) { return fail(response, error instanceof Error ? error.message : "Không tạo được tác vụ xuất phương án.", 500); }
  }
  let bytes: Buffer;
  try {
    ({ bytes } = await render());
    await storeGeneratedExport(db, user, filename, mimeType, bytes);
  } catch (error) {
    return fail(response, error instanceof Error ? error.message : "Không xuất được hoặc không lưu được file phương án lên Cloudinary.", generatedExportErrorStatus(error));
  }
  response.setHeader("Content-Type", mimeType);
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  response.send(bytes);
});


app.post("/budget-plans/suggest", async (request, response) => {
  const { description, budget, area, floors } = request.body ?? {};
  if (typeof description !== "string" || !description.trim() || description.length > 3000
    || typeof budget !== "number" || !Number.isFinite(budget) || budget <= 0 || budget > 1_000_000_000_000
    || (area !== undefined && (typeof area !== "number" || !Number.isFinite(area) || area <= 0 || area > 1_000_000))
    || (floors !== undefined && (!Number.isInteger(floors) || floors <= 0 || floors > 200))) {
    return fail(response, "Mô tả, ngân sách hoặc quy mô không hợp lệ.");
  }
  const db = await connectDatabase();
  const catalog = await db.collection<CatalogItem>("catalogItems")
    .find(currentCatalogFilter(userOf(request).companyId)).sort({ sku: 1 }).limit(1000).toArray();
  if (!catalog.length) return fail(response, "Bảng giá chưa có sản phẩm đang áp dụng.", 422);
  try {
    const user = userOf(request);
    const input = { description: description.trim(), budget, ...(area === undefined ? {} : { area }), ...(floors === undefined ? {} : { floors }) };
    const saved = await withAiUsage(db, user, "budget_plan_suggest", async () => {
      const result = recomputeBudgetPlanTotals(await suggestBudgetPlan(input, catalog));
      const createdAt = new Date();
      const plan: SavedBudgetPlan = { companyId: user.companyId, createdBy: user.id, input, result, createdAt, updatedAt: createdAt };
      const inserted = await db.collection<SavedBudgetPlan>("budgetPlans").insertOne(plan);
      return { id: inserted.insertedId.toHexString(), input, result, createdAt, updatedAt: createdAt };
    });
    response.status(201).json(saved);
  }
  catch (error) { fail(response, error instanceof Error ? error.message : "Không thể tạo phương án sơ bộ.", error instanceof AiQuotaExceededError ? 429 : 422); }
});


app.post("/customer-quotes", async (request, response) => {
  const user = userOf(request);
  const rawItems = request.body?.items;
  const rawMissingProducts = request.body?.missingProducts ?? [];
  const templateId = asId(String(request.body?.templateId ?? ""));
  const idempotencyKey = request.body?.idempotencyKey;
  const customerName = request.body?.customerName;
  const customerEmail = request.body?.customerEmail ?? "";
  const customerPhone = request.body?.customerPhone ?? "";
  const sourceRequirements = request.body?.sourceRequirements ?? "";
  if (!templateId || !validText(idempotencyKey, 100) || !validText(customerName, 250) || typeof customerEmail !== "string" || customerEmail.length > 250 || (customerEmail && !validEmail(customerEmail)) || typeof customerPhone !== "string" || customerPhone.length > 50 || typeof sourceRequirements !== "string" || sourceRequirements.length > 10_000 || !Array.isArray(rawItems) || rawItems.length > 100 || !Array.isArray(rawMissingProducts) || rawMissingProducts.length > 30 || rawMissingProducts.some((name) => !validText(name, 120)) || (!rawItems.length && !rawMissingProducts.length)) return fail(response, "Khách hàng, mẫu báo giá hoặc danh sách sản phẩm không hợp lệ.");
  const missingProducts = [...new Set((rawMissingProducts as string[]).map((name) => name.trim()))];
  const db = await connectDatabase();
  const quotes = db.collection<Quote>("quotes");
  const existing = await quotes.findOne({ companyId: user.companyId, idempotencyKey });
  if (existing) {
    if (existing.kind === "customer") await ensureCustomerQuoteExport(db, user, existing);
    return response.json({ quote: quoteForResponse(existing) });
  }
  const usage = await subscriptionUsage(db, user.companyId);
  if (usage.quotes.limit !== null && usage.quotes.used >= usage.quotes.limit) return fail(response, quoteQuotaMessage(usage.plan), 429);
  const template = templateId ? await db.collection<QuoteTemplate>("quoteTemplates").findOne({ _id: templateId, companyId: user.companyId, deletedAt: { $exists: false }, category: { $in: ["quote", null] } }, { projection: { data: 0, fillPlanCache: 0, xlsxFillPlanCache: 0 } }) : null;
  if (!template) return fail(response, "Hãy chọn một mẫu báo giá còn hiệu lực.", 404);
  if (!["docx", "xlsx", "pdf"].includes(template.extension)) return fail(response, "Mẫu báo giá chỉ hỗ trợ Word, Excel hoặc PDF.", 422);
  const requested = [] as Array<{ catalogItemId: string; quantity: number; unit: string; attributes: Record<string, string> }>;
  for (const raw of rawItems) {
    if (!isRecord(raw) || typeof raw.catalogItemId !== "string" || !asId(raw.catalogItemId) || typeof raw.quantity !== "number" || typeof raw.unit !== "string") return fail(response, "Dòng hàng không hợp lệ.");
    requested.push({ catalogItemId: raw.catalogItemId, quantity: 1, unit: raw.unit, attributes: {} });
  }
  if (new Set(requested.map((item) => item.catalogItemId)).size !== requested.length) return fail(response, "Sản phẩm bị trùng trong báo giá.");
  const catalogIds = requested.map((item) => asId(item.catalogItemId)!);
  const catalog = await db.collection<CatalogItem>("catalogItems").find({ _id: { $in: catalogIds }, ...currentCatalogFilter(user.companyId) }).toArray();
  const catalogById = new Map(catalog.map((item) => [String(item._id), item]));
  if (catalogById.size !== requested.length) return fail(response, "Một số sản phẩm không còn trong bảng giá.");
  try { assertCatalogSelection(catalog, rawItems); }
  catch (error) { return fail(response, (error as Error).message, (error as { statusCode: number }).statusCode); }
  if (new Set(catalog.map(item => item.currency)).size > 1) return fail(response, "Các sản phẩm trong một báo giá phải cùng tiền tệ.", 422);
  const totals = {
    lines: requested.map(({ catalogItemId }) => {
      const item = catalogById.get(catalogItemId)!;
      return {
        catalogItemId, source: "catalog" as const, sku: item.sku, name: item.name,
        description: item.description, quantity: 1, unit: item.unit, unitPrice: item.price,
        currency: item.currency, catalogAttributes: item.attributes ?? {}, attributes: {}, lineTotal: 0,
      };
    }),
    subtotal: 0, taxRate: 0, taxAmount: 0, total: 0, currency: catalog[0]?.currency ?? config.currency,
  };
  const year = new Date().getFullYear();
  const counter = await db.collection<{ _id: string; value: number }>("counters").findOneAndUpdate({ _id: `${user.companyId}:${year}` }, { $inc: { value: 1 } }, { upsert: true, returnDocument: "after" });
  const now = new Date();
  const quote: Quote = {
    companyId: user.companyId, kind: "customer", customerPricesCaptured: true, idempotencyKey, missingProducts,
    template: { id: template._id!.toHexString(), name: template.name || template.originalFilename, originalFilename: template.originalFilename },
    ...(sourceRequirements.trim() ? { sourceRequirements: sourceRequirements.trim() } : {}),
    quoteNumber: `BG-${year}-${String(counter?.value ?? 1).padStart(5, "0")}`,
    requestId: "", customerName: customerName.trim(), customerEmail: customerEmail.trim(), customerPhone: customerPhone.trim(),
    ...totals, taxRateConfirmed: true, shippingFee: 0, shippingFeeConfirmed: true,
    informationNeeded: [], additionalInformation: {}, suggestedProducts: [], informationConfirmed: true,
    status: "draft", createdBy: user.id, createdAt: now, updatedAt: now,
  };
  const result = await quotes.insertOne(quote);
  quote._id = result.insertedId;
  await writeAudit(db, user, "customer_quote_created", "quote", result.insertedId.toHexString(), { quoteNumber: quote.quoteNumber, productCount: quote.lines.length });
  await queueCustomerQuoteExport(db, user, quote);
  response.status(201).json({ quote: quoteForResponse(quote) });
});


app.post("/quotes/from-customer", async (request, response) => {
  const sourceId = asId(String(request.body?.sourceQuoteId ?? ""));
  const templateId = asId(String(request.body?.templateId ?? ""));
  const idempotencyKey = request.body?.idempotencyKey;
  const sourceRequirements = request.body?.sourceRequirements ?? "";
  if (!sourceId || !templateId || !validText(idempotencyKey, 100)) return fail(response, "Hãy chọn báo giá khách và mẫu dự toán hợp lệ.");
  if (typeof sourceRequirements !== "string" || sourceRequirements.length > 10_000) return fail(response, "Yêu cầu bổ sung không hợp lệ hoặc vượt quá 10.000 ký tự.");
  if (!sourceRequirements.trim()) return fail(response, "Hãy nhập yêu cầu cụ thể để tính dự toán.");
  const db = await connectDatabase();
  const user = userOf(request);
  const quotes = db.collection<Quote>("quotes");
  const existing = await quotes.findOne({ companyId: user.companyId, idempotencyKey });
  if (existing) return response.json({ quote: quoteForResponse(existing) });
  const usage = await subscriptionUsage(db, user.companyId);
  if (usage.quotes.limit !== null && usage.quotes.used >= usage.quotes.limit) return fail(response, quoteQuotaMessage(usage.plan), 429);
  const [source, template] = await Promise.all([
    quotes.findOne({ _id: sourceId, companyId: user.companyId, kind: "customer" }),
    db.collection<QuoteTemplate>("quoteTemplates").findOne({ _id: templateId, companyId: user.companyId, deletedAt: { $exists: false }, category: "estimate" }, { projection: { data: 0, fillPlanCache: 0, xlsxFillPlanCache: 0 } }),
  ]);
  if (!source) return fail(response, "Không tìm thấy báo giá khách đã chọn.", 404);
  if (!template) return fail(response, "Không tìm thấy mẫu dự toán đã chọn.", 404);
  if (!source.lines.length && !source.missingProducts?.length) return fail(response, "Báo giá khách chưa có sản phẩm để tạo dự toán.");
  if (source.lines.length + (source.missingProducts?.length ?? 0) > 100) return fail(response, "Dự toán hỗ trợ tối đa 100 sản phẩm.");
  const year = new Date().getFullYear();
  const counter = await db.collection<{ _id: string; value: number }>("counters").findOneAndUpdate(
    { _id: `${user.companyId}:${year}` }, { $inc: { value: 1 } }, { upsert: true, returnDocument: "after" },
  );
  let estimate: Quote;
  try {
    estimate = estimateFromCustomerQuote(
      await customerQuoteWithPrices(db, source), sourceId.toHexString(),
      { id: templateId.toHexString(), name: template.name || template.originalFilename, originalFilename: template.originalFilename },
      `BG-${year}-${String(counter?.value ?? 1).padStart(5, "0")}`, idempotencyKey, user.id, new Date(),
    );
    estimate.sourceRequirements = sourceRequirements.trim();
    if (estimate.sourceRequirements) estimate = await withAiUsage(db, user, "estimate_from_customer_adjust", () => adjustEstimateWithRequirements(estimate, estimate.sourceRequirements!));
  } catch (error) {
    return fail(response, error instanceof Error ? error.message : "Không thể tạo dự toán từ báo giá khách.", error instanceof AiQuotaExceededError ? 429 : 422);
  }
  estimate.fileCreationPending = true;
  const result = await quotes.insertOne(estimate);
  await writeAudit(db, user, "estimate_created_from_customer_quote", "quote", result.insertedId.toHexString(), { sourceQuoteId: sourceId.toHexString(), quoteNumber: estimate.quoteNumber, productCount: estimate.lines.length });
  response.status(201).json({ quote: quoteForResponse({ ...estimate, _id: result.insertedId }) });
});


app.post("/quotes", async (request, response) => {
  const requestId = asId(String(request.body?.requestId ?? ""));
  const requestedItems = request.body?.items;
  const idempotencyKey = request.body?.idempotencyKey;
  if (!requestId || !validText(idempotencyKey, 100) || !Array.isArray(requestedItems) || requestedItems.length > 100) {
    fail(response, "Yêu cầu hoặc dòng hàng không hợp lệ.");
    return;
  }
  const db = await connectDatabase();
  const user = userOf(request);
  const quotes = db.collection<Quote>("quotes");
  const existing = await quotes.findOne({ companyId: user.companyId, idempotencyKey });
  if (existing) {
    response.status(200).json({ quote: existing });
    return;
  }
  const usage = await subscriptionUsage(db, user.companyId);
  if (usage.quotes.limit !== null && usage.quotes.used >= usage.quotes.limit) return fail(response, quoteQuotaMessage(usage.plan), 429);
  const source = await db.collection<QuoteRequest>("quoteRequests").findOne({ _id: requestId, companyId: user.companyId });
  if (!source || !source.analyzedAt) return fail(response, "Hãy phân tích yêu cầu trước khi tạo báo giá.");
  if (!source.template) return fail(response, "Yêu cầu chưa có mẫu báo giá. Vui lòng tạo yêu cầu mới để tự chọn mẫu doanh nghiệp.", 409);
  await savedTemplate(db, user.companyId, source.template);
  for (const item of requestedItems) {
    if (!isRecord(item) || typeof item.catalogItemId !== "string" || typeof item.quantity !== "number" || typeof item.unit !== "string") {
      return fail(response, "Dòng hàng không hợp lệ.");
    }
  }
  const catalogIds = [...new Set(requestedItems.map((item: { catalogItemId: string }) => asId(item.catalogItemId)).filter(Boolean))] as ObjectId[];
  const catalog = await db.collection<CatalogItem>("catalogItems").find({ _id: { $in: catalogIds }, ...currentCatalogFilter(user.companyId) }).toArray();
  try { assertCatalogSelection(catalog, requestedItems); }
  catch (error) { return fail(response, (error as Error).message, (error as { statusCode: number }).statusCode); }
  let totals;
  try {
    const requestedAttributes = new Map(source.items.map((item) => [item.catalogItemId, item.attributes]));
    const trustedRequestedItems = requestedItems.map((item: { catalogItemId: string; quantity: number; unit: string }) => ({
      catalogItemId: item.catalogItemId,
      quantity: item.quantity,
      unit: item.unit,
      attributes: requestedAttributes.get(String(item.catalogItemId)) ?? {},
    }));
    if (!trustedRequestedItems.length) {
      totals = { lines: [], subtotal: 0, taxRate: config.taxRate, taxAmount: 0, total: 0, currency: config.currency };
    } else {
      if (trustedRequestedItems.some(item => !catalog.some(product => String(product._id) === item.catalogItemId))) return fail(response, "Có sản phẩm đã ngừng áp dụng hoặc bị xóa. Hãy sửa yêu cầu và phân tích lại.", 409);
      totals = calculateQuote(catalog, trustedRequestedItems);
    }
  } catch (error) {
    return fail(response, error instanceof Error ? error.message : "Không thể tính báo giá.");
  }
  const year = new Date().getFullYear();
  const counter = await db.collection<{ _id: string; value: number }>("counters").findOneAndUpdate(
    { _id: `${user.companyId}:${year}` },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  const quoteNumber = `BG-${year}-${String(counter?.value ?? 1).padStart(5, "0")}`;
  const now = new Date();
  const informationConfirmed = request.body?.informationConfirmed === true;
  const customerName = request.body?.customerName ?? source.customerName;
  const customerEmail = request.body?.customerEmail ?? source.customerEmail;
  const customerPhone = request.body?.customerPhone ?? source.customerPhone ?? "";
  if (typeof customerPhone !== "string" || customerPhone.length > 50) return fail(response, "Số điện thoại không hợp lệ (tối đa 50 ký tự).");
  if (!validText(customerName, 250) || typeof customerEmail !== "string" || customerEmail.length > 250 || (customerEmail && !validEmail(customerEmail))) return fail(response, "Vui lòng xác nhận tên khách hàng và email hợp lệ (nếu có).");
  const quoteTerms = extractQuoteTerms(source.requestText);
  const informationNeeded = cleanMissingInformation(source.missingFields, totals.lines.length > 0)
    .filter((field) => !isResolvedQuoteTermWarning(field, quoteTerms));
  if (!totals.lines.length && !source.suggestedProducts?.length) informationNeeded.push("Chưa có sản phẩm trong báo giá.");
  const taxRateConfirmed = !informationNeeded.some(isTaxInformation);
  const shippingFeeConfirmed = !informationNeeded.some(isShippingInformation);
  const shippingFee = shippingFeeConfirmed ? 0 : null;
  const quote: Quote = {
    companyId: user.companyId,
    kind: "estimate",
    fileCreationPending: true,
    template: source.template,
    ...(source.priceListId ? { priceList: { id: source.priceListId, originalFilename: source.priceListFilename ?? "" } } : {}),
    ...(source.requestFile ? { requestFile: source.requestFile } : {}),
    idempotencyKey,
    quoteNumber,
    requestId: requestId.toHexString(),
    customerName: customerName.trim(),
    customerEmail: customerEmail.trim(),
    customerPhone: customerPhone.trim(),
    ...totals,
    taxRateConfirmed,
    shippingFee,
    shippingFeeConfirmed,
    ...quoteTerms,
    taxAmount: taxRateConfirmed ? totals.taxAmount : 0,
    total: totals.subtotal + (taxRateConfirmed ? totals.taxAmount : 0) + (shippingFeeConfirmed ? shippingFee ?? 0 : 0),
    informationNeeded,
    additionalInformation: {},
    suggestedProducts: source.suggestedProducts ?? [],
    informationConfirmed,
    status: informationNeeded.length > 0 || !taxRateConfirmed || !shippingFeeConfirmed ? "needs_info" : "draft",
    createdBy: user.id,
    createdAt: now,
    updatedAt: now,
  };
  try {
    const result = await quotes.insertOne(quote);
    const saved = quoteForResponse({ ...quote, _id: result.insertedId });
    await writeAudit(db, user, "quote_created", "quote", result.insertedId.toHexString(), { quoteNumber, total: quote.total, informationConfirmed });
    response.status(201).json({ quote: saved });
  } catch (error) {
    if (isDuplicateKey(error)) {
      const saved = await quotes.findOne({ companyId: user.companyId, idempotencyKey });
      if (saved) {
        response.status(200).json({ quote: saved });
        return;
      }
    }
    throw error;
  }
});


app.get("/quotes/:id", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã báo giá không hợp lệ.");
  const db = await connectDatabase();
  const quotes = db.collection<Quote>("quotes");
  const quote = await quotes.findOne({ _id: id, companyId: userOf(request).companyId });
  if (!quote) return fail(response, "Không tìm thấy báo giá.", 404);
  const sourceId = asId(quote.requestId);
  const source = sourceId ? await db.collection<QuoteRequest>("quoteRequests").findOne(
    { _id: sourceId, companyId: userOf(request).companyId },
    { projection: { requestText: 1, candidates: 1, suggestedProducts: 1 } },
  ) : null;
  let quoteResponse = quoteForResponse(await customerQuoteWithPrices(db, quote));
  if (source && !quote.answersRegeneratedAt) {
    const suggestions = [...(quote.suggestedProducts ?? [])];
    for (const product of source.suggestedProducts ?? []) {
      if (!suggestions.some((existing) => existing.quantity === product.quantity && sameProductLineName(existing.name, product.name))) {
        suggestions.push(product);
      }
    }
    const inferred = source.candidates?.length
      ? suggestUnmatchedExplicitRequestLines(source.requestText, source.candidates).filter((product) => !isShippingInformation(product.name))
      : [];
    for (const product of inferred) {
      if (!suggestions.some((existing) => existing.quantity === product.quantity && sameProductLineName(existing.name, product.name))) {
        suggestions.push(product);
      }
    }
    const boundSuggestions = suggestions.slice(0, 30).map((product, index) => ({
      ...product,
      informationField: product.informationField || `Sản phẩm cần bổ sung giá #${index + 1}: ${product.name}`,
    }));
    const genericFallbackFields = new Set([
      "AI chưa phân tích hết yêu cầu; vui lòng rà soát các dòng đã ghép.",
      "AI chưa phân tích được yêu cầu; vui lòng ghép sản phẩm thủ công.",
      "Cần rà soát kết quả ghép sản phẩm tự động.",
    ]);
    const otherMissingFields = quoteResponse.informationNeeded.filter((field) =>
      !genericFallbackFields.has(field)
      && !(boundSuggestions.length && isSupplementalProductInformation(field)),
    );
    const informationNeeded = [...new Set([
      ...otherMissingFields.slice(0, Math.max(0, 30 - boundSuggestions.length)),
      ...boundSuggestions.map((product) => product.informationField!),
    ])];
    const repairedQuote = quoteForResponse({ ...quote, suggestedProducts: boundSuggestions, informationNeeded });
    if (JSON.stringify(quote.suggestedProducts ?? []) !== JSON.stringify(boundSuggestions)
      || JSON.stringify(quote.informationNeeded ?? []) !== JSON.stringify(informationNeeded)
      || quote.status !== repairedQuote.status) {
      await quotes.updateOne({ _id: id, companyId: quote.companyId }, {
        $set: { suggestedProducts: boundSuggestions, informationNeeded, status: repairedQuote.status },
      });
    }
    quoteResponse = repairedQuote;
  }
  response.json({ quote: { ...quoteResponse, requestText: quote.sourceRequirements || source?.requestText || "" } });
});


app.delete("/quotes/:id", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã báo giá không hợp lệ.");
  const db = await connectDatabase();
  const user = userOf(request);
  const quotes = db.collection<Quote>("quotes");
  const quote = await quotes.findOne({ _id: id, companyId: user.companyId });
  if (!quote) return fail(response, "Không tìm thấy báo giá.", 404);
  if (quote.status === "approved") return fail(response, "Báo giá đã duyệt cần được giữ để đối chiếu; không thể xóa.", 409);
  if (await db.collection<Contract>("contracts").findOne({ companyId: user.companyId, quoteId: id.toHexString() })) return fail(response, "Dự toán đã có hợp đồng; không thể xóa nguồn đối chiếu.", 409);
  const result = await quotes.deleteOne({ _id: id, companyId: user.companyId });
  if (!result.deletedCount) return fail(response, "Báo giá không còn tồn tại hoặc đã được xóa.", 404);
  await writeAudit(db, user, "quote_deleted", "quote", id.toHexString(), { quoteNumber: quote.quoteNumber, status: quote.status });
  response.json({ deleted: true });
});


app.get("/quotes/:id/request-file/preview", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã báo giá không hợp lệ.");
  const db = await connectDatabase();
  const user = userOf(request);
  const quotes = db.collection<Quote>("quotes");
  const quote = await quotes.findOne({ _id: id, companyId: user.companyId });
  if (!quote) return fail(response, "Không tìm thấy báo giá.", 404);
  const sourceId = asId(quote.requestId);
  const source = sourceId ? await db.collection<QuoteRequest>("quoteRequests").findOne({ _id: sourceId, companyId: user.companyId }) : null;
  if (!source?.requestFile) return fail(response, "Yêu cầu này không có file đính kèm.", 404);
  const file = await db.collection<RequestFile>("requestFiles").findOne({ _id: new ObjectId(source.requestFile.id), companyId: user.companyId, uploadedBy: source.createdBy });
  if (!file) return fail(response, "Không tìm thấy file yêu cầu.", 404);
  const extension = file.originalFilename.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "docx") {
    response.type("html").setHeader("Content-Disposition", "inline").send(previewDocxHtml(Buffer.from(file.data.buffer), file.originalFilename));
    return;
  }
  const mimeTypes: Record<string, string> = { pdf: "application/pdf", txt: "text/plain; charset=utf-8", csv: "text/csv; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel" };
  if (!mimeTypes[extension]) return fail(response, "Định dạng file này chưa hỗ trợ xem trước.", 415);
  response.setHeader("Content-Type", mimeTypes[extension]).setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.originalFilename)}`).setHeader("X-Content-Type-Options", "nosniff").send(Buffer.from(file.data.buffer));
});


app.post("/quotes/:id/recalculate", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã dự toán không hợp lệ.");
  if (!quotationContext().expectedVersion) return fail(response, "Hãy tải lại dự toán trước khi tạo lại.", 428);
  const db = await connectDatabase(), user = userOf(request), quotes = db.collection<Quote>("quotes");
  const quote = await quotes.findOne({ _id: id, companyId: user.companyId });
  if (!quote) return fail(response, "Không tìm thấy dự toán.", 404);
  if (quote.kind === "customer" || !["draft", "needs_info", "pending_review", "rejected"].includes(quote.status)) return fail(response, "Chỉ có thể tạo lại dự toán chưa được duyệt.", 409);
  let answers: Record<string, string>;
  try { answers = estimateAnswers(quote, request.body?.additionalInformation); }
  catch (error) { return fail(response, error instanceof Error ? error.message : "Câu trả lời không hợp lệ."); }
  if (!Object.entries(answers).some(([field, value]) => value && !isTaxInformation(field) && !isShippingInformation(field) && !isSupplementalProductInformation(field))) return fail(response, "Hãy trả lời ít nhất một câu hỏi bổ sung trước khi tạo lại.", 422);
  let proposal: Quote;
  try {
    const sourceId = asId(quote.requestId);
    const source = sourceId ? await db.collection<QuoteRequest>("quoteRequests").findOne({ _id: sourceId, companyId: user.companyId }) : null;
    proposal = await withAiUsage(db, user, "estimate_regenerate_answers", () => adjustEstimateWithRequirements(
      estimateForRegeneration(quoteForResponse(quote), answers),
      JSON.stringify({ task: "Điều chỉnh dự toán theo các câu trả lời đã xác nhận; giữ nguyên các dòng không liên quan và không hỏi lại thông tin đã trả lời.", originalRequest: source?.requestText?.slice(0, 10000), answers }),
    ));
  } catch (error) { return fail(response, error instanceof Error ? error.message : "Chưa tạo lại được dự toán. Nội dung hiện tại được giữ nguyên.", error instanceof AiQuotaExceededError ? 429 : 422); }
  // A long AI call must not overwrite another tab's edit or a document approved in the meantime.
  const ctx = quotationContext(), access = await resolveQuotationJobContext(ctx);
  if (access.scopeId !== ctx.scopeId || !canQuotation("quotation:manage", access) || !canQuotation("quotation-ai:manage", access)) return fail(response, "Quyền tạo lại dự toán đã thay đổi. Hãy tải lại trang.", 403);
  const normalized = quoteForResponse({ ...proposal, additionalInformation: answers, status: "draft" });
  await quotes.updateOne({ _id: id, companyId: user.companyId }, {
    $set: { lines: normalized.lines, subtotal: normalized.subtotal, taxAmount: normalized.taxAmount, total: normalized.total,
      additionalInformation: answers, informationNeeded: normalized.informationNeeded, informationConfirmed: normalized.informationConfirmed,
      suggestedProducts: [], status: normalized.status, answersRegeneratedAt: new Date(), fileCreationPending: true, updatedAt: new Date() },
    $unset: { templateFillPlan: "", xlsxTemplateFillPlan: "" },
  });
  await writeAudit(db, user, "estimate_regenerated_from_answers", "quote", id.toHexString(), { answerCount: Object.keys(answers).length, productCount: normalized.lines.length, total: normalized.total });
  response.json({ quote: quoteForResponse((await quotes.findOne({ _id: id, companyId: user.companyId }))!) });
});

app.patch("/quotes/:id", async (request, response) => {
  const id = asId(request.params.id);
  const updates = request.body?.items;
  if (!id || !Array.isArray(updates) || updates.length > 100) return fail(response, "Danh sách dòng hàng không hợp lệ.");
  const db = await connectDatabase();
  const user = userOf(request);
  const quotes = db.collection<Quote>("quotes");
  const quote = await quotes.findOne({ _id: id, companyId: user.companyId });
  if (!quote) return fail(response, "Không tìm thấy báo giá.", 404);
  if (quote.status !== "draft" && quote.status !== "needs_info" && quote.status !== "pending_review" && quote.status !== "rejected") return fail(response, "Chỉ có thể chỉnh sửa báo giá đang ở trạng thái nháp, chờ duyệt hoặc cần chỉnh sửa.", 409);
  const catalogLines = quote.lines.filter((line) => line.source !== "supplemental");
  const updateIds = updates.map((item: unknown) => isRecord(item) && typeof item.catalogItemId === "string" ? item.catalogItemId : "");
  if (updates.length !== catalogLines.length || new Set(updateIds).size !== updateIds.length || updates.some((item: unknown) => !isRecord(item) || typeof item.catalogItemId !== "string" || !catalogLines.some((line) => line.catalogItemId === item.catalogItemId))) {
    return fail(response, "Danh sách sản phẩm trong báo giá đã thay đổi. Vui lòng tải lại trang rồi thử lại.");
  }
  const body = isRecord(request.body) ? request.body : {};
  if (body.recalculateWithAi !== undefined && typeof body.recalculateWithAi !== "boolean") return fail(response, "Yêu cầu tính lại dự toán không hợp lệ.", 422);
  const recalculateWithAi = body.recalculateWithAi === true;
  if (recalculateWithAi) assertQuotationPermission("quotation-ai:manage");
  if (recalculateWithAi && (quote.kind === "customer" || quote.kind === "budget")) return fail(response, "Chức năng tính lại này chỉ áp dụng cho dự toán.", 422);
  const revisionRequirements = Object.prototype.hasOwnProperty.call(body, "revisionRequirements") ? body.revisionRequirements : quote.revisionRequirements ?? "";
  if (typeof revisionRequirements !== "string" || revisionRequirements.length > 10_000) return fail(response, "Yêu cầu cập nhật không được vượt quá 10.000 ký tự.", 422);
  const currentQuote = quoteForResponse(quote);
  let additionalInformation = { ...(currentQuote.additionalInformation ?? {}) };
  if (Object.prototype.hasOwnProperty.call(body, "additionalInformation")) {
    if (!isRecord(body.additionalInformation) || Object.keys(body.additionalInformation).length > 30) return fail(response, "Thông tin bổ sung không hợp lệ (tối đa 30 mục).");
    const allowedFields = new Set([...currentQuote.informationNeeded, ...Object.keys(additionalInformation)]);
    additionalInformation = {};
    let totalAnswerLength = 0;
    for (const [field, value] of Object.entries(body.additionalInformation)) {
      if (!allowedFields.has(field) || typeof value !== "string" || value.length > 2000) return fail(response, "Mỗi câu trả lời phải ứng với mục còn thiếu và không vượt quá 2.000 ký tự.");
      const answer = value.trim();
      if (answer) {
        totalAnswerLength += field.length + answer.length;
        if (totalAnswerLength > 12000) return fail(response, "Tổng nội dung bổ sung không được vượt quá 12.000 ký tự.");
        additionalInformation[field] = answer;
      }
    }
  }
  const existingSupplementalLines = quote.lines.filter((line) => line.source === "supplemental");
  const rawSupplementalProducts = Object.prototype.hasOwnProperty.call(body, "supplementalProducts")
    ? body.supplementalProducts
    : existingSupplementalLines.map((line) => ({
      id: line.catalogItemId, informationField: line.supplementalFor, name: line.name, description: line.description ?? "",
      unit: line.unit, quantity: line.quantity, unitPrice: line.unitPrice,
    }));
  if (!Array.isArray(rawSupplementalProducts) || rawSupplementalProducts.length > 30) return fail(response, "Báo giá chỉ được bổ sung tối đa 30 dòng sản phẩm.");
  const existingSupplementalById = new Map(existingSupplementalLines.map((line) => [line.catalogItemId, line]));
  const usedSupplementalIds = new Set<string>();
  const supplementalLines: Quote["lines"] = [];
  for (const rawProduct of rawSupplementalProducts) {
    if (!isRecord(rawProduct)) return fail(response, "Dòng sản phẩm bổ sung không hợp lệ.");
    const name = typeof rawProduct.name === "string" ? rawProduct.name.trim() : "";
    if (rawProduct.description !== undefined && typeof rawProduct.description !== "string") return fail(response, "Quy cách sản phẩm bổ sung không hợp lệ.");
    const description = typeof rawProduct.description === "string" ? rawProduct.description.trim() : "";
    const unit = typeof rawProduct.unit === "string" ? rawProduct.unit.trim() : "";
    const quantity = rawProduct.quantity;
    const unitPrice = rawProduct.unitPrice;
    const priceUnavailable = recalculateWithAi && rawProduct.priceUnavailable === true;
    if (rawProduct.priceUnavailable !== undefined && (typeof rawProduct.priceUnavailable !== "boolean" || (rawProduct.priceUnavailable && !recalculateWithAi))) return fail(response, "Hãy nhập đơn giá trước khi lưu sản phẩm bổ sung.", 422);
    if (!validText(name, 250) || description.length > 2000 || !validText(unit, 50)) return fail(response, "Mỗi dòng bổ sung cần có tên sản phẩm và đơn vị tính hợp lệ.");
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) return fail(response, "Số lượng sản phẩm bổ sung phải lớn hơn 0 và không vượt quá 1.000.000.");
    if (typeof unitPrice !== "number" || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1e12) return fail(response, "Đơn giá sản phẩm bổ sung phải là số tiền không âm.");
    if (rawProduct.id !== undefined && typeof rawProduct.id !== "string") return fail(response, "Mã dòng sản phẩm bổ sung không hợp lệ.");
    const requestedId = typeof rawProduct.id === "string" ? rawProduct.id : "";
    const existingLine = requestedId ? existingSupplementalById.get(requestedId) : undefined;
    if (requestedId && !existingLine) return fail(response, "Không thể sửa dòng sản phẩm bổ sung không thuộc báo giá này.");
    const id = existingLine?.catalogItemId ?? `supplemental:${randomUUID()}`;
    if (usedSupplementalIds.has(id)) return fail(response, "Không thể lặp lại một dòng sản phẩm bổ sung.");
    usedSupplementalIds.add(id);
    if (rawProduct.informationField !== undefined && typeof rawProduct.informationField !== "string") return fail(response, "Mục thiếu thông tin không hợp lệ.");
    const informationField = typeof rawProduct.informationField === "string" ? rawProduct.informationField : existingLine?.supplementalFor;
    if (informationField && existingLine?.supplementalFor !== informationField && (!currentQuote.informationNeeded.includes(informationField) || !isSupplementalProductInformation(informationField))) {
      return fail(response, "Mục thông tin cần bổ sung không khớp với sản phẩm.");
    }
    supplementalLines.push({
      catalogItemId: id, source: "supplemental", ...(informationField ? { supplementalFor: informationField } : {}),
      sku: "", name, description, quantity, unit, unitPrice: priceUnavailable ? 0 : unitPrice, currency: quote.currency,
      catalogAttributes: existingLine?.catalogAttributes ?? {}, attributes: existingLine?.attributes ?? {},
      ...(priceUnavailable ? { priceUnavailable: true, supplementalFor: informationField ?? `Sản phẩm cần bổ sung giá: ${name}` } : {}),
      lineTotal: priceUnavailable ? 0 : roundMoney(quantity * unitPrice),
    });
  }
  const taxRate = Object.prototype.hasOwnProperty.call(body, "taxRate") ? Number(body.taxRate) : quote.taxRate;
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) return fail(response, "Thuế suất VAT phải từ 0 đến 100%.");
  if (Object.prototype.hasOwnProperty.call(body, "taxRateConfirmed") && typeof body.taxRateConfirmed !== "boolean") return fail(response, "Trạng thái xác nhận VAT không hợp lệ.");
  const taxRateConfirmed = Object.prototype.hasOwnProperty.call(body, "taxRateConfirmed") ? body.taxRateConfirmed === true : currentQuote.taxRateConfirmed === true;
  const rawShippingFee = Object.prototype.hasOwnProperty.call(body, "shippingFee") ? body.shippingFee : currentQuote.shippingFee;
  if (rawShippingFee !== null && rawShippingFee !== undefined && (typeof rawShippingFee !== "number" || !Number.isFinite(rawShippingFee) || rawShippingFee < 0 || rawShippingFee > 1e12)) return fail(response, "Phí vận chuyển phải là số tiền không âm.");
  if (Object.prototype.hasOwnProperty.call(body, "shippingFeeConfirmed") && typeof body.shippingFeeConfirmed !== "boolean") return fail(response, "Trạng thái xác nhận phí vận chuyển không hợp lệ.");
  const shippingFee = typeof rawShippingFee === "number" ? rawShippingFee : null;
  const shippingFeeConfirmed = Object.prototype.hasOwnProperty.call(body, "shippingFeeConfirmed")
    ? body.shippingFeeConfirmed === true && shippingFee !== null
    : currentQuote.shippingFeeConfirmed === true && shippingFee !== null;
  const validityDays = Object.prototype.hasOwnProperty.call(body, "validityDays") ? body.validityDays : quote.validityDays ?? null;
  if (validityDays !== null && (typeof validityDays !== "number" || !Number.isInteger(validityDays) || validityDays < 1 || validityDays > 3650)) return fail(response, "Thời hạn báo giá phải từ 1 đến 3.650 ngày.");
  const completionDate = Object.prototype.hasOwnProperty.call(body, "completionDate") ? body.completionDate : quote.completionDate ?? null;
  const parsedCompletionDate = typeof completionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(completionDate) ? new Date(`${completionDate}T00:00:00Z`) : null;
  if (completionDate !== null && (!parsedCompletionDate || Number.isNaN(parsedCompletionDate.getTime()) || parsedCompletionDate.toISOString().slice(0, 10) !== completionDate)) return fail(response, "Hạn hoàn thành không hợp lệ.");
  let totals;
  try {
    const recalculated = catalogLines.length
      ? recalculateSnapshot(catalogLines, updates.map((item: Record<string, unknown>) => ({
        catalogItemId: String(item.catalogItemId), quantity: Number(item.quantity),
      })), taxRateConfirmed ? taxRate : 0)
      : { lines: [], subtotal: 0, taxRate, taxAmount: 0, total: 0, currency: quote.currency };
    const lines = [...recalculated.lines, ...supplementalLines];
    const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0));
    const taxAmount = roundMoney(subtotal * (taxRateConfirmed ? taxRate : 0));
    totals = {
      ...recalculated,
      lines,
      subtotal,
      taxRate,
      taxRateConfirmed,
      taxAmount,
      shippingFee,
      shippingFeeConfirmed,
      total: roundMoney(subtotal + taxAmount + (shippingFeeConfirmed ? shippingFee ?? 0 : 0)),
    };
  } catch (error) {
    return fail(response, error instanceof Error ? error.message : "Không thể tính lại báo giá.");
  }
  const informationConfirmed = request.body?.informationConfirmed === true || quote.informationConfirmed;
  let informationNeeded = currentQuote.informationNeeded.filter((field) =>
    !(taxRateConfirmed && isTaxInformation(field)) && !(shippingFeeConfirmed && isShippingInformation(field))
    && !isAnsweredQuoteChargeQuestion(field, { taxRate, taxRateConfirmed, shippingFee, shippingFeeConfirmed }),
  );
  informationNeeded = removeAnsweredSupplementalPriceQuestions(informationNeeded, supplementalLines);
  if (!taxRateConfirmed && !informationNeeded.some(isTaxInformation)) informationNeeded.push("VAT: cần xác nhận thuế suất.");
  if (!shippingFeeConfirmed && !informationNeeded.some(isShippingInformation)) informationNeeded.push("Phí vận chuyển: cần xác nhận số tiền hoặc xác nhận miễn phí.");
  const unresolved = informationNeeded.some((field) => isSupplementalProductInformation(field)
    ? !supplementalLines.some((line) => line.supplementalFor === field)
    : !additionalInformation[field]?.trim())
    || !taxRateConfirmed || !shippingFeeConfirmed;
  const nextStatus: QuoteStatus = unresolved ? "needs_info"
    : quote.status === "rejected" || quote.status === "needs_info" ? "draft" : quote.status;
  const customerName = request.body?.customerName ?? quote.customerName;
  const customerEmail = request.body?.customerEmail ?? quote.customerEmail;
  const customerPhone = request.body?.customerPhone ?? quote.customerPhone ?? "";
  if (typeof customerPhone !== "string" || customerPhone.length > 50) return fail(response, "Số điện thoại không hợp lệ (tối đa 50 ký tự).");
  if (!validText(customerName, 250) || typeof customerEmail !== "string" || customerEmail.length > 250 || (customerEmail.trim() && !validEmail(customerEmail.trim()))) return fail(response, "Vui lòng nhập tên khách hàng và email hợp lệ (nếu có).");
  const customer = { customerName: customerName.trim(), customerEmail: customerEmail.trim(), customerPhone: customerPhone.trim() };
  const additionalInformationBindingChanged = [...new Set([...Object.keys(currentQuote.additionalInformation ?? {}), ...Object.keys(additionalInformation)])]
    .some((field) => (currentQuote.additionalInformation?.[field] ?? "").trim() !== (additionalInformation[field] ?? "").trim())
    || revisionRequirements.trim() !== (quote.revisionRequirements ?? "");
  let updatedQuote: Quote = {
    ...quote, ...totals, ...customer, informationNeeded, additionalInformation, validityDays, completionDate,
    revisionRequirements: revisionRequirements.trim(), informationConfirmed, status: nextStatus,
    ...(additionalInformationBindingChanged ? { templateFillPlan: undefined, xlsxTemplateFillPlan: undefined } : {}),
  };
  if (quote.kind !== "customer" && quote.kind !== "budget" && additionalInformationBindingChanged) updatedQuote.requiresAiRecalculation = true;
  if (updatedQuote.requiresAiRecalculation) { updatedQuote.status = "needs_info"; updatedQuote.informationConfirmed = false; }
  const persist = async () => {
    const { _id: _quoteId, companyId: _companyId, companyCode: _companyCode, branchId: _branchId, templateFillPlan, xlsxTemplateFillPlan, ...fields } = updatedQuote as Quote & { companyCode?: string; branchId?: string };
    const unsetFillPlans: Record<string, ""> = {};
    if (!templateFillPlan) unsetFillPlans.templateFillPlan = "";
    if (!xlsxTemplateFillPlan) unsetFillPlans.xlsxTemplateFillPlan = "";
    const result = await quotes.updateOne({ _id: id, companyId: user.companyId, updatedAt: quote.updatedAt, status: quote.status }, {
      $set: { ...fields, ...(templateFillPlan ? { templateFillPlan } : {}), ...(xlsxTemplateFillPlan ? { xlsxTemplateFillPlan } : {}), updatedAt: new Date() },
      ...(Object.keys(unsetFillPlans).length ? { $unset: unsetFillPlans } : {}),
    });
    if (!result.matchedCount) throw new Error("Dự toán đã thay đổi trong lúc xử lý. Vui lòng tải lại trang rồi thử lại.");
  };
  try {
    if (recalculateWithAi) {
      await withAiUsage(db, user, "estimate_recalculate", async () => {
        updatedQuote = await recalculateEstimateWithClarifications(updatedQuote, await quoteInputContext(db, updatedQuote));
        updatedQuote.templateFillPlan = undefined;
        updatedQuote.xlsxTemplateFillPlan = undefined;
        const ctx = quotationContext(), access = await resolveQuotationJobContext(ctx);
        if (access.scopeId !== ctx.scopeId || !canQuotation("quotation:manage", access) || !canQuotation("quotation-ai:manage", access)) throw Object.assign(new Error("Quyền tính lại dự toán đã thay đổi. Hãy tải lại trang."), { statusCode: 403 });
        await persist();
      });
    } else await persist();
  } catch (error) {
    return fail(response, error instanceof Error ? error.message : "Không thể tính lại dự toán.", error instanceof AiQuotaExceededError ? 429 : (error as { statusCode?: number })?.statusCode || 422);
  }
  await writeAudit(db, user, recalculateWithAi ? "estimate_recalculated_with_ai" : "quote_recalculated", "quote", id.toHexString(), { total: updatedQuote.total, productCount: updatedQuote.lines.length });
  const updated = await quotes.findOne({ _id: id, companyId: user.companyId });
  response.json({ quote: updated ? quoteForResponse(updated) : null });
});


app.post("/quotes/:id/submit-review", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã báo giá không hợp lệ.");
  const db = await connectDatabase();
  const user = userOf(request);
  const quotes = db.collection<Quote>("quotes");
  const quote = await quotes.findOne({ _id: id, companyId: user.companyId });
  if (!quote) return fail(response, "Không tìm thấy báo giá.", 404);
  if (quote.status !== "draft" || quoteHasUnresolvedInformation(quote)) return fail(response, quote.kind === "customer" ? "Danh sách sản phẩm chưa sẵn sàng để gửi duyệt." : "Hãy xử lý các khoản chưa có giá hoặc điều khoản còn thiếu trước khi gửi duyệt.", 409);
  await quotes.updateOne({ _id: id, companyId: user.companyId }, { $set: { status: "pending_review", updatedAt: new Date() } });
  await writeAudit(db, user, "quote_submitted", "quote", id.toHexString());
  response.json({ quote: await quotes.findOne({ _id: id, companyId: user.companyId }) });
});


app.post("/quotes/:id/approve", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã báo giá không hợp lệ.");
  const db = await connectDatabase();
  const user = userOf(request);
  const quotes = db.collection<Quote>("quotes");
  const current = await quotes.findOne({ _id: id, companyId: user.companyId });
  if (!current) return fail(response, "Không tìm thấy báo giá.", 404);
  const blockers = quoteApprovalBlockers(quoteForResponse(current));
  if (current.kind !== "customer" && blockers.length) return fail(response, blockers.join(" "), 409);
  const approvableStatuses: QuoteStatus[] = ["draft", "needs_info", "pending_review"];
  const result = await quotes.findOneAndUpdate(
    {
      _id: id,
      companyId: user.companyId,
      $or: [
        { status: { $in: approvableStatuses } },
        { kind: "customer", status: "rejected" },
      ],
    },
    { $set: { status: "approved", approvedBy: user.id, approvedAt: new Date(), updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!result) return fail(response, "Chỉ có thể duyệt báo giá nháp hoặc đang chờ duyệt.", 409);
  await writeAudit(db, user, "quote_approved", "quote", id.toHexString());
  response.json({ quote: result });
});


app.post("/quotes/:id/reject", async (request, response) => {
  const id = asId(request.params.id);
  const reason = request.body?.reason;
  if (!id || !validText(reason, 1000)) return fail(response, "Vui lòng nhập lý do trả lại (tối đa 1.000 ký tự).");
  const db = await connectDatabase();
  const user = userOf(request);
  const quotes = db.collection<Quote>("quotes");
  const result = await quotes.findOneAndUpdate(
    { _id: id, companyId: user.companyId, status: "pending_review" },
    { $set: { status: "rejected", rejectionReason: reason.trim(), updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!result) return fail(response, "Chỉ có thể trả lại báo giá đang chờ duyệt.", 409);
  await writeAudit(db, user, "quote_rejected", "quote", id.toHexString(), { reason: reason.trim() });
  response.json({ quote: result });
});


function validDocumentDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}


function validDocumentTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}


function validMoneyAmount(value: unknown, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum;
}


function sendWord(response: express.Response, filename: string, bytes: Buffer) {
  response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  response.send(bytes);
}


function generatedExportTemplate(user: SessionUser, filename: string, extension: "docx" | "xlsx" | "pdf", bytes: Buffer): QuoteTemplate {
  return {
    companyId: user.companyId,
    category: "quote",
    name: filename,
    originalFilename: filename,
    extension,
    bytes: bytes.length,
    data: new Binary(bytes),
    createdAt: new Date(),
    uploadedBy: user.id,
  };
}


app.get("/document-templates/:kind", (request, response) => {
  const kind = request.params.kind;
  if (kind !== "contract" && kind !== "acceptance") return fail(response, "Không tìm thấy mẫu chứng từ.", 404);
  sendWord(response, kind === "contract" ? "mau-hop-dong.docx" : "mau-nghiem-thu.docx", makeDocumentWord(kind));
});


async function usableContractTemplates(db: Db, companyId: string) {
  const saved = await db.collection<QuoteTemplate>("quoteTemplates")
    .find({ companyId, category: "contract", extension: { $in: ["docx", "xlsx", "pdf"] }, deletedAt: { $exists: false } }).sort({ _id: -1 }).limit(100).toArray();
  return saved.filter((template) => contractTemplateMode(template));
}


async function usableAcceptanceTemplates(db: Db, companyId: string) {
  const saved = await db.collection<QuoteTemplate>("quoteTemplates")
    .find({ companyId, category: { $in: ["acceptance", "settlement"] }, extension: { $in: ["docx", "xlsx", "pdf"] }, deletedAt: { $exists: false } }).sort({ _id: -1 }).limit(100).toArray();
  return saved.filter((template) => Boolean(contractTemplateMode(template)));
}


app.get("/contract-templates", async (request, response) => {
  const templates = await usableContractTemplates(await connectDatabase(), userOf(request).companyId);
  response.json({ templates: templates.map((template) => ({ ...templateDetails(template), ...(template.extension === "docx" ? { mode: contractTemplateMode(template) } : {}) })) });
});


app.get("/acceptance-templates", async (request, response) => {
  const templates = await usableAcceptanceTemplates(await connectDatabase(), userOf(request).companyId);
  response.json({ templates: templates.map((template) => ({ ...templateDetails(template), ...(template.extension === "docx" ? { mode: contractTemplateMode(template) } : {}) })) });
});


app.get("/settlement-templates", async (request, response) => {
  const templates = await (await connectDatabase()).collection<QuoteTemplate>("quoteTemplates")
    .find({ companyId: userOf(request).companyId, category: { $in: ["acceptance", "settlement"] }, extension: { $in: ["docx", "xlsx", "pdf"] }, deletedAt: { $exists: false } }, { projection: { data: 0, fillPlanCache: 0, xlsxFillPlanCache: 0 } })
    .sort({ _id: -1 }).limit(100).toArray();
  response.json({ templates: templates.map(templateDetails) });
});


app.get("/contracts", async (request, response) => {
  const user = userOf(request);
  const contracts = await (await connectDatabase()).collection<Contract>("contracts")
    .find({ companyId: user.companyId }).sort({ createdAt: -1 }).limit(200).toArray();
  response.json({ contracts });
});


app.get("/contracts/prefill", async (request, response) => {
  const user = userOf(request);
  const companyId = asId(user.companyId);
  const company = companyId ? await (await connectDatabase()).collection<Company>("companies").findOne({ _id: companyId }) : null;
  if (!company) return fail(response, "Không tìm thấy hồ sơ doanh nghiệp.", 404);
  response.json({ company: {
    name: company.name, address: company.address ?? "", taxId: company.taxId ?? "",
    representativeName: company.representativeName ?? "", phone: company.phone ?? "", email: company.businessEmail ?? "",
  } });
});


app.post("/contracts", async (request, response) => {
  const quoteId = asId(request.body?.quoteId);
  if (!quoteId) return fail(response, "Hãy chọn dự toán hợp lệ.");
  const db = await connectDatabase();
  const user = userOf(request);
  const quote = await db.collection<Quote>("quotes").findOne({ _id: quoteId, companyId: user.companyId });
  if (!quote) return fail(response, "Không tìm thấy dự toán.", 404);
  if (quote.kind === "customer" || quote.status !== "approved" || quoteHasUnresolvedInformation(quote)
    || !quote.lines.length || quote.lines.some((line) => line.priceUnavailable || !Number.isFinite(line.quantity) || line.quantity <= 0)) {
    return fail(response, "Chỉ có thể tạo hợp đồng từ dự toán đã duyệt và đủ thông tin.", 409);
  }
  const existing = await db.collection<Contract>("contracts").findOne({ companyId: user.companyId, quoteId: quoteId.toHexString() });
  if (existing) return response.json({ contract: existing });
  const body = request.body ?? {};
  const requestedTemplateId = body.templateId ? asId(String(body.templateId)) : null;
  if (body.templateId && !requestedTemplateId) return fail(response, "Mẫu hợp đồng không hợp lệ.");
  const templates = db.collection<QuoteTemplate>("quoteTemplates");
  let selectedTemplate = requestedTemplateId
    ? await templates.findOne({ _id: requestedTemplateId, companyId: user.companyId, category: "contract", extension: "docx", deletedAt: { $exists: false } })
    : (await usableContractTemplates(db, user.companyId))[0] ?? null;
  if (requestedTemplateId && !selectedTemplate) return fail(response, "Không tìm thấy mẫu hợp đồng đã chọn.", 404);
  if (selectedTemplate && !contractTemplateMode(selectedTemplate)) return fail(response, "Mẫu hợp đồng cần là file Word (.docx) hợp lệ.", 422);
  const requiredFields = ["customerName", "customerAddress", "customerRepresentative", "scope", "projectName", "projectAddress", "deliverables", "paymentTerms", "deliveryTerms", "signingPlace"] as const;
  for (const field of requiredFields) {
    if (!validText(body[field], ["scope", "deliverables", "paymentTerms", "deliveryTerms"].includes(field) ? 4000 : 250)) {
      return fail(response, `Vui lòng nhập ${field} hợp lệ.`);
    }
  }
  const optionalFields = ["customerEmail", "customerPhone", "customerTaxId", "companyTaxId", "companyPhone", "companyEmail"] as const;
  for (const field of optionalFields) {
    if (typeof body[field] !== "string" || body[field].length > 250) return fail(response, `Thông tin ${field} không hợp lệ.`);
  }
  const optionalSellerFields = ["companyName", "companyAddress", "companyRepresentative"] as const;
  for (const field of optionalSellerFields) {
    if (body[field] !== undefined && (typeof body[field] !== "string" || body[field].length > 250)) return fail(response, `Thông tin ${field} không hợp lệ.`);
  }
  if (body.customerEmail.trim() && !validEmail(body.customerEmail.trim())) return fail(response, "Email khách hàng không hợp lệ.");
  if (body.companyEmail.trim() && !validEmail(body.companyEmail.trim())) return fail(response, "Email doanh nghiệp không hợp lệ.");
  if (!validDocumentDate(body.signedDate)) return fail(response, "Hãy nhập ngày ký dự kiến hợp lệ.");
  const depositAmount = body.depositAmount == null ? 0 : body.depositAmount;
  if (!validMoneyAmount(depositAmount, quote.total)) return fail(response, "Tiền đặt cọc phải từ 0 đến tổng giá trị dự toán.");
  if (typeof body.bankDetails !== "string" || body.bankDetails.length > 1000 || typeof body.otherTerms !== "string" || body.otherTerms.length > 10000) {
    return fail(response, "Thông tin tài khoản hoặc điều khoản bổ sung quá dài.");
  }
  const id = new ObjectId();
  const now = new Date();
  const contract: Contract = {
    _id: id, companyId: user.companyId, quoteId: quoteId.toHexString(), quoteNumber: quote.quoteNumber,
    contractNumber: `HD-${id.toHexString().slice(-8).toUpperCase()}`, status: "draft",
    ...(selectedTemplate ? { template: { id: selectedTemplate._id!.toHexString(), name: selectedTemplate.name || selectedTemplate.originalFilename, originalFilename: selectedTemplate.originalFilename } } : {}),
    customerName: body.customerName.trim(), customerEmail: body.customerEmail.trim(), customerPhone: body.customerPhone.trim(),
    customerAddress: body.customerAddress.trim(), customerTaxId: body.customerTaxId.trim(), customerRepresentative: body.customerRepresentative.trim(),
    companyName: typeof body.companyName === "string" ? body.companyName.trim() : "", companyAddress: typeof body.companyAddress === "string" ? body.companyAddress.trim() : "", companyTaxId: body.companyTaxId.trim(),
    companyRepresentative: typeof body.companyRepresentative === "string" ? body.companyRepresentative.trim() : "", companyPhone: body.companyPhone.trim(), companyEmail: body.companyEmail.trim(),
    lines: quote.lines.map((line) => ({ ...line })),
    subtotal: quote.subtotal, taxRate: quote.taxRate, taxAmount: quote.taxAmount,
    shippingFee: quote.shippingFee ?? 0, total: quote.total, currency: quote.currency,
    scope: body.scope.trim(), projectName: body.projectName.trim(), projectAddress: body.projectAddress.trim(),
    deliverables: body.deliverables.trim(), depositAmount, bankDetails: body.bankDetails.trim(), otherTerms: body.otherTerms.trim(),
    paymentTerms: body.paymentTerms.trim(), deliveryTerms: body.deliveryTerms.trim(),
    signingPlace: body.signingPlace.trim(), signedDate: body.signedDate,
    createdBy: user.id, createdAt: now, updatedAt: now,
  };
  try {
    await db.collection<Contract>("contracts").insertOne(contract);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === 11000) {
      const concurrent = await db.collection<Contract>("contracts").findOne({ companyId: user.companyId, quoteId: quoteId.toHexString() });
      if (concurrent) return response.json({ contract: concurrent });
    }
    throw error;
  }
  await writeAudit(db, user, "contract_created", "contract", id.toHexString(), { quoteId: quoteId.toHexString() });
  response.status(201).json({ contract });
});


async function contractWithSourceLines(db: Db, contract: Contract): Promise<Contract> {
  if (Array.isArray(contract.lines) && contract.lines.length > 0) return contract;
  const quoteId = asId(contract.quoteId);
  if (!quoteId) return contract;
  const quote = await db.collection<Quote>("quotes").findOne({ _id: quoteId, companyId: contract.companyId });
  if (!quote || !Array.isArray(quote.lines) || quote.lines.length === 0) return contract;
  const lines = quote.lines.map((line) => ({ ...line }));
  if (contract._id) {
    await db.collection<Contract>("contracts").updateOne(
      { _id: contract._id, companyId: contract.companyId, $or: [{ lines: { $exists: false } }, { lines: { $size: 0 } }] },
      { $set: { lines } },
    );
  }
  return { ...contract, lines };
}


app.get("/contracts/:id", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã hợp đồng không hợp lệ.");
  const user = userOf(request);
  const db = await connectDatabase();
  const stored = await db.collection<Contract>("contracts").findOne({ _id: id, companyId: user.companyId });
  if (!stored) return fail(response, "Không tìm thấy hợp đồng.", 404);
  response.json({ contract: await contractWithSourceLines(db, stored) });
});


app.get(["/contracts/:id/docx", "/contracts/:id/file"], async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã hợp đồng không hợp lệ.");
  const user = userOf(request);
  const db = await connectDatabase();
  const contract = await db.collection<Contract>("contracts").findOne({ _id: id, companyId: user.companyId });
  if (!contract) return fail(response, "Không tìm thấy hợp đồng.", 404);
  const templates = db.collection<QuoteTemplate>("quoteTemplates");
  const overrideTemplateId = request.query.templateId === undefined ? null : asId(String(request.query.templateId));
  if (request.query.templateId !== undefined && !overrideTemplateId) return fail(response, "Mã mẫu hợp đồng không hợp lệ.");
  const savedTemplateId = contract.template?.id ? asId(contract.template.id) : null;
  if (contract.template && !savedTemplateId) return fail(response, "Mẫu hợp đồng đã lưu không hợp lệ.", 422);
  let selectedTemplate = overrideTemplateId
    ? await templates.findOne({ _id: overrideTemplateId, companyId: user.companyId, category: "contract", extension: { $in: ["docx", "xlsx", "pdf"] }, deletedAt: { $exists: false } })
    : savedTemplateId
    ? await templates.findOne({ _id: savedTemplateId, companyId: user.companyId, category: "contract" })
    : (await usableContractTemplates(db, user.companyId))[0] ?? null;
  if (overrideTemplateId && !selectedTemplate) return fail(response, "Không tìm thấy mẫu hợp đồng đã chọn.", 404);
  if (savedTemplateId && !selectedTemplate) return fail(response, "Không tìm thấy mẫu đã dùng để tạo hợp đồng.", 404);
  try {
    const exportTemplate = selectedTemplate ?? {
      ...generatedExportTemplate(user, `${contract.contractNumber}.docx`, "docx", makeDocumentWord("contract", contract)),
      category: "contract" as const,
    };
    const render = async () => {
      const file = await renderContractFile(db, exportTemplate, contract, (work) => withAiUsage(db, user, "contract_template_map", work));
      return { ...file, filename: `${contract.contractNumber}.${file.extension}`, mimeType: templateFormats[file.extension] };
    };
    if (request.query.background === "1") {
      const job = await queueGeneratedExport(db, user, "contract", id.toHexString(), render);
      return response.status(202).json(job);
    }
    const file = await render();
    await storeGeneratedExport(db, user, file.filename, file.mimeType, file.bytes);
    if ("fallback" in file && file.fallback) response.setHeader("X-Contract-Template-Status", "fallback-ai-error");
    if (file.extension === "docx") return sendWord(response, file.filename, file.bytes);
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    return response.send(file.bytes);
  } catch (error) { return fail(response, error instanceof Error ? error.message : "Không xuất được hợp đồng theo mẫu đã chọn.", generatedExportErrorStatus(error)); }
});


app.patch("/contracts/:id", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã hợp đồng không hợp lệ.");
  const db = await connectDatabase();
  const user = userOf(request);
  const current = await db.collection<Contract>("contracts").findOne({ _id: id, companyId: user.companyId, status: "draft" });
  if (!current) return fail(response, "Chỉ có thể sửa hợp đồng nháp.", 409);
  const fields = ["scope", "paymentTerms", "deliveryTerms", "projectName", "projectAddress", "deliverables", "signingPlace"] as const;
  const updates: Record<string, string> = {};
  for (const field of fields) {
    const value = request.body?.[field];
    if (!validText(value, ["scope", "paymentTerms", "deliveryTerms", "deliverables"].includes(field) ? 4000 : 250)) return fail(response, `Thông tin ${field} không hợp lệ.`);
    updates[field] = value.trim();
  }
  for (const [field, limit] of [["bankDetails", 1000], ["otherTerms", 10000]] as const) {
    const value = request.body?.[field];
    if (typeof value !== "string" || value.length > limit) return fail(response, `Thông tin ${field} không hợp lệ.`);
    updates[field] = value.trim();
  }
  const depositAmount = request.body?.depositAmount == null ? current.depositAmount ?? 0 : request.body.depositAmount;
  if (!validMoneyAmount(depositAmount, current.total) || !validDocumentDate(request.body?.signedDate)) return fail(response, "Tiền đặt cọc hoặc ngày ký dự kiến không hợp lệ.");
  const contract = await db.collection<Contract>("contracts").findOneAndUpdate(
    { _id: id, companyId: user.companyId, status: "draft" },
    { $set: { ...updates, depositAmount, signedDate: request.body.signedDate, updatedAt: new Date() } }, { returnDocument: "after" },
  );
  if (!contract) return fail(response, "Chỉ có thể sửa hợp đồng nháp.", 409);
  await writeAudit(db, user, "contract_updated", "contract", id.toHexString());
  response.json({ contract });
});


app.post("/contracts/:id/sign", async (request, response) => {
  const id = asId(request.params.id);
  const signedDate = request.body?.signedDate;
  if (!id || !validDocumentDate(signedDate)) return fail(response, "Hãy nhập ngày ký hợp lệ.");
  const db = await connectDatabase();
  const user = userOf(request);
  const draft = await db.collection<Contract>("contracts").findOne({ _id: id, companyId: user.companyId, status: "draft" });
  if (!draft) return fail(response, "Chỉ có thể xác nhận hợp đồng nháp.", 409);
  if (!draft.scope.trim() || !draft.paymentTerms.trim() || !draft.deliveryTerms.trim()) {
    return fail(response, "Hãy hoàn thiện phạm vi, thanh toán và tiến độ trước khi xác nhận ký.", 409);
  }
  if (!validText(draft.projectName, 250) || !validText(draft.projectAddress, 250)
    || !validText(draft.deliverables, 4000) || (draft.depositAmount !== undefined && !validMoneyAmount(draft.depositAmount, draft.total))) {
    return fail(response, "Hãy bổ sung công trình và hồ sơ bàn giao trước khi xác nhận ký.", 409);
  }
  const contract = await db.collection<Contract>("contracts").findOneAndUpdate(
    { _id: id, companyId: user.companyId, status: "draft" },
    { $set: { status: "signed", signedDate, updatedAt: new Date() } }, { returnDocument: "after" },
  );
  if (!contract) return fail(response, "Chỉ có thể xác nhận hợp đồng nháp.", 409);
  await writeAudit(db, user, "contract_signed", "contract", id.toHexString(), { signedDate });
  response.json({ contract });
});


app.get("/acceptance-records", async (request, response) => {
  const user = userOf(request);
  const records = await (await connectDatabase()).collection<AcceptanceRecord>("acceptanceRecords")
    .find({ companyId: user.companyId }).sort({ createdAt: -1 }).limit(200).toArray();
  response.json({ records });
});


app.post("/acceptance-records", async (request, response) => {
  const contractId = asId(request.body?.contractId);
  if (!contractId) return fail(response, "Hãy chọn hợp đồng hợp lệ.");
  const db = await connectDatabase();
  const user = userOf(request);
  const storedContract = await db.collection<Contract>("contracts").findOne({ _id: contractId, companyId: user.companyId });
  if (!storedContract) return fail(response, "Không tìm thấy hợp đồng.", 404);
  const contract = await contractWithSourceLines(db, storedContract);
  if (contract.status !== "signed") return fail(response, "Hợp đồng cần được xác nhận đã ký trước khi nghiệm thu.", 409);
  const existing = await db.collection<AcceptanceRecord>("acceptanceRecords").findOne({ companyId: user.companyId, contractId: contractId.toHexString() });
  if (existing) return response.json({ record: existing });
  const requestedTemplateId = request.body?.templateId ? asId(String(request.body.templateId)) : null;
  if (request.body?.templateId && !requestedTemplateId) return fail(response, "Mẫu nghiệm thu không hợp lệ.");
  let selectedTemplate = requestedTemplateId
    ? await db.collection<QuoteTemplate>("quoteTemplates").findOne({ _id: requestedTemplateId, companyId: user.companyId, category: { $in: ["acceptance", "settlement"] }, extension: { $in: ["docx", "xlsx"] }, deletedAt: { $exists: false } })
    : (await usableAcceptanceTemplates(db, user.companyId))[0] ?? null;
  if (requestedTemplateId && !selectedTemplate) return fail(response, "Không tìm thấy mẫu nghiệm thu đã chọn.", 404);
  if (selectedTemplate && selectedTemplate.extension === "docx" && !contractTemplateMode(selectedTemplate)) return fail(response, "Mẫu Word nghiệm thu không hợp lệ.", 422);
  const { acceptedDate, location, result, notes, lines } = request.body ?? {};
  if (!validDocumentDate(acceptedDate) || !validText(location, 250) || !validText(result, 2000)
    || typeof notes !== "string" || notes.length > 4000 || !validAcceptanceLines(lines, contract)) {
    return fail(response, "Vui lòng nhập đầy đủ ngày, địa điểm, kết quả và khối lượng nghiệm thu hợp lệ.");
  }
  if (contract.signedDate && acceptedDate < contract.signedDate) return fail(response, "Ngày nghiệm thu không thể trước ngày ký hợp đồng.");
  const settlementAmount = contract.total;
  const amountPaid = contract.depositAmount ?? 0;
  const detailError = acceptanceDetailsError({ ...request.body, settlementAmount, amountPaid }, contract);
  if (detailError) return fail(response, detailError);
  const id = new ObjectId();
  const now = new Date();
  const record: AcceptanceRecord = {
    _id: id, companyId: user.companyId, contractId: contractId.toHexString(), contractNumber: contract.contractNumber,
    acceptanceNumber: `NT-${id.toHexString().slice(-8).toUpperCase()}`, status: "draft",
    ...(selectedTemplate ? { template: { id: selectedTemplate._id!.toHexString(), name: selectedTemplate.name || selectedTemplate.originalFilename, originalFilename: selectedTemplate.originalFilename } } : {}),
    acceptedDate, location: location.trim(), result: result.trim(), notes: notes.trim(), lines,
    startTime: request.body.startTime, endTime: request.body.endTime,
    handoverDetails: request.body.handoverDetails.trim(), qualityAssessment: request.body.qualityAssessment.trim(),
    settlementAmount, amountPaid, paymentDueDays: request.body.paymentDueDays,
    createdBy: user.id, createdAt: now, updatedAt: now,
  };
  try {
    await db.collection<AcceptanceRecord>("acceptanceRecords").insertOne(record);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === 11000) {
      const concurrent = await db.collection<AcceptanceRecord>("acceptanceRecords").findOne({ companyId: user.companyId, contractId: contractId.toHexString() });
      if (concurrent) return response.json({ record: concurrent });
    }
    throw error;
  }
  await writeAudit(db, user, "acceptance_created", "acceptanceRecord", id.toHexString(), { contractId: contractId.toHexString() });
  response.status(201).json({ record });
});


function validAcceptanceLines(lines: unknown, contract: Contract): lines is AcceptanceRecord["lines"] {
  return Array.isArray(lines) && lines.length === contract.lines.length && lines.some((line) => line?.acceptedQuantity > 0)
    && lines.every((line, index) => typeof line === "object" && line !== null && line.lineIndex === index
      && typeof line.acceptedQuantity === "number" && Number.isFinite(line.acceptedQuantity)
      && line.acceptedQuantity >= 0 && line.acceptedQuantity <= contract.lines[index]!.quantity
      && (line.acceptedDetails === undefined || (typeof line.acceptedDetails === "string" && line.acceptedDetails.length <= 1000)));
}

function acceptanceLineSummary(record: Pick<AcceptanceRecord, "lines">, contract: Contract) {
  return record.lines.filter((line) => line.acceptedQuantity > 0).map((line) => {
    const item = contract.lines[line.lineIndex];
    if (!item) return "";
    const details = line.acceptedDetails?.trim();
    return `${item.name}: theo hợp đồng ${item.quantity} ${item.unit}, nghiệm thu ${line.acceptedQuantity} ${item.unit}${details ? `; thông tin nghiệm thu: ${details}` : ""}`;
  }).filter(Boolean).join("; ");
}


function templateFilenameStem(filename: string) {
  return filename.replace(/\.[^/.]+$/, "").trim().toLocaleLowerCase("vi-VN");
}


function acceptanceDetailsError(body: Record<string, unknown>, contract: Contract): string | null {
  if (!validDocumentTime(body.startTime) || !validDocumentTime(body.endTime) || body.endTime <= body.startTime) return "Thời gian nghiệm thu không hợp lệ.";
  if (!validText(body.handoverDetails, 4000) || !validText(body.qualityAssessment, 2000)) return "Hãy nhập hồ sơ bàn giao và đánh giá chất lượng.";
  if (!validMoneyAmount(body.settlementAmount, contract.total) || !validMoneyAmount(body.amountPaid, body.settlementAmount)) return "Giá trị quyết toán hoặc số tiền đã thanh toán không hợp lệ.";
  if (body.paymentDueDays !== null && (!Number.isInteger(body.paymentDueDays) || (body.paymentDueDays as number) < 0 || (body.paymentDueDays as number) > 3650)) return "Thời hạn thanh toán không hợp lệ.";
  return null;
}


app.get("/acceptance-records/:id", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã nghiệm thu không hợp lệ.");
  const user = userOf(request);
  const db = await connectDatabase();
  const record = await db.collection<AcceptanceRecord>("acceptanceRecords").findOne({ _id: id, companyId: user.companyId });
  if (!record) return fail(response, "Không tìm thấy biên bản nghiệm thu.", 404);
  const storedContract = await db.collection<Contract>("contracts").findOne({ _id: asId(record.contractId), companyId: user.companyId });
  if (!storedContract) return fail(response, "Không tìm thấy hợp đồng liên kết.", 404);
  response.json({ record, contract: await contractWithSourceLines(db, storedContract) });
});


app.get(["/acceptance-records/:id/docx", "/acceptance-records/:id/file"], async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã nghiệm thu không hợp lệ.");
  const user = userOf(request);
  const db = await connectDatabase();
  const record = await db.collection<AcceptanceRecord>("acceptanceRecords").findOne({ _id: id, companyId: user.companyId });
  if (!record) return fail(response, "Không tìm thấy biên bản nghiệm thu.", 404);
  const contract = await db.collection<Contract>("contracts").findOne({ _id: asId(record.contractId), companyId: user.companyId });
  if (!contract) return fail(response, "Không tìm thấy hợp đồng liên kết.", 404);
  const overrideTemplateId = request.query.templateId === undefined ? null : asId(String(request.query.templateId));
  if (request.query.templateId !== undefined && !overrideTemplateId) return fail(response, "Mã mẫu nghiệm thu không hợp lệ.");
  const savedTemplateId = record.template?.id ? asId(record.template.id) : null;
  if (record.template && !savedTemplateId) return fail(response, "Mẫu nghiệm thu đã lưu không hợp lệ.", 422);
  const templateCollection = db.collection<QuoteTemplate>("quoteTemplates");
  const savedTemplate = savedTemplateId
    ? await templateCollection.findOne({ _id: savedTemplateId, companyId: user.companyId, category: { $in: ["acceptance", "settlement"] } })
    : null;
  let selectedTemplate = overrideTemplateId
    ? await templateCollection.findOne({ _id: overrideTemplateId, companyId: user.companyId, category: { $in: ["acceptance", "settlement"] }, extension: { $in: ["docx", "xlsx", "pdf"] }, deletedAt: { $exists: false } })
    : savedTemplate ?? (await usableAcceptanceTemplates(db, user.companyId))[0] ?? null;
  if (overrideTemplateId && !selectedTemplate) return fail(response, "Không tìm thấy mẫu nghiệm thu đã chọn.", 404);
  if (!overrideTemplateId && savedTemplateId && !savedTemplate) return fail(response, "Không tìm thấy mẫu đã dùng để tạo biên bản. Hãy chọn lại mẫu tài liệu.", 404);
  try {
    const exportTemplate = selectedTemplate ?? {
      ...generatedExportTemplate(user, `${record.acceptanceNumber}.docx`, "docx", makeDocumentWord("acceptance", contract, record)),
      category: "acceptance" as const,
    };
    const render = async () => {
      if (exportTemplate.extension === "xlsx") {
        const acceptedQuantities = new Map(record.lines.map((line) => [line.lineIndex, line.acceptedQuantity]));
        const lines = contract.lines.flatMap((line, lineIndex) => {
          const quantity = acceptedQuantities.get(lineIndex) ?? 0;
          return quantity > 0 ? [{ ...line, quantity, lineTotal: roundMoney(quantity * line.unitPrice) }] : [];
        });
        if (!lines.length) throw new Error("Biên bản chưa có hạng mục nghiệm thu để lập quyết toán.");
        const acceptedValue = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0));
        const balance = Math.max(0, record.settlementAmount - record.amountPaid);
        const exportQuote: Quote = {
          kind: "estimate", companyId: user.companyId, quoteNumber: record.acceptanceNumber, requestId: contract.quoteId,
          customerName: contract.customerName, customerEmail: contract.customerEmail, customerPhone: contract.customerPhone,
          lines, ...acceptanceFinancials(contract, record, acceptedValue), currency: contract.currency,
          informationNeeded: [], informationConfirmed: true, status: "approved", createdBy: user.id,
          createdAt: new Date(`${record.acceptedDate}T00:00:00Z`), updatedAt: record.updatedAt,
          settlement: {
            contract: settlementContractContext(contract),
            contractLines: contract.lines.map((line) => ({ ...line })),
            contractNumber: contract.contractNumber, projectName: contract.projectName, projectAddress: contract.projectAddress,
            acceptanceNumber: record.acceptanceNumber, acceptedDate: record.acceptedDate,
            startTime: record.startTime, endTime: record.endTime, location: record.location,
            result: record.result, handoverDetails: record.handoverDetails, qualityAssessment: record.qualityAssessment,
            acceptanceLines: record.lines,
            contractValue: contract.total, settlementAmount: record.settlementAmount, amountPaid: record.amountPaid, balance,
            paymentDueDays: record.paymentDueDays, notes: record.notes,
          },
        };
        const inputContext = `Hồ sơ nghiệm thu và quyết toán ${record.acceptanceNumber} theo hợp đồng ${contract.contractNumber}. Dùng số lượng nghiệm thu đã lưu, giá trị quyết toán ${record.settlementAmount} ${contract.currency}, đã thanh toán ${record.amountPaid}, còn phải thanh toán ${balance}. Ngày nghiệm thu ${record.acceptedDate}; địa điểm ${record.location}; kết quả ${record.result}; bàn giao ${record.handoverDetails}; đánh giá chất lượng ${record.qualityAssessment}; ghi chú ${record.notes}; thông tin theo từng sản phẩm: ${acceptanceLineSummary(record, contract) || "chưa nhập"}.`;
        return { filename: `${record.acceptanceNumber}.xlsx`, mimeType: templateFormats.xlsx, bytes: await withAiUsage(db, user, "acceptance_template_map", () => renderAiMappedXlsxTemplate(exportTemplate, exportQuote, inputContext)) };
      }
      if (!selectedTemplate) return {
        filename: `${record.acceptanceNumber}.docx`,
        mimeType: templateFormats.docx,
        bytes: makeDocumentWord("acceptance", contract, record),
        extension: "docx" as const,
      };
      const file = await renderAcceptanceFile(db, exportTemplate, contract, record, (work) => withAiUsage(db, user, "acceptance_template_map", work));
      return { ...file, filename: `${record.acceptanceNumber}.${file.extension}`, mimeType: templateFormats[file.extension] };
    };
    if (request.query.background === "1") {
      const job = await queueGeneratedExport(db, user, "acceptance", id.toHexString(), render);
      return response.status(202).json(job);
    }
    const file = await render();
    await storeGeneratedExport(db, user, file.filename, file.mimeType, file.bytes);
    if ("fallback" in file && file.fallback) response.setHeader("X-Acceptance-Template-Status", "fallback-ai-error");
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    return response.send(file.bytes);
  } catch (error) {
    return fail(response, error instanceof Error ? error.message : "Không xuất được biên bản theo mẫu đã chọn.", generatedExportErrorStatus(error));
  }
});


app.get(["/acceptance-records/:id/settlement/file", "/acceptance-records/:id/settlement.xlsx"], async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã nghiệm thu không hợp lệ.");
  const user = userOf(request);
  const db = await connectDatabase();
  const record = await db.collection<AcceptanceRecord>("acceptanceRecords").findOne({ _id: id, companyId: user.companyId });
  if (!record) return fail(response, "Không tìm thấy biên bản nghiệm thu.", 404);
  if (record.status !== "completed") return fail(response, "Hãy hoàn tất nghiệm thu trước khi xuất hồ sơ quyết toán.", 409);
  const storedContract = await db.collection<Contract>("contracts").findOne({ _id: asId(record.contractId), companyId: user.companyId });
  if (!storedContract) return fail(response, "Không tìm thấy hợp đồng liên kết.", 404);
  const contract = await contractWithSourceLines(db, storedContract);
  const templateId = request.query.templateId === undefined ? null : asId(String(request.query.templateId));
  if (request.query.templateId !== undefined && !templateId) return fail(response, "Mã mẫu quyết toán không hợp lệ.");
  const templates = db.collection<QuoteTemplate>("quoteTemplates");
  const template = templateId
    ? await templates.findOne({ _id: templateId, companyId: user.companyId, category: { $in: ["acceptance", "settlement"] }, extension: { $in: ["docx", "xlsx", "pdf"] }, deletedAt: { $exists: false } })
    : record.template?.id && asId(record.template.id)
    ? await templates.findOne({ _id: asId(record.template.id)!, companyId: user.companyId })
    : await templates.find({ companyId: user.companyId, category: { $in: ["acceptance", "settlement"] }, extension: { $in: ["docx", "xlsx", "pdf"] }, deletedAt: { $exists: false } }).sort({ _id: -1 }).limit(1).next();
  if (templateId && !template) return fail(response, "Không tìm thấy mẫu quyết toán đã chọn.", 404);
  if (!template) return fail(response, "Hãy tải mẫu Word, Excel hoặc PDF vào mục Nghiệm thu & quyết toán trước khi xuất hồ sơ.", 409);
  const acceptedQuantities = new Map(record.lines.map((line) => [line.lineIndex, line.acceptedQuantity]));
  const lines = contract.lines.flatMap((line, lineIndex) => {
    const quantity = acceptedQuantities.get(lineIndex) ?? 0;
    if (quantity <= 0) return [];
    return [{ ...line, quantity, lineTotal: roundMoney(quantity * line.unitPrice) }];
  });
  if (!lines.length) return fail(response, "Biên bản chưa có hạng mục nghiệm thu để quyết toán.", 409);
  const acceptedValue = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const balance = Math.max(0, record.settlementAmount - record.amountPaid);
  const exportQuote: Quote = {
    kind: "estimate", companyId: user.companyId, quoteNumber: record.acceptanceNumber, requestId: contract.quoteId,
    customerName: contract.customerName, customerEmail: contract.customerEmail, customerPhone: contract.customerPhone,
    lines, ...acceptanceFinancials(contract, record, acceptedValue), currency: contract.currency,
    informationNeeded: [], informationConfirmed: true, status: "approved", createdBy: user.id,
    createdAt: new Date(`${record.acceptedDate}T00:00:00Z`), updatedAt: record.updatedAt,
    settlement: {
      contract: settlementContractContext(contract),
      contractLines: contract.lines.map((line) => ({ ...line })),
      contractNumber: contract.contractNumber, projectName: contract.projectName, projectAddress: contract.projectAddress,
      acceptanceNumber: record.acceptanceNumber, acceptedDate: record.acceptedDate,
      startTime: record.startTime, endTime: record.endTime, location: record.location,
      result: record.result, handoverDetails: record.handoverDetails, qualityAssessment: record.qualityAssessment,
      acceptanceLines: record.lines,
      contractValue: contract.total, settlementAmount: record.settlementAmount, amountPaid: record.amountPaid, balance,
      paymentDueDays: record.paymentDueDays, notes: record.notes,
    },
  };
  const inputContext = `Hồ sơ quyết toán theo biên bản nghiệm thu ${record.acceptanceNumber}, hợp đồng ${contract.contractNumber}. Dùng số lượng nghiệm thu đã lưu, không dùng số lượng dự toán/hợp đồng. Giá trị quyết toán: ${record.settlementAmount} ${contract.currency}; đã thanh toán: ${record.amountPaid}; còn phải thanh toán: ${balance}. Ngày nghiệm thu: ${record.acceptedDate}; địa điểm: ${record.location}; kết quả: ${record.result}; bàn giao: ${record.handoverDetails}; đánh giá chất lượng: ${record.qualityAssessment}; thời hạn thanh toán còn lại: ${record.paymentDueDays ?? "chưa nhập"} ngày; ghi chú: ${record.notes}; thông tin theo từng sản phẩm: ${acceptanceLineSummary(record, contract) || "chưa nhập"}. Chỉ điền tab quyết toán/nghiệm thu phù hợp; giữ nguyên các tab của báo giá, dự toán và hợp đồng.`;
  const render = async () => {
    if (template.extension === "xlsx") return {
      filename: `Ho-so-quyet-toan-${record.acceptanceNumber}.xlsx`, mimeType: templateFormats.xlsx,
      bytes: await withAiUsage(db, user, "settlement_template_map", () => renderAiMappedXlsxTemplate(template, exportQuote, inputContext)),
    };
    const file = await renderAcceptanceFile(db, template, contract, record, (work) => withAiUsage(db, user, "settlement_template_map", work), "settlement");
    return { ...file, filename: `Ho-so-quyet-toan-${record.acceptanceNumber}.${file.extension}`, mimeType: templateFormats[file.extension] };
  };
  try {
    if (request.query.background === "1") {
      const job = await queueGeneratedExport(db, user, "settlement", id.toHexString(), render);
      return response.status(202).json(job);
    }
    const file = await render();
    await storeGeneratedExport(db, user, file.filename, file.mimeType, file.bytes);
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    return response.send(file.bytes);
  } catch (error) {
    return fail(response, error instanceof Error ? error.message : "Không xuất được hồ sơ quyết toán theo mẫu đã chọn.", generatedExportErrorStatus(error));
  }
});


app.patch("/acceptance-records/:id", async (request, response) => {
  const id = asId(request.params.id);
  const acceptedDate = request.body?.acceptedDate;
  const location = request.body?.location;
  const result = request.body?.result;
  const notes = request.body?.notes;
  const lines = request.body?.lines;
  if (!id || !validDocumentDate(acceptedDate) || !validText(location, 250) || !validText(result, 2000)
    || typeof notes !== "string" || notes.length > 4000 || !Array.isArray(lines)) {
    return fail(response, "Thông tin nghiệm thu không hợp lệ.");
  }
  const db = await connectDatabase();
  const user = userOf(request);
  const current = await db.collection<AcceptanceRecord>("acceptanceRecords").findOne({ _id: id, companyId: user.companyId });
  if (!current) return fail(response, "Không tìm thấy biên bản nghiệm thu.", 404);
  if (current.status !== "draft") return fail(response, "Biên bản đã hoàn tất, không thể sửa.", 409);
  const storedContract = await db.collection<Contract>("contracts").findOne({ _id: asId(current.contractId), companyId: user.companyId });
  if (!storedContract) return fail(response, "Không tìm thấy hợp đồng liên kết.", 404);
  const contract = await contractWithSourceLines(db, storedContract);
  if (contract.signedDate && acceptedDate < contract.signedDate) return fail(response, "Ngày nghiệm thu không thể trước ngày ký hợp đồng.");
  const detailError = acceptanceDetailsError(request.body, contract);
  if (detailError) return fail(response, detailError);
  if (!validAcceptanceLines(lines, contract)) {
    return fail(response, "Khối lượng nghiệm thu phải nằm trong khối lượng hợp đồng.");
  }
  const record = await db.collection<AcceptanceRecord>("acceptanceRecords").findOneAndUpdate(
    { _id: id, companyId: user.companyId, status: "draft" },
    { $set: { acceptedDate, location: location.trim(), result: result.trim(), notes: notes.trim(), lines,
      startTime: request.body.startTime, endTime: request.body.endTime,
      handoverDetails: request.body.handoverDetails.trim(), qualityAssessment: request.body.qualityAssessment.trim(),
      settlementAmount: request.body.settlementAmount, amountPaid: request.body.amountPaid, paymentDueDays: request.body.paymentDueDays,
      updatedAt: new Date() } }, { returnDocument: "after" },
  );
  if (!record) return fail(response, "Biên bản đã thay đổi, hãy tải lại.", 409);
  await writeAudit(db, user, "acceptance_updated", "acceptanceRecord", id.toHexString());
  response.json({ record });
});


app.post("/acceptance-records/:id/complete", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã nghiệm thu không hợp lệ.");
  const db = await connectDatabase();
  const user = userOf(request);
  const current = await db.collection<AcceptanceRecord>("acceptanceRecords").findOne({ _id: id, companyId: user.companyId });
  if (!current) return fail(response, "Không tìm thấy biên bản nghiệm thu.", 404);
  const storedContract = await db.collection<Contract>("contracts").findOne({ _id: asId(current.contractId), companyId: user.companyId });
  if (!storedContract || storedContract.status !== "signed") return fail(response, "Hợp đồng liên kết chưa được xác nhận đã ký.", 409);
  const contract = await contractWithSourceLines(db, storedContract);
  if (contract.signedDate && current.acceptedDate < contract.signedDate) return fail(response, "Ngày nghiệm thu không thể trước ngày ký hợp đồng.", 409);
  const detailError = acceptanceDetailsError(current as unknown as Record<string, unknown>, contract);
  if (detailError) return fail(response, detailError, 409);
  if (!validAcceptanceLines(current.lines, contract)) return fail(response, "Khối lượng nghiệm thu không hợp lệ.", 409);
  if (!current.lines.some((line) => line.acceptedQuantity > 0)) return fail(response, "Cần ít nhất một hạng mục có khối lượng nghiệm thu.", 409);
  const record = await db.collection<AcceptanceRecord>("acceptanceRecords").findOneAndUpdate(
    { _id: id, companyId: user.companyId, status: "draft" },
    { $set: { status: "completed", updatedAt: new Date() } }, { returnDocument: "after" },
  );
  if (!record) return fail(response, "Biên bản đã hoàn tất hoặc đã thay đổi.", 409);
  await writeAudit(db, user, "acceptance_completed", "acceptanceRecord", id.toHexString());
  response.json({ record });
});


app.post("/quotes/:id/export/retry", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã báo giá không hợp lệ.");
  const db = await connectDatabase();
  const user = userOf(request);
  const quote = await db.collection<Quote>("quotes").findOne({ _id: id, companyId: user.companyId });
  if (!quote || quote.kind !== "customer") return fail(response, "Không tìm thấy báo giá khách.", 404);
  const latestJob = await db.collection<GeneratedExportJob>("generatedExportJobs").findOne({
    companyId: user.companyId,
    sourceId: id.toHexString(),
    kind: "customer_quote",
    status: { $in: ["queued", "running"] },
  }, { sort: { createdAt: -1 } });
  const job = latestJob
    ? { jobId: latestJob._id!.toHexString(), status: latestJob.status }
    : await queueCustomerQuoteExport(db, user, quote);
  response.status(202).json(job);
});


app.get("/quotes/:id/export", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã báo giá không hợp lệ.");
  const db = await connectDatabase();
  const quotes = db.collection<Quote>("quotes");
  const storedQuote = await quotes.findOne({ _id: id, companyId: userOf(request).companyId });
  if (!storedQuote) return fail(response, "Không tìm thấy báo giá.", 404);
  if (storedQuote.kind === "customer") return fail(response, "Báo giá khách được tạo và lưu file ngay khi hoàn tất sản phẩm; hãy tải file đã lưu hoặc yêu cầu tạo lại nếu tác vụ lỗi.", 409);
  const quote = quoteForResponse(await customerQuoteWithPrices(db, storedQuote));
  const preview = request.query.preview === "1";
  const draftExport = request.query.draft === "1";
  const excelExport = request.query.excel === "1";
  if (quote.status !== "approved" && !preview && !draftExport) return fail(response, "Chỉ có thể tải file chính thức sau khi báo giá được duyệt.", 409);
  const requestedTemplateValue = request.query.templateId === undefined ? undefined : String(request.query.templateId);
  const useDefaultTemplate = requestedTemplateValue === "none";
  const requestedTemplateId = requestedTemplateValue && !useDefaultTemplate ? asId(requestedTemplateValue) : null;
  if (requestedTemplateValue !== undefined && !useDefaultTemplate && !requestedTemplateId) return fail(response, quote.kind === "customer" ? "Mã mẫu báo giá không hợp lệ." : "Mã mẫu dự toán không hợp lệ.");
  if (quote.kind === "customer" && useDefaultTemplate) return fail(response, "Báo giá khách cần dùng mẫu file đã chọn khi tạo.", 409);
  const templateCategory: "estimate" | { $in: Array<"quote" | null> } = quote.kind === "customer" ? { $in: ["quote", null] } : "estimate";
  let selectedTemplate = requestedTemplateId
    ? await db.collection<QuoteTemplate>("quoteTemplates").findOne({
      _id: requestedTemplateId, companyId: quote.companyId, deletedAt: { $exists: false }, category: templateCategory,
    })
    : !useDefaultTemplate && quote.template?.id && asId(quote.template.id) ? await db.collection<QuoteTemplate>("quoteTemplates").findOne({
      _id: asId(quote.template.id)!, companyId: quote.companyId,
    }) : null;
  if (requestedTemplateId && !selectedTemplate) return fail(response, quote.kind === "customer" ? "Không tìm thấy mẫu báo giá khách." : "Không tìm thấy mẫu dự toán.", 404);
  if (!requestedTemplateId && !useDefaultTemplate && quote.template && !selectedTemplate) {
    return fail(response, "Không tìm thấy mẫu đã dùng để tạo dự toán. Hãy chọn lại mẫu tài liệu.", 404);
  }
  if (quote.kind === "customer" && !selectedTemplate && !useDefaultTemplate) {
    const company = await db.collection<Company>("companies").findOne({ _id: asId(quote.companyId) }, { projection: { quoteTemplateId: 1 } });
    const defaultTemplateId = company?.quoteTemplateId ? asId(company.quoteTemplateId) : null;
    selectedTemplate = defaultTemplateId
      ? await db.collection<QuoteTemplate>("quoteTemplates").findOne({ _id: defaultTemplateId, companyId: quote.companyId, deletedAt: { $exists: false }, category: templateCategory })
      : null;
    if (!selectedTemplate) {
      selectedTemplate = await db.collection<QuoteTemplate>("quoteTemplates").find({ companyId: quote.companyId, deletedAt: { $exists: false }, category: templateCategory })
        .sort({ _id: -1 }).limit(1).next();
    }
    if (!selectedTemplate) return fail(response, "Hãy tải lên mẫu báo giá Word, Excel hoặc PDF trước khi xuất file.", 409);
  }
  if (quote.kind !== "customer" && excelExport && quote.status === "approved" && (!selectedTemplate || selectedTemplate.extension === "xlsx")) {
    try {
      const source = selectedTemplate?.extension === "xlsx" ? undefined : makeQuoteExcel(quote);
      const exportTemplate = selectedTemplate?.extension === "xlsx" ? selectedTemplate : generatedExportTemplate(userOf(request), `${quote.quoteNumber}.xlsx`, "xlsx", source!);
      const filename = `${quote.quoteNumber}.xlsx`;
      const render = async () => ({ filename, mimeType: templateFormats.xlsx, bytes: await withAiUsage(db, userOf(request), "quote_export_template", async () => renderAiMappedXlsxTemplate(exportTemplate, quote, await quoteInputContext(db, quote))) });
      if (request.query.background === "1") {
        const job = await queueGeneratedExport(db, userOf(request), "estimate", id.toHexString(), render);
        return response.status(202).json(job);
      }
      const { bytes } = await render();
      await storeGeneratedExport(db, userOf(request), filename, templateFormats.xlsx, bytes);
      response.setHeader("Content-Type", templateFormats.xlsx);
      response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      response.send(bytes);
    } catch (error) {
      return fail(response, error instanceof Error ? error.message : "Không xuất được báo giá theo mẫu Excel.", generatedExportErrorStatus(error));
    }
    return;
  }
  try {
    const template = selectedTemplate;
    if (draftExport && quote.status === "approved") {
      return fail(response, "Báo giá đã duyệt; hãy tải file chính thức.", 409);
    }
    if (quote.kind !== "customer" && draftExport && !template) {
      const filename = `${quote.quoteNumber}-nhap.xlsx`;
      const render = async () => ({ filename, mimeType: templateFormats.xlsx, bytes: await withAiUsage(db, userOf(request), "quote_draft_export_default", async () => renderAiMappedXlsxTemplate(
        generatedExportTemplate(userOf(request), filename, "xlsx", makeQuoteExcel(quote)), quote, await quoteInputContext(db, quote),
      )) });
      if (request.query.background === "1") {
        const job = await queueGeneratedExport(db, userOf(request), "estimate_draft", id.toHexString(), render);
        return response.status(202).json(job);
      }
      const { bytes } = await render();
      await storeGeneratedExport(db, userOf(request), filename, templateFormats.xlsx, bytes);
      response.setHeader("Content-Type", templateFormats.xlsx);
      response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      response.send(bytes);
      return;
    }
    const inputContext = await quoteInputContext(db, quote);
    const render = async () => {
      let renderQuote = quote;
      if (template && template.extension !== "xlsx" && !directDocumentEditorEnabled()) {
        const plan = await withAiUsage(db, userOf(request), "quote_export_template", () => createTemplateFillPlan(template, quote, inputContext));
        renderQuote = { ...quote, templateFillPlan: plan };
        await quotes.updateOne({ _id: id, companyId: quote.companyId }, { $set: { templateFillPlan: plan } });
      }
      let bytes: Buffer;
      if (template?.extension === "xlsx") {
        bytes = await withAiUsage(db, userOf(request), "quote_export_template", () => renderAiMappedXlsxTemplate(template, quote, inputContext));
      } else if (!template) {
        bytes = await withAiUsage(db, userOf(request), "quote_export_default_pdf", async () => {
          const source = await makePdfBuffer(quote);
          const pdfTemplate = generatedExportTemplate(userOf(request), `${quote.quoteNumber}.pdf`, "pdf", source);
          if (directDocumentEditorEnabled()) return renderTemplate(pdfTemplate, quote, inputContext);
          const plan = await createTemplateFillPlan(pdfTemplate, quote, inputContext);
          return renderTemplate(pdfTemplate, { ...quote, templateFillPlan: plan }, inputContext);
        });
      } else {
        bytes = directDocumentEditorEnabled()
          ? await withAiUsage(db, userOf(request), "quote_export_template", () => renderTemplate(template, renderQuote, inputContext))
          : await renderTemplate(template, renderQuote, inputContext);
      }
      const extension = template?.extension ?? "pdf";
      const filename = `${quote.quoteNumber}${draftExport ? "-nhap" : ""}.${extension}`;
      const mimeType = templateFormats[extension];
      if (!mimeType) throw new Error("Định dạng file xuất không được hỗ trợ để lưu.");
      return { filename, mimeType, bytes, extension };
    };
    if (request.query.background === "1") {
      const exportKind = quote.kind === "customer" ? "customer_quote" : draftExport ? "estimate_draft" : "estimate";
      const job = await queueGeneratedExport(db, userOf(request), exportKind, id.toHexString(), render);
      return response.status(202).json(job);
    }
    const { bytes, extension, filename, mimeType } = await render();
    await storeGeneratedExport(db, userOf(request), filename, mimeType, bytes);
    if (preview && extension === "docx") {
      response.type("html").setHeader("Content-Disposition", "inline").send(previewDocxHtml(bytes, `${quote.quoteNumber}.docx`));
      return;
    }
    response.setHeader("Content-Type", templateFormats[extension]);
    response.setHeader("Content-Disposition", `${preview ? "inline" : "attachment"}; filename="${filename}"`);
    response.send(bytes);
  } catch (error) {
    return fail(response, error instanceof Error ? error.message : "Không xuất được báo giá theo mẫu.", generatedExportErrorStatus(error));
  }
});


app.get("/quotes/:id/pdf", async (request, response) => {
  const id = asId(request.params.id);
  if (!id) return fail(response, "Mã báo giá không hợp lệ.");
  const db = await connectDatabase();
  const user = userOf(request);
  const storedQuote = await db.collection<Quote>("quotes").findOne({ _id: id, companyId: user.companyId });
  if (!storedQuote) return fail(response, "Không tìm thấy báo giá.", 404);
  const quote = quoteForResponse(storedQuote);
  if (quote.status !== "approved") return fail(response, "Chỉ có thể xuất PDF sau khi báo giá được duyệt.", 409);
  if (quoteHasUnresolvedInformation(quote)) return fail(response, "Không thể xuất báo giá khi còn khoản chưa có giá hoặc điều khoản chưa xác nhận.", 409);
  if (quote.kind === "customer") {
    const latestJob = await db.collection<GeneratedExportJob>("generatedExportJobs").findOne({
      companyId: user.companyId,
      sourceId: id.toHexString(),
      kind: "customer_quote",
    }, { sort: { createdAt: -1 } });
    if (!latestJob || latestJob.status !== "completed" || !latestJob.fileId) return fail(response, "File báo giá chính thức chưa được tạo và lưu xong trên Cloudinary.", 409);
    return response.redirect(307, `/files/${encodeURIComponent(latestJob.fileId)}/download`);
  }
  const exportQuery = quote.template ? "" : "?templateId=none";
  return response.redirect(307, `/api/v1/quotation/quotes/${quote._id}/export${exportQuery}`);
});
export const quotationRouter = app;
export default app;

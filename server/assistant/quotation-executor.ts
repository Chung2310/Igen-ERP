import { createHash, randomUUID } from "node:crypto";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { AssistantField, AssistantValue } from "../../src/shared/assistant-workflow";
import type { AssistantOperation } from "./catalog";
import type { AssistantRecord } from "./executor";
import { QUOTATION_OPERATIONS } from "./quotation-catalog";
import { AssistantError } from "./policy";
import { redactAssistantResult, validateStructuredField } from "./structured-data";

type Values = Record<string, AssistantValue>;
type Row = Record<string, any>;
type Lookup = (req: AuthenticatedRequest, id: string, search?: string, extra?: Values) => Promise<AssistantRecord[]>;
type Matches = (row: AssistantRecord, search: string) => boolean;
const idPattern = /^[a-f\d]{24}$/i;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
const operation = (id: string) => QUOTATION_OPERATIONS.find(op => op.id === `quotation.${id}`)!;
const version = (row: Row) => row.updatedAt || row.createdAt;
const snapshot = (row: Row) => createHash("sha256").update(JSON.stringify(row)).digest("hex");
export class QuotationUncertainExecutionError extends Error {}

function branch(req: AuthenticatedRequest, values: Values) {
  if (!req.user?.id || !req.user.companyCode || req.user.companyCode === "SYSTEM") throw new AssistantError("Cần tài khoản doanh nghiệp để sử dụng Báo giá.", 403);
  const selected = String(values.targetBranch || req.user.branchId || "");
  if (!idPattern.test(selected)) throw new AssistantError("Chọn chi nhánh Báo giá theo tên trước khi tiếp tục.");
  if (!["admin", "superadmin"].includes(req.user.role) && selected !== req.user.branchId) throw new AssistantError("Bạn chỉ được thao tác tại chi nhánh đã được gán.", 403);
  return selected;
}

async function request(req: AuthenticatedRequest, values: Values, path: string, method = "GET", body?: Row, extraHeaders: Record<string, string> = {}, mutating = method !== "GET", redirects = 0): Promise<any> {
  const selected = branch(req, values);
  if (!req.socket.localPort) throw new AssistantError("Không xác định được máy chủ nghiệp vụ.", 503);
  const host = req.socket.localAddress === "::1" ? "[::1]" : "127.0.0.1";
  const url = new URL(`/api/v1/quotation${path}`, `http://${host}:${req.socket.localPort}`);
  let response: Response;
  try {
    response = await fetch(url, { method, headers: { Authorization: req.headers.authorization || "", "Content-Type": "application/json", "x-branch-id": selected, ...extraHeaders },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(90_000), redirect: "manual" });
  } catch {
    if (mutating) throw new QuotationUncertainExecutionError("Chưa xác định được kết quả thao tác Báo giá. Kiểm tra hồ sơ hoặc tiến độ xuất file trước khi thử lại.");
    throw new AssistantError("Không kết nối được dữ liệu Báo giá. Vui lòng thử lại.", 503);
  }
  if ([301, 302, 303, 307, 308].includes(response.status) && method === "GET") {
    const next = new URL(response.headers.get("location") || "", url);
    const nextPath = next.pathname.replace(/^\/api\/v1\/quotation(?=\/)/, "");
    if (redirects >= 2 || next.origin !== url.origin || !/^\/(?:files\/[a-f\d]{24}\/download|quotes\/[a-f\d]{24}\/export)$/i.test(nextPath)) throw new AssistantError("Đường dẫn tải tài liệu Báo giá không hợp lệ.", 502);
    if (nextPath.endsWith("/export")) next.searchParams.set("background", "1");
    return request(req, values, nextPath + next.search, "GET", undefined, extraHeaders, mutating, redirects + 1);
  }
  if (!response.ok) {
    let message = "Không thực hiện được thao tác Báo giá.";
    try { const failure = await response.json(); message = String(failure.error?.message || failure.error || failure.message || message).slice(0, 1200); } catch { /* Use a public fallback. */ }
    if (mutating && response.status >= 500) throw new QuotationUncertainExecutionError("Máy chủ chưa xác nhận kết quả Báo giá. Kiểm tra hồ sơ trước khi thử lại.");
    throw new AssistantError(message, response.status);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("json")) {
    const formats: Record<string, "xlsx" | "docx" | "pdf"> = { "application/pdf": "pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx" };
    const format = formats[contentType.split(";")[0]];
    if (!format) throw new AssistantError("File này cần được mở tại màn hình Báo giá.", 422);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 20 * 1024 * 1024) throw new AssistantError("File lớn hơn 20 MB. Hãy tải từ màn hình Báo giá.", 422);
    const header = response.headers.get("content-disposition") || "";
    const matched = header.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
    let filename = matched?.[1] || matched?.[2] || `tai-lieu.${format}`;
    try { filename = decodeURIComponent(filename); } catch { /* Plain filename. */ }
    filename = filename.replace(/[\\/\r\n]/g, "_").replace(/[a-f\d]{24}/gi, "tai-lieu").slice(0, 200);
    return { filename, status: "completed", __assistantQuotationFile: { bytes, format, fileName: filename, mimeType: contentType.split(";")[0] } };
  }
  try { return await response.json(); }
  catch {
    if (mutating) throw new QuotationUncertainExecutionError("Máy chủ đã nhận thao tác Báo giá nhưng chưa đọc được kết quả. Kiểm tra hồ sơ trước khi thử lại.");
    throw new AssistantError("Không đọc được phản hồi Báo giá.", 502);
  }
}

export function quotationRecord(response: any): Row {
  return response?.item ?? response?.quote ?? response?.contract ?? response?.record ?? response?.request ?? response?.settings ?? response?.job ?? response?.analysis ?? response;
}
function rowsOf(response: any): Row[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === "object" && (response._id || response.id || response.quoteNumber || response.contractNumber || response.acceptanceNumber
    || "validCount" in response || "missingProducts" in response || "missingFields" in response)) return [response];
  for (const key of ["items", "quotes", "contracts", "records", "requests", "plans", "templates", "files", "priceLists", "rows"]) if (Array.isArray(response?.[key])) return response[key];
  const row = quotationRecord(response);
  return row && typeof row === "object" && !Array.isArray(row) ? [row] : [];
}
export function projectQuotationRecords(op: AssistantOperation, response: any): AssistantRecord[] {
  return rowsOf(response).map(raw => {
    const row = raw.input && raw.result ? { ...raw.input, ...raw.result, ...raw, total: raw.result.estimatedTotal ?? raw.result.total } : raw;
    const safe: AssistantRecord = {};
    for (const key of op.resultFields) if (row[key] !== undefined) safe[key] = redactAssistantResult(row[key]) as AssistantValue;
    const id = String(raw._id || raw.id || "");
    if (idPattern.test(id)) Object.defineProperty(safe, "id", { value: id, enumerable: false });
    const label = raw.quoteNumber || raw.contractNumber || raw.acceptanceNumber || raw.sku || raw.originalFilename || raw.name || raw.customerName || raw.input?.description || raw.requestText || raw.filename || "Chứng từ";
    const secondary = raw.sku && raw.name && label === raw.sku
      ? raw.name
      : raw.customerName && raw.customerName !== label
        ? raw.customerName
        : "";
    Object.defineProperty(safe, "displayName", { value: [label, secondary].filter(Boolean).join(" · "), enumerable: false });
    Object.defineProperty(safe, "__assistantQuotationRecord", { value: raw, enumerable: false });
    return safe;
  });
}

function isCatalogItemCurrent(raw: Row | undefined) {
  if (!raw || raw.deletedAt || raw.active === false) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (typeof raw.effectiveFrom === "string" && raw.effectiveFrom.trim() && raw.effectiveFrom > today) return false;
  if (typeof raw.effectiveTo === "string" && raw.effectiveTo.trim() && raw.effectiveTo < today) return false;
  return true;
}

export async function lookupQuotationRecords(req: AuthenticatedRequest, op: AssistantOperation, search: string, extra: Values = {}): Promise<AssistantRecord[]> {
  const values: Values = { ...extra, targetBranch: extra.targetBranch || req.user?.branchId || "" };
  let response: any;
  const entity = op.id.split(".")[1];
  const detailPath = ({ quote: "quotes", contract: "contracts", acceptance: "acceptance-records" } as Record<string, string>)[entity];
  if (idPattern.test(search) && detailPath) {
    try { response = await request(req, values, `/${detailPath}/${search}`); }
    catch (error) { if (error instanceof AssistantError && [403, 404].includes(error.status)) return []; throw error; }
  } else if (entity === "template") {
    const templates: Row[] = [];
    for (const category of values.category ? [String(values.category)] : ["quote", "estimate", "contract", "acceptance", "settlement"]) {
      let cursor = "";
      for (let page = 0; page < 30; page++) {
        const result = await request(req, values, `/quote-templates?category=${category}${cursor ? `&cursor=${cursor}` : ""}`);
        templates.push(...result.templates); if (!result.nextCursor) break; cursor = result.nextCursor;
      }
    }
    response = { templates: templates.filter((row, index, all) => all.findIndex(other => String(other._id || other.id) === String(row._id || row.id)) === index) };
  } else if (entity === "quote" && !values.kind) {
    const responses = await Promise.all([request(req, values, "/quotes?kind=customer"), request(req, values, "/quotes?kind=estimate")]);
    response = { quotes: responses.flatMap(result => result.quotes) };
  } else {
    const listValues: Values = { ...values };
    if (entity === "catalog") { listValues.includeDeleted = "all"; if (!idPattern.test(search)) listValues.q = search.split(" · ")[0]; }
    response = await callQuotationOperation(req, op, listValues);
  }
  const selected = projectQuotationRecords(op, response).filter(row => {
    const raw = row.__assistantQuotationRecord as unknown as Row;
    if (values.kind && (values.kind === "estimate" ? raw.kind === "customer" : raw.kind !== values.kind)) return false;
    if (values.status && raw.status !== values.status) return false;
    if (values.category && !(raw.category === values.category || (!raw.category && values.category === "quote") || (values.category === "acceptance" && raw.category === "settlement"))) return false;
    return !search || row.id === search || normalize(String(row.displayName)).includes(normalize(search)) || op.resultFields.some(k => typeof row[k] === "string" && normalize(String(row[k])).includes(normalize(search)));
  });
  // Confirmation must compare the same detail representation before and after selection by name.
  if (search && detailPath && !idPattern.test(search)) return (await Promise.all(selected.slice(0, 20).map(async row =>
    projectQuotationRecords(op, await request(req, values, `/${detailPath}/${row.id}`))))).flat();
  return selected;
}

function pathFor(op: AssistantOperation, values: Values) {
  return op.path.slice("/quotation".length).replace(/:id\b/g, () => {
    if (!idPattern.test(String(values.path_id || ""))) throw new AssistantError("Chọn đúng một hồ sơ Báo giá theo tên hoặc mã hiển thị.");
    return encodeURIComponent(String(values.path_id));
  });
}
function privateRecord(values: Values): Row | undefined {
  try { return JSON.parse(String(values.__assistantQuotationRecord || "")); } catch { return undefined; }
}
export async function callQuotationOperation(req: AuthenticatedRequest, op: AssistantOperation, input: Values, requestId?: string): Promise<any> {
  branch(req, input);
  if (op.id === "quotation.quote.list" && !input.kind) {
    const results = await Promise.all(["customer", "estimate"].map(kind => callQuotationOperation(req, op, { ...input, kind })));
    return { quotes: results.flatMap(result => result.quotes) };
  }
  if (op.id === "quotation.template.list" && !input.category) {
    const results = await Promise.all(["quote", "estimate", "contract", "acceptance", "settlement"].map(category => callQuotationOperation(req, op, { ...input, category })));
    const templates = results.flatMap(result => result.templates);
    return { templates: templates.filter((row: Row, index: number) => templates.findIndex((other: Row) => String(other._id || other.id) === String(row._id || row.id)) === index) };
  }
  let path = pathFor(op, input);
  const query = new URLSearchParams();
  for (const field of op.fields.filter(f => f.source === "query" && f.key !== "targetBranch")) if (input[field.key] !== undefined && String(input[field.key]).trim()) query.set(field.apiKey || field.key, field.type === "boolean" ? input[field.key] ? "1" : "0" : String(input[field.key]));
  if (op.id === "quotation.quote.export" && input.excel === true && !input.templateId) query.set("templateId", "none");
  if (op.id === "quotation.catalog.list" && input.includeDeleted === "all") query.set("includeDeleted", "all");
  if (/^quotation\.(?:quote\.export|budget\.export|contract\.export|acceptance\.(?:export|settlement))$/.test(op.id)) query.set("background", "1");
  if (op.id === "quotation.quote.list" && input.search) query.set("page", String(input.page || 1));
  if (query.size) path += `?${query}`;
  const body: Row = {};
  for (const field of op.fields.filter(f => f.source === "body")) if (input[field.key] !== undefined) body[field.apiKey || field.key] = field.type === "json" ? JSON.parse(validateStructuredField(field, input[field.key])) : input[field.key];
  Object.assign(body, op.fixedBodyValues || {});
  const existing = privateRecord(input);
  if (op.id === "quotation.quote.export" && existing?.kind === "customer") {
    if (input.templateId && input.templateId !== existing.template?.id) throw new AssistantError("Báo giá khách dùng mẫu đã chọn lúc tạo. Hãy tải file đã lưu hoặc chỉnh mẫu tại màn hình Báo giá.");
    const latest = await request(req, input, `/generated-export-files/latest?kind=customer_quote&sourceId=${input.path_id}`);
    if (latest.file?.id && latest.job?.status === "completed") {
      if (input.excel === true && !String(latest.file.filename).toLowerCase().endsWith(".xlsx")) throw new AssistantError("File báo giá khách đang dùng mẫu Word/PDF. Hãy chọn mẫu Excel tại màn hình Báo giá để tạo đúng định dạng.");
      return request(req, input, `/files/${latest.file.id}/download`);
    }
    if (latest.job) return quotationRecord(latest);
    throw new AssistantError("Chưa có file báo giá khách đã lưu. Hãy yêu cầu thử tạo lại file báo giá.");
  }
  if (op.id === "quotation.quote.pdf" && existing?.kind !== "customer" && !String(existing?.template?.originalFilename || "").toLowerCase().endsWith(".pdf")) throw new AssistantError("Dự toán cần dùng mẫu PDF để xuất PDF. Hãy chọn mẫu PDF tại màn hình Báo giá, hoặc xuất file theo mẫu hiện tại.");
  const headers: Record<string, string> = {};
  if (!op.readOnly) {
    const seed = requestId || randomUUID();
    const key = createHash("sha256").update(`${req.user!.companyCode}|${branch(req, input)}|${req.user!.id}|${op.id}|${seed}`).digest("hex");
    headers["Idempotency-Key"] = key;
    body.idempotencyKey = key;
    if (op.fields.some(f => f.source === "path")) {
      if (!existing || !input.__assistantQuotationSnapshot) throw new AssistantError("Cần tra cứu hồ sơ và xác nhận thông tin hiện tại trước khi thực hiện.", 409);
      if (version(existing)) headers["If-Unmodified-Since"] = new Date(version(existing)).toISOString();
    }
  }
  if (op.id === "quotation.catalog.import") {
    const preview = await request(req, input, "/catalog/import/preview", "POST", { rows: body.rows }, {}, false);
    if (preview.invalidCount || preview.errors?.length) throw new AssistantError(`Bảng giá còn lỗi: ${(preview.errors || []).join(" ")}`);
    body.rows = preview.rows; body.confirmed = true;
  }
  if (op.id === "quotation.catalog.bulk") {
    const preview = JSON.parse(String(input.__assistantQuotationBulk || "null"));
    if (!preview?.previewHash || !Array.isArray(preview.selection)) throw new AssistantError("Cần xem trước từng sản phẩm và xác nhận trước khi cập nhật hàng loạt.", 409);
    body.selection = preview.selection; body.previewHash = preview.previewHash;
  }
  if (op.id === "quotation.customer-quote.create" && !body.items) {
    const suggested = JSON.parse(String(input.__assistantQuotationSuggested || "null"));
    if (!suggested || (!Array.isArray(suggested.items) && !Array.isArray(suggested.missingProducts))) throw new AssistantError("Cần chọn sản phẩm hoặc xem trước gợi ý AI trước khi lập báo giá.", 409);
    body.items = suggested.items || [];
    if (suggested.missingProducts?.length) body.missingProducts = suggested.missingProducts;
  }
  if (["quotation.customer-quote.create", "quotation.estimate.create"].includes(op.id) && Array.isArray(body.items)) {
    const catalogVersions = JSON.parse(String(input.__assistantQuotationCatalogVersions || "{}"));
    body.items = body.items.map((item: Row) => ({ ...item, ...(item.catalogUpdatedAt ? {} : catalogVersions[item.catalogItemId] ? { catalogUpdatedAt: catalogVersions[item.catalogItemId] } : {}) }));
  }
  if (["quotation.catalog.update", "quotation.catalog.duplicate"].includes(op.id)) {
    const changes = { ...body }; for (const f of operation("catalog.create").fields.filter(f => f.source === "body")) if (existing?.[f.key] !== undefined) body[f.key] = existing[f.key];
    Object.assign(body, changes);
    if (op.id.endsWith("duplicate")) { body.active = input.active === undefined ? false : input.active; body.sourceUpdatedAt = new Date(version(existing!)).toISOString(); }
  }
  if (["quotation.quote.update", "quotation.customer-quote.update", "quotation.estimate.update"].includes(op.id)) {
    const catalogLines = existing!.lines.filter((line: Row) => line.source !== "supplemental");
    if (body.items?.some((item: Row) => !catalogLines.some((line: Row) => line.catalogItemId === item.catalogItemId))) throw new AssistantError("Sản phẩm cần sửa không thuộc báo giá này. Hãy chọn đúng dòng hàng hiện có.");
    body.items = catalogLines.map((line: Row) => ({ catalogItemId: line.catalogItemId, quantity: line.quantity, unit: line.unit, attributes: line.attributes || {}, ...body.items?.find((item: Row) => item.catalogItemId === line.catalogItemId) }));
    if (body.supplementalProducts) {
      const supplements = existing!.lines.filter((line: Row) => line.source === "supplemental").map((line: Row) => ({ id: line.catalogItemId, informationField: line.supplementalFor, name: line.name, description: line.description || "", unit: line.unit, quantity: line.quantity, unitPrice: line.unitPrice }));
      for (const requested of body.supplementalProducts) {
        const sameName = supplements.filter((line: Row) => normalize(line.name) === normalize(requested.name));
        if (sameName.length > 1) throw new AssistantError("Có nhiều dòng sản phẩm bổ sung trùng tên. Hãy chỉnh dòng này ở màn hình Báo giá.");
        if (sameName.length) Object.assign(sameName[0], requested); else supplements.push(requested);
      }
      body.supplementalProducts = supplements;
    }
    if (body.additionalInformation) body.additionalInformation = { ...(existing!.additionalInformation || {}), ...body.additionalInformation };
    if (input.taxRate !== undefined) body.taxRateConfirmed = true;
    if (input.shippingFee !== undefined) body.shippingFeeConfirmed = true;
  }
  if (["quotation.contract.create", "quotation.acceptance.create"].includes(op.id)) {
    for (const field of op.fields.filter(f => f.source === "body" && !f.required && !f.reference && f.type !== "json")) if (body[field.key] === undefined) body[field.key] = field.type === "number" ? null : "";
  }
  if (["quotation.contract.update", "quotation.acceptance.update", "quotation.settings.update"].includes(op.id)) for (const field of op.fields.filter(f => f.source === "body")) if (body[field.key] === undefined && existing?.[field.key] !== undefined) body[field.key] = existing[field.key];
  const response = await request(req, input, path, op.method, op.method === "GET" || op.method === "DELETE" ? undefined : body, headers, !op.readOnly);
  if (op.id === "quotation.quote.pdf" && response.__assistantQuotationFile && response.__assistantQuotationFile.format !== "pdf") throw new AssistantError("File đã lưu đang dùng mẫu Word/Excel. Hãy chọn mẫu PDF tại màn hình Báo giá để tải đúng định dạng.");
  // Expose created identity to the shared completion hook; public rendering uses approved fields only.
  return quotationRecord(response);
}

export async function resolveQuotationReferences(req: AuthenticatedRequest, op: AssistantOperation, input: Values, lookup: Lookup, matches: Matches) {
  const values = { ...input };
  const labels: Record<string, string> = {};
  const errors: string[] = [];
  const unresolvedReferenceErrors: Record<string, string> = {};
  const confirmationDetails: Record<string, Array<{ label: string; value: string }>> = {};
  const fail = (key: string, message: string) => { errors.push(message); unresolvedReferenceErrors[key] = message; };
  const pin = (key: string, raw: Row) => {
    const snapshots = JSON.parse(String(values.__assistantQuotationReferences || "{}"));
    const current = snapshot(raw);
    if (snapshots[key] && snapshots[key] !== current) throw new AssistantError("Hồ sơ Báo giá đã thay đổi sau bản xem trước. Gửi lại yêu cầu để kiểm tra và xác nhận lại.", 409);
    snapshots[key] = current; values.__assistantQuotationReferences = JSON.stringify(snapshots);
  };
  if (req.user?.branchId && (!values.targetBranch || values.targetBranch === req.user.branchId)) { values.targetBranch = req.user.branchId; labels.targetBranch = "Chi nhánh của bạn"; }
  else if (values.targetBranch) {
    const selected = (await lookup(req, "branch.list", String(values.targetBranch))).filter(row => row.id === values.targetBranch || matches(row, String(values.targetBranch)));
    if (selected.length === 1) { values.targetBranch = String(selected[0].id); labels.targetBranch = String(selected[0].name); }
    else fail("targetBranch", "Chọn đúng một chi nhánh Báo giá theo tên.");
  }
  const candidates = async (field: AssistantField, search: string) => lookup(req, field.reference!, search, { targetBranch: values.targetBranch, ...field.referenceContext,
    ...(op.id === "quotation.quote.export" && field.key === "templateId" && privateRecord(values)?.kind === "customer" ? { category: "quote" } : {}) });
  const resolve = async (field: AssistantField, key: string, search: string) => {
    let selected = (await candidates(field, search)).filter(row => row.id === search || normalize(String(row.displayName)) === normalize(search) || matches(row, search));
    if (selected.length > 1 && field.reference === "quotation.catalog.list" && op.id !== "quotation.catalog.restore") {
      const currentOnly = selected.filter(row => isCatalogItemCurrent(row.__assistantQuotationRecord as unknown as Row));
      if (currentOnly.length === 1) selected = currentOnly;
    }
    if (selected.length !== 1) { fail(key, `${field.label}: ${selected.length ? "có nhiều kết quả trùng khớp, hãy chọn đúng hồ sơ" : "không tìm thấy trong chi nhánh được chọn"}.`); return; }
    const row = selected[0], raw = row.__assistantQuotationRecord as unknown as Row;
    if (!op.readOnly && raw) pin(key, raw);
    return { row, raw };
  };
  if (values.targetBranch && !unresolvedReferenceErrors.targetBranch) {
    branch(req, values);
    for (const field of op.fields.filter(f => f.reference && f.key !== "targetBranch")) {
      if (!values[field.key]) continue;
      const found = await resolve(field, field.key, String(values[field.key]));
      if (!found) continue;
      if (op.id === "quotation.estimate.create" && field.key === "requestId" && !found.raw.analyzedAt) {
        fail(field.key, "Yêu cầu này chưa được phân tích bằng AI. Hãy phân tích yêu cầu trước khi lập dự toán.");
        continue;
      }
      values[field.key] = String(found.row.id); labels[field.key] = String(found.row.displayName);
      if (field.source === "path") { values.__assistantQuotationRecord = JSON.stringify(found.raw); values.__assistantQuotationSnapshot = snapshot(found.raw); }
    }
    const catalogVersions: Record<string, string> = JSON.parse(String(values.__assistantQuotationCatalogVersions || "{}"));
    for (const field of op.fields.filter(f => f.type === "json" && f.structure?.type === "array" && f.structure.items?.keys?.catalogItemId?.reference)) {
      if (typeof values[field.key] !== "string") continue;
      let items: Row[]; try { items = JSON.parse(String(values[field.key])); } catch { continue; }
      if (!Array.isArray(items)) continue;
      const itemLabels: string[] = [];
      const deduplicatedItems: Row[] = [];
      const seenCatalogIds = new Set<string>();
      const currencies = new Set<string>();
      for (const [index, item] of items.entries()) {
        if (!item || typeof item.catalogItemId !== "string") continue;
        const reference: AssistantField = { key: field.key, label: `Sản phẩm dòng ${index + 1}`, type: "reference", reference: "quotation.catalog.list" };
        const found = await resolve(reference, `${field.key}.${index}`, item.catalogItemId);
        if (!found) {
          unresolvedReferenceErrors[field.key] = unresolvedReferenceErrors[`${field.key}.${index}`];
          continue;
        }
        if (!isCatalogItemCurrent(found.raw)) { fail(field.key, `Sản phẩm ${found.raw.sku} không còn áp dụng.`); continue; }
        if (op.id === "quotation.customer-quote.create" && item.quantity !== undefined && item.quantity !== 1) { fail(field.key, "Báo giá khách hàng lưu danh sách sản phẩm; khối lượng được lập ở bước dự toán. Hãy lập dự toán từ báo giá để ghi số lượng này."); continue; }
        const resolvedId = String(found.row.id);
        if (seenCatalogIds.has(resolvedId)) continue;
        seenCatalogIds.add(resolvedId);
        if (found.raw.currency) currencies.add(String(found.raw.currency));
        item.catalogItemId = resolvedId; item.unit = found.raw.unit; item.quantity ??= 1;
        if (version(found.raw)) catalogVersions[item.catalogItemId] = new Date(version(found.raw)).toISOString();
        deduplicatedItems.push(item);
        itemLabels.push(`${found.raw.sku} — ${found.raw.name}${op.id === "quotation.customer-quote.create" ? "" : ` × ${item.quantity} ${found.raw.unit}`}`);
      }
      if (currencies.size > 1 && ["quotation.customer-quote.create", "quotation.estimate.create"].includes(op.id)) {
        fail(field.key, "Các sản phẩm trong một báo giá phải cùng tiền tệ.");
      }
      values[field.key] = JSON.stringify(deduplicatedItems); labels[field.key] = itemLabels.join("; ");
    }
    if (op.id === "quotation.customer-quote.create" && !values.items && typeof values.sourceRequirements === "string" && values.sourceRequirements.trim()) {
      const prompt = values.sourceRequirements.trim();
      if (prompt.length > 3000) fail("sourceRequirements", "Yêu cầu khách hàng để AI gợi ý sản phẩm tối đa 3.000 ký tự.");
      else {
        let suggested = values.__assistantQuotationSuggested ? JSON.parse(String(values.__assistantQuotationSuggested)) : null;
        if (!suggested || suggested.prompt !== prompt) {
          const res = await request(req, values, "/customer-quotes/suggest", "POST", { prompt }, {}, false);
          const missingProducts = Array.isArray(res?.missingProducts)
            ? [...new Set(res.missingProducts.map((p: unknown) => String(p || "").trim().slice(0, 120)).filter(Boolean))].slice(0, 30)
            : [];
          suggested = { prompt, items: Array.isArray(res?.items) ? res.items : [], missingProducts };
        }
        const resolvedItems: Row[] = [], itemLabels: string[] = [];
        const seenCatalogIds = new Set<string>();
        let primaryCurrency = "";
        for (const [index, item] of (suggested.items as Row[]).entries()) {
          if (!item || typeof item.catalogItemId !== "string") continue;
          const found = await resolve({ key: "sourceRequirements", label: `Sản phẩm gợi ý ${index + 1}`, type: "reference", reference: "quotation.catalog.list" }, `sourceRequirements.${index}`, item.catalogItemId);
          if (!found) continue;
          if (!isCatalogItemCurrent(found.raw)) continue;
          const resolvedId = String(found.row.id);
          if (seenCatalogIds.has(resolvedId)) continue;
          const itemCurrency = String(found.raw.currency || "");
          if (primaryCurrency && itemCurrency && itemCurrency !== primaryCurrency) continue;
          if (!primaryCurrency && itemCurrency) primaryCurrency = itemCurrency;
          seenCatalogIds.add(resolvedId);
          const catalogUpdatedAt = version(found.raw) ? new Date(version(found.raw)).toISOString() : undefined;
          if (catalogUpdatedAt) catalogVersions[resolvedId] = catalogUpdatedAt;
          resolvedItems.push({ catalogItemId: resolvedId, unit: found.raw.unit, quantity: 1, ...(catalogUpdatedAt ? { catalogUpdatedAt } : {}) });
          itemLabels.push(`${found.raw.sku} — ${found.raw.name}`);
        }
        if (!unresolvedReferenceErrors.sourceRequirements && !resolvedItems.length && !suggested.missingProducts.length) {
          fail("sourceRequirements", "AI chưa tìm thấy sản phẩm phù hợp trong bảng giá từ yêu cầu này. Hãy mô tả cụ thể hơn hoặc chọn trực tiếp sản phẩm từ bảng giá.");
        } else if (!unresolvedReferenceErrors.sourceRequirements) {
          values.__assistantQuotationSuggested = JSON.stringify({ prompt, items: resolvedItems, missingProducts: suggested.missingProducts });
          confirmationDetails.sourceRequirements = [
            ...(itemLabels.length ? [{ label: "Sản phẩm AI gợi ý", value: itemLabels.join("; ") }] : []),
            ...(suggested.missingProducts.length ? [{ label: "Chưa có trong bảng giá", value: suggested.missingProducts.join("; ") }] : []),
          ];
        }
      }
    }
    if (Object.keys(catalogVersions).length) values.__assistantQuotationCatalogVersions = JSON.stringify(catalogVersions);
    if (op.id === "quotation.catalog.bulk" && typeof values.selection === "string") {
      const names = JSON.parse(values.selection);
      if (!Array.isArray(names) || names.length < 1 || names.length > 100) throw new AssistantError("Chọn rõ từ 1 đến 100 sản phẩm để cập nhật hàng loạt.");
      const selection: Array<{ id: string; updatedAt: string }> = [];
      for (const [index, name] of names.entries()) {
        const found = await resolve({ key: "selection", label: `Sản phẩm ${index + 1}`, type: "reference", reference: "quotation.catalog.list" }, `selection.${index}`, String(name));
        if (found) selection.push({ id: String(found.row.id), updatedAt: new Date(version(found.raw)).toISOString() });
      }
      if (!errors.length && selection.length === names.length) {
        if (new Set(selection.map(item => item.id)).size !== selection.length) throw new AssistantError("Danh sách sản phẩm bị lặp. Hãy chọn mỗi sản phẩm một lần.");
        const preview = await request(req, values, "/catalog/bulk/preview", "POST", { action: values.action, selection, ...(values.adjustment ? { adjustment: JSON.parse(String(values.adjustment)) } : {}) }, {}, false);
        const old = values.__assistantQuotationBulk ? JSON.parse(String(values.__assistantQuotationBulk)) : null;
        if (old && old.previewHash !== preview.previewHash) throw new AssistantError("Nội dung cập nhật hàng loạt đã thay đổi. Hãy xem lại rồi xác nhận.", 409);
        values.__assistantQuotationBulk = JSON.stringify({ selection, previewHash: preview.previewHash });
        values.selection = JSON.stringify(selection.map(item => item.id));
        labels.selection = preview.rows.map((row: Row) => `${row.sku} — ${row.name}`).join("; ");
        const actionLabels: Record<string, string> = { activate: "Áp dụng", deactivate: "Ngừng áp dụng", delete: "Xóa", restore: "Khôi phục" };
        confirmationDetails.selection = preview.rows.map((row: Row) => ({ label: `${row.sku} — ${row.name}`, value: values.action === "price" ? `${Number(row.before.price).toLocaleString("vi-VN")} → ${Number(row.after.price).toLocaleString("vi-VN")} ${row.currency}` : actionLabels[String(values.action)] || String(values.action) }));
      }
    }
    if (op.id === "quotation.export.latest" && values.sourceId && values.kind) {
      const entity = values.kind === "contract" ? "contract" : ["acceptance", "settlement"].includes(String(values.kind)) ? "acceptance" : values.kind === "budget" ? "budget" : "quote";
      const found = await resolve({ key: "sourceId", label: "Chứng từ nguồn", type: "reference", reference: `quotation.${entity}.list` }, "sourceId", String(values.sourceId));
      if (found) { values.sourceId = String(found.row.id); labels.sourceId = String(found.row.displayName); }
    }
    if (op.id === "quotation.settings.update") {
      const existing = quotationRecord(await request(req, values, "/settings")); pin("settings", existing);
      values.__assistantQuotationRecord = JSON.stringify(existing);
    }
    if (op.id === "quotation.catalog.import" && typeof values.rows === "string") {
      const preview = await request(req, values, "/catalog/import/preview", "POST", { rows: JSON.parse(values.rows) }, {}, false);
      if (preview.invalidCount || preview.errors?.length) fail("rows", `Bảng giá còn lỗi: ${(preview.errors || []).join(" ")}`);
      else {
        values.rows = JSON.stringify(preview.rows); labels.rows = `${preview.validCount} dòng hợp lệ`;
        confirmationDetails.rows = preview.rows.map((row: Row) => ({ label: `${row.sku} — ${row.name}`, value: `${Number(row.price).toLocaleString("vi-VN")} ${row.currency}/${row.unit}` }));
      }
    }
  }
  return { values, labels, errors, confirmationDetails, unresolvedReferenceKeys: Object.keys(unresolvedReferenceErrors), unresolvedReferenceErrors };
}

export async function suggestQuotationReferences(req: AuthenticatedRequest, op: AssistantOperation, field: AssistantField, values: Values, lookup: Lookup) {
  if (field.key === "targetBranch") return (await lookup(req, "branch.list")).map(row => String(row.name || row.code)).slice(0, 8);
  if (!values.targetBranch && !req.user?.branchId) return [];
  const rows = await lookup(req, field.reference!, "", { targetBranch: values.targetBranch || req.user!.branchId || "", ...field.referenceContext });
  const filtered = rows.filter(row => {
    const raw = (row as any).__assistantQuotationRecord as Row | undefined;
    if (field.reference === "quotation.catalog.list") {
      if (op.id === "quotation.catalog.restore") return Boolean(raw?.deletedAt);
      if (op.id === "quotation.catalog.update" || op.id === "quotation.catalog.duplicate" || op.id === "quotation.catalog.delete" || op.id === "quotation.catalog.bulk") return !raw?.deletedAt;
      return isCatalogItemCurrent(raw);
    }
    if (op.id === "quotation.estimate.create" && field.key === "requestId") return Boolean(raw?.analyzedAt);
    return true;
  });
  const limit = field.key === "items" || field.key === "selection" ? 20 : 8;
  return filtered.slice(0, limit).map(row => String(row.displayName));
}

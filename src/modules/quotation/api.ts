import { parseApiErrorResponse } from "../../services/apiClientError";
import { refreshAccessToken } from "../../services/sessionRefresh";
import type { User } from "./types";
import { userMessage } from "./user-message";
import { aiProgress, aiRequestDescription, exportTaskDescription, type AiTaskHandle } from "./ai-progress";

export class ApiError extends Error { constructor(message: string, readonly status: number) { super(userMessage(message)); } }
async function quotationApiError(response: Response) { const error = await parseApiErrorResponse(response); return Object.assign(new ApiError(error.message, error.status), { code: error.code, requestId: error.requestId, details: error.details }); }
const revisions = new Map<string, string>();
type Scope = { user: User; companyCode: string; branchId: string; capabilities: string[]; modules?: string[]; controller: AbortController };
let activeScope: Scope | null = null;
export function configureQuotationClient(value: Omit<Scope, "controller">) {
  resetAiProgressTracking();
  revisions.clear();
  activeScope?.controller.abort();
  const scope: Scope = { ...value, controller: new AbortController() };
  activeScope = scope;
  return () => { scope.controller.abort(); if (activeScope === scope) { resetAiProgressTracking(); activeScope = null; } };
}
function currentScope() { if (!activeScope) throw new ApiError("Phiên Báo giá chưa sẵn sàng. Vui lòng mở lại phân hệ.", 401); return activeScope; }
export function quotationClientUser() { return currentScope().user; }
export function hasQuotationCapability(code: string) {
  const permissions = activeScope?.capabilities || [];
  return permissions.includes("*") || permissions.includes(code) || (code.endsWith(":read") && permissions.includes(code.replace(/:read$/, ":manage")));
}
export function canUseErpCustomers() { return Boolean(activeScope?.modules?.includes("customer")) && hasQuotationCapability("customer:read"); }
export function quotationEndpoint(value: string) {
  const url = new URL(value, window.location.origin);
  if (url.origin !== window.location.origin || !/^\/api(?:\/|$)/.test(url.pathname)) throw new ApiError("Đường dẫn Báo giá không hợp lệ.", 400);
  if (!url.pathname.startsWith("/api/v1/quotation/")) url.pathname = url.pathname.replace(/^\/api/, "/api/v1/quotation");
  return `${url.pathname}${url.search}`;
}
function scopedEndpoint(value: string, scope: Scope) {
  const url = new URL(quotationEndpoint(value), window.location.origin);
  url.searchParams.set("companyCode", scope.companyCode);
  return `${url.pathname}${url.search}`;
}
function rememberRevisions(payload: unknown, canonical: string) {
  const base = "/api/v1/quotation/";
  const remember = (value: unknown, collection: string) => {
    if (!value || typeof value !== "object") return;
    const row = value as { _id?: string; id?: string; updatedAt?: string };
    const id = row._id || row.id;
    if (id && typeof row.updatedAt === "string" && Number.isFinite(Date.parse(row.updatedAt))) revisions.set(`${base}${collection}/${id}`, row.updatedAt);
  };
  if (!payload || typeof payload !== "object") return;
  const result = payload as Record<string, unknown>;
  const collection = /^\/api\/v1\/quotation\/(quotes|contracts|acceptance-records|budget-plans|catalog)(?:\/|$)/.exec(canonical)?.[1];
  if (collection) remember(result, collection);
  for (const [key, target] of Object.entries({ quote: "quotes", contract: "contracts", record: "acceptance-records", acceptanceRecord: "acceptance-records", plan: "budget-plans", item: "catalog", quotes: "quotes", contracts: "contracts", records: "acceptance-records", plans: "budget-plans", items: "catalog" })) {
    const value = result[key];
    if (Array.isArray(value)) value.forEach(row => remember(row, target));
    else remember(value, target);
  }
}
export async function quotationFetch(input: RequestInfo | URL, options: RequestInit = {}) {
  const scope = currentScope();
  const url = scopedEndpoint(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, scope);
  const headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
  const token = localStorage.getItem("accessToken");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("x-branch-id", scope.branchId);
  headers.delete("x-company-code");
  const signals = [scope.controller.signal, options.signal].filter((value): value is AbortSignal => Boolean(value));
  const signal = signals.length > 1 ? AbortSignal.any(signals) : signals[0];
  let response: Response;
  try { response = await globalThis.fetch(url, { ...options, headers, signal }); }
  catch (cause) {
    if (signal?.aborted || (cause instanceof Error && cause.name === "AbortError")) throw cause;
    throw new ApiError(userMessage(cause), 0);
  }
  if (activeScope !== scope || signal?.aborted) throw new DOMException("Phạm vi làm việc đã thay đổi.", "AbortError");
  return response;
}
export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  if (url === "/api/auth/me") return { user: quotationClientUser() } as T;
  const clientUrl = quotationEndpoint(url).replace(/^\/api\/v1\/quotation/, "/api");
  const description = aiRequestDescription(clientUrl, options.method?.toUpperCase() ?? "GET", options.body);
  const task = description ? backgroundExports.get(description.key ?? "")?.task ?? aiProgress.begin(description) : undefined;
  try {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !(options.body instanceof Blob) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const canonical = quotationEndpoint(url).split("?")[0];
  if (["PATCH", "DELETE", "POST"].includes((options.method || "").toUpperCase()) && !headers.has("If-Unmodified-Since") && revisions.has(canonical.replace(/\/(?:approve|reject|submit-review|sign|complete)$/, ""))) headers.set("If-Unmodified-Since", revisions.get(canonical.replace(/\/(?:approve|reject|submit-review|sign|complete)$/, ""))!);
  const response = await quotationFetch(url, { ...options, headers });
  if (!response.ok) throw await quotationApiError(response);
  if (response.status === 204) { task?.complete(); return undefined as T; }
  const payload = await response.json();
  if (task && (!payload || typeof payload !== "object" || Array.isArray(payload))) throw new ApiError("Chưa nhận được kết quả xử lý. Vui lòng thử lại.", response.status);
  rememberRevisions(payload, canonical);
  if (task && new URL(clientUrl, window.location.origin).pathname === "/api/customer-quotes") {
    if (typeof payload.quote?._id !== "string" || !payload.quote._id) throw new ApiError("Chưa nhận được báo giá đã tạo. Vui lòng thử lại.", response.status);
    watchCustomerQuoteExport(payload.quote._id, task);
  } else if (task && /\/quotes\/([^/]+)\/export\/retry(?:\?|$)/.test(clientUrl)) {
    if (!payload.jobId) throw new ApiError("Chưa thể bắt đầu tạo file. Vui lòng thử lại.", response.status);
    watchCustomerQuoteExport(/\/quotes\/([^/]+)\//.exec(clientUrl)![1], task);
  } else task?.complete();
  return payload as T;
  } catch (error) { task?.fail(error); throw error; }
}
export type GeneratedFileRef = { id: string; filename: string; mimeType?: string; createdAt?: string };
export type GeneratedExportStatus = { id: string; status: "queued" | "running" | "completed" | "failed"; error?: string; filename?: string; createdAt?: string; updatedAt?: string };
export async function createGeneratedExport(url: string, timeoutMs = 15 * 60_000): Promise<GeneratedFileRef> {
  const scope = currentScope();
  const task = aiProgress.begin({ ...exportTaskDescription(quotationEndpoint(url).replace(/^\/api\/v1\/quotation/, "/api")), detail: "Đang chuẩn bị nội dung và mẫu tài liệu…" });
  try {
  const response = await quotationFetch(url);
  if (!response.ok) throw await parseApiErrorResponse(response);
  const queued = await response.json();
  if (response.status !== 202 || !queued.jobId) throw new ApiError("Máy chủ chưa trả tác vụ xuất tài liệu.", response.status);
  task.update(12, "Yêu cầu đã được tiếp nhận, đang chuẩn bị tạo file…");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise<void>((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); reject(new DOMException("Phạm vi làm việc đã thay đổi.", "AbortError")); };
      const timer = setTimeout(() => { scope.controller.signal.removeEventListener("abort", cancel); resolve(); }, 2000);
      scope.controller.signal.addEventListener("abort", cancel, { once: true });
      if (scope.controller.signal.aborted) cancel();
    });
    const { job } = await api<{ job: GeneratedExportStatus & { fileId?: string } }>(`/api/export-jobs/${queued.jobId}`);
    if (job.status === "failed") throw new ApiError(job.error || "Không tạo được tài liệu. Bạn có thể kiểm tra và thử lại.", 422);
    if (job.status === "running") task.update(30, "AI đang điền nội dung và hoàn thiện file theo mẫu…");
    if (job.status === "completed") {
      if (!job.fileId) throw new ApiError("File chưa sẵn sàng để tải. Vui lòng kiểm tra lại.", 422);
      task.complete();
      return { id: job.fileId, filename: job.filename || "tai-lieu" };
    }
  }
  throw new ApiError("Tác vụ vẫn đang xử lý. Mở lại chứng từ để xem kết quả sau.", 408);
  } catch (error) { task.fail(error); throw error; }
}
const backgroundExports = new Map<string, { controller: AbortController; task: AiTaskHandle }>();

/** Customer quote creation returns before its AI export; keep the popup alive through the saved result. */
function watchCustomerQuoteExport(sourceId: string, initialTask?: AiTaskHandle) {
  const key = `export:customer_quote:${sourceId}`;
  if (backgroundExports.has(key)) return;
  const task = initialTask ?? aiProgress.begin({ key, label: "Đang tạo file báo giá khách" });
  const controller = new AbortController();
  const watcher = { controller, task };
  backgroundExports.set(key, watcher);
  void (async () => {
    const deadline = Date.now() + 15 * 60_000;
    try {
      while (!controller.signal.aborted && Date.now() < deadline) {
        const response = await quotationFetch(`/api/generated-export-files/latest?sourceId=${encodeURIComponent(sourceId)}&kind=customer_quote`, { signal: controller.signal });
        const result = await response.json().catch(() => null) as { error?: string; file?: GeneratedFileRef; job?: GeneratedExportStatus } | null;
        if (!response.ok || !result) throw new Error(userMessage(result?.error, "Chưa kiểm tra được tiến độ tạo file."));
        if (result.job?.status === "failed") throw new Error(userMessage(result.job.error, "Chưa tạo được file báo giá. Vui lòng thử lại."));
        if (result.file?.id && (!result.job || result.job.status === "completed")) { task.complete(); return; }
        if (result.job?.status === "completed") throw new Error("File chưa sẵn sàng để tải. Vui lòng thử lại sau.");
        task.update(result.job?.status === "running" ? 30 : 12, result.job?.status === "running" ? "AI đang điền nội dung và hoàn thiện file theo mẫu…" : "Yêu cầu đã được tiếp nhận, đang chuẩn bị tạo file…");
        await new Promise<void>((resolve) => {
          const finish = () => { globalThis.clearTimeout(timer); controller.signal.removeEventListener("abort", finish); resolve(); };
          const timer = globalThis.setTimeout(finish, 2_000);
          controller.signal.addEventListener("abort", finish, { once: true });
          if (controller.signal.aborted) finish();
        });
      }
      if (!controller.signal.aborted) throw new Error("Tác vụ vẫn đang xử lý. Bạn có thể kiểm tra lại sau ít phút.");
    } catch (error) { if (!controller.signal.aborted) task.fail(error); }
    finally { if (backgroundExports.get(key) === watcher) backgroundExports.delete(key); }
  })();
}

export function resetAiProgressTracking() {
  backgroundExports.forEach(({ controller }) => controller.abort());
  backgroundExports.clear();
  aiProgress.reset();
}


export async function getLatestGeneratedFile(sourceId: string, kind: string) {
  const result = await api<{ file: GeneratedFileRef | null; job: GeneratedExportStatus | null }>(`/api/generated-export-files/latest?${new URLSearchParams({ sourceId, kind })}`);
  if (result.job?.error) result.job.error = userMessage(result.job.error);
  if (kind === "customer_quote" && (result.job?.status === "queued" || result.job?.status === "running")) watchCustomerQuoteExport(sourceId);
  return result;
}
export async function downloadGeneratedFile(fileId: string) {
  return downloadQuotationFile(`/api/files/${encodeURIComponent(fileId)}/download`);
}
export async function downloadQuotationFile(path: string, fallbackName = "tai-lieu") {
  const response = await quotationFetch(path);
  if (!response.ok) throw await parseApiErrorResponse(response);
  const disposition = response.headers.get("Content-Disposition") || "";
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const filename = encoded ? decodeURIComponent(encoded) : /filename="([^"]+)"/i.exec(disposition)?.[1] || fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function apiUploadWithProgress<T>(url: string, file: Blob, headers: Record<string, string>, onProgress: (percentage: number) => void): Promise<T> {
  const scope = currentScope();
  const clientUrl = quotationEndpoint(url).replace(/^\/api\/v1\/quotation/, "/api");
  const path = new URL(clientUrl, window.location.origin).pathname;
  const description = aiRequestDescription(clientUrl, "POST") ?? (path === "/api/quote-template" ? { label: "Đang tải và kiểm tra mẫu tài liệu" } : path === "/api/request-files" ? { label: "Đang tải file yêu cầu" } : path === "/api/price-list/preview" ? { label: "Đang đọc bảng giá" } : null);
  const task = description ? aiProgress.begin({ ...description, detail: "Đang gửi file lên…" }) : undefined;
  try {
  const send = () => new Promise<{ status: number; body: Record<string, unknown> | undefined }>((resolve, reject) => {
    const request = new XMLHttpRequest(); request.open("POST", scopedEndpoint(url, scope));
    const token = localStorage.getItem("accessToken"); if (token) request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.setRequestHeader("x-branch-id", scope.branchId);
    Object.entries(headers).forEach(([key, value]) => request.setRequestHeader(key, value));
    const abort = () => request.abort(); scope.controller.signal.addEventListener("abort", abort, { once: true });
    const cleanup = () => scope.controller.signal.removeEventListener("abort", abort);
    request.upload.addEventListener("progress", event => { if (event.lengthComputable && event.total > 0) {
      const progress = Math.min(100, Math.round(event.loaded * 100 / event.total));
      onProgress(progress);
      task?.update(Math.round(progress * .35), progress < 100 ? `Đang gửi file lên (${progress}%)…` : "Đang đọc, xử lý và lưu nội dung file…");
    } });
    request.upload.addEventListener("load", () => task?.update(35, "Đang đọc, xử lý và lưu nội dung file…"));
    request.addEventListener("error", () => { cleanup(); reject(new ApiError("Không kết nối được máy chủ khi tải file.", 0)); });
    request.addEventListener("abort", () => { cleanup(); reject(new DOMException("Đã hủy tải file.", "AbortError")); });
    request.addEventListener("timeout", () => { cleanup(); reject(new ApiError("Xử lý lâu hơn dự kiến. Vui lòng thử lại.", 0)); });
    request.addEventListener("load", () => { cleanup(); let body; try { body = JSON.parse(request.responseText); } catch { body = undefined; } resolve({ status: request.status, body }); });
    if (scope.controller.signal.aborted || activeScope !== scope) return reject(new DOMException("Phạm vi làm việc đã thay đổi.", "AbortError"));
    request.send(file);
  });
  let result = await send();
  if (result.status === 401) {
    const token = await refreshAccessToken();
    if (!token || activeScope !== scope || scope.controller.signal.aborted) throw new ApiError("Phiên làm việc đã hết hạn.", 401);
    result = await send(); // The first 401 is rejected before parsing/mutating the upload.
  }
  if (result.status < 200 || result.status >= 300) {
    if (result.status >= 200 && result.status <= 599) throw await quotationApiError(Response.json(result.body || {}, { status: result.status }));
    throw new ApiError("Không tải được file.", result.status);
  }
  if (task && !result.body && result.status !== 204) throw new ApiError("Chưa nhận được kết quả xử lý file. Vui lòng thử lại.", result.status);
  task?.complete();
  return result.body as T;
  } catch (error) { task?.fail(error); throw error; }
}
export async function responseBlobWithProgress(response: Response, onProgress: (percentage: number | null) => void) {
  const encoded = response.headers.get("content-encoding");
  const rawLength = Number(response.headers.get("content-length"));
  const total = !encoded && Number.isFinite(rawLength) && rawLength > 0 ? rawLength : null;
  if (!response.body) {
    onProgress(null);
    return response.blob();
  }
  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let loaded = 0;
  onProgress(total ? 0 : null);
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      const chunk = new Uint8Array(value.byteLength);
      chunk.set(value);
      chunks.push(chunk.buffer);
      loaded += value.byteLength;
      onProgress(total ? Math.min(100, Math.round(loaded / total * 100)) : null);
    }
  }
  if (total) onProgress(100);
  return new Blob(chunks, { type: response.headers.get("content-type") ?? "application/octet-stream" });
}

export function formatMoney(amount: number, currency: string) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
export function formatDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)); }

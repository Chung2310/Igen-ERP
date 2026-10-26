import type { RetailScope } from "../types";
import { ApiClientError } from "../../../services/apiClientError";
export type DraftCreationRequest = { idempotencyKey: string; input: Record<string, unknown>; editable?: boolean };
export type DraftUpdateRequest = DraftCreationRequest & { orderId: string };
export class RetailCheckoutLockBusyError extends Error {
  constructor() {
    super("POS đang xử lý giao dịch ở tab khác. Hãy thử lại sau.");
    this.name = "RetailCheckoutLockBusyError";
  }
}
export const draftRequestStorageKey = (scope: RetailScope, userId: string, orderId?: string) => orderId
  ? `retail-update-draft:v1:${JSON.stringify([scope.companyCode, scope.branchId, userId, orderId])}`
  : `retail-create-draft:v1:${JSON.stringify([scope.companyCode, scope.branchId, userId])}`;
const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;

function parse(raw: string | null): DraftCreationRequest | null {
  if (raw === null) return null;
  const row = JSON.parse(raw);
  if (!row || typeof row.idempotencyKey !== "string" || !row.idempotencyKey.trim() || !row.input || typeof row.input !== "object" || Array.isArray(row.input) || (row.editable !== undefined && typeof row.editable !== "boolean")) throw new Error("Yêu cầu nháp đã lưu bị lỗi. Cần đối chiếu trước khi tiếp tục.");
  return row;
}
const same = (a: DraftCreationRequest, b: DraftCreationRequest) => a.idempotencyKey === b.idempotencyKey && JSON.stringify(canonical(a.input)) === JSON.stringify(canonical(b.input));
export function readDraftRequest(scope: RetailScope, userId: string, orderId?: string) {
  if (!scope.companyCode || !scope.branchId || !userId) throw new Error("Thiếu phạm vi tài khoản/chi nhánh tạo đơn.");
  const key = draftRequestStorageKey(scope, userId, orderId);
  const shared = parse(localStorage.getItem(key)), legacy = parse(sessionStorage.getItem(key));
  if (shared && legacy && !same(shared, legacy)) throw new Error("Yêu cầu nháp ở tab cũ khác bản lưu chung. Giữ cả hai để đối chiếu.");
  // A legacy editable marker must not unlock a shared uncertain attempt.
  return shared || legacy;
}
function persist(scope: RetailScope, userId: string, request: DraftCreationRequest, orderId?: string) {
  const key = draftRequestStorageKey(scope, userId, orderId);
  const valid = parse(JSON.stringify(request))!;
  localStorage.setItem(key, JSON.stringify(valid));
  const stored = parse(localStorage.getItem(key));
  if (!stored || !same(stored, valid) || stored.editable !== valid.editable) throw new Error("Không lưu được nguyên yêu cầu nháp. Chưa gửi yêu cầu.");
  sessionStorage.removeItem(key);
}
/** All callers hold this lock through preparation, network, queue persistence and cleanup. */
export async function withDraftRequestLock<T>(scope: RetailScope, userId: string, work: () => Promise<T>): Promise<T> {
  if (!scope.companyCode || !scope.branchId || !userId) throw new Error("Thiếu phạm vi tài khoản/chi nhánh tạo đơn.");
  if (!navigator.locks?.request) throw new Error("Không khóa được thao tác giữa các tab. Cần trình duyệt hỗ trợ và kết nối HTTPS.");
  return navigator.locks.request(draftRequestStorageKey(scope, userId) + ":lock", { mode: "exclusive", ifAvailable: true }, async lock => {
    if (!lock) throw new RetailCheckoutLockBusyError();
    return work();
  });
}
// The POS also uses this same scoped lock to serialize checkout requests.
export const withRetailCheckoutLock = withDraftRequestLock;

export function prepareDraftCreation(scope: RetailScope, userId: string, input: object, orderId?: string): DraftCreationRequest {
  const saved = readDraftRequest(scope, userId, orderId);
  if (saved && !saved.editable && JSON.stringify(canonical(saved.input)) !== JSON.stringify(canonical(input))) throw new Error("Có yêu cầu tạo nháp chưa rõ kết quả với nội dung khác. Vui lòng khôi phục đơn gốc trước khi tạo đơn mới.");
  const request = JSON.parse(JSON.stringify({ idempotencyKey: saved?.idempotencyKey || crypto.randomUUID(), input })) as DraftCreationRequest;
  persist(scope, userId, request, orderId);
  return request;
}
export function prepareDraftUpdate(scope: RetailScope, userId: string, orderId: string, input: object): DraftUpdateRequest {
  return { ...prepareDraftCreation(scope, userId, input, orderId), orderId };
}
/** Adopt an offline request without replacing a different shared or legacy record. */
export function retainDraftRequest(scope: RetailScope, userId: string, request: DraftCreationRequest, orderId?: string) {
  const saved = readDraftRequest(scope, userId, orderId);
  if (saved && !same(saved, request)) throw new Error("Yêu cầu offline khác bản nháp đang lưu. Cần đối chiếu cả hai.");
  persist(scope, userId, { idempotencyKey: request.idempotencyKey, input: request.input }, orderId);
}
export function allowRejectedDraftEdit(scope: RetailScope, userId: string, request: DraftCreationRequest, error: unknown, orderId?: string) {
  if (!(error instanceof ApiClientError) || error.status !== 400 || error.code === "UNKNOWN_API_ERROR") return;
  try {
    const saved = readDraftRequest(scope, userId, orderId);
    if (saved && same(saved, request)) persist(scope, userId, { ...saved, editable: true }, orderId);
  } catch { /* preserve the original request */ }
}
export function clearDraftCreation(scope: RetailScope, userId: string, request: DraftCreationRequest, orderId?: string) {
  const key = draftRequestStorageKey(scope, userId, orderId);
  // Remove only exact matches, including when the other store has a different request.
  for (const storage of [sessionStorage, localStorage]) {
    const saved = parse(storage.getItem(key));
    if (saved && same(saved, request)) storage.removeItem(key);
  }
}
export function draftRequestCandidates(scope: RetailScope, userId: string, orderId?: string) {
  if (!scope.companyCode || !scope.branchId || !userId) throw new Error("Thiếu phạm vi tài khoản/chi nhánh tạo đơn.");
  const key = draftRequestStorageKey(scope, userId, orderId);
  const shared = parse(localStorage.getItem(key)), legacy = parse(sessionStorage.getItem(key));
  if (shared && legacy && !same(shared, legacy)) return [{ request: shared, source: "shared" as const, conflict: true }, { request: legacy, source: "legacy" as const, conflict: true }];
  return shared ? [{ request: shared, source: "shared" as const, conflict: false }] : legacy ? [{ request: legacy, source: "legacy" as const, conflict: false }] : [];
}
export function hasDraftCandidate(scope: RetailScope, userId: string, request: DraftCreationRequest, orderId?: string) {
  return draftRequestCandidates(scope, userId, orderId).some(row => same(row.request, request));
}
export function listDraftRequests(scope: RetailScope, userId: string) {
  const orders = new Set<string | undefined>();
  for (const storage of [localStorage, sessionStorage]) for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)!;
    if (key === draftRequestStorageKey(scope, userId)) orders.add(undefined);
    if (key.startsWith("retail-update-draft:v1:")) {
      const parts = JSON.parse(key.slice("retail-update-draft:v1:".length));
      if (Array.isArray(parts) && parts.length === 4 && parts[0] === scope.companyCode && parts[1] === scope.branchId && parts[2] === userId && typeof parts[3] === "string" && parts[3]) orders.add(parts[3]);
    }
  }
  return [...orders].flatMap(orderId => draftRequestCandidates(scope, userId, orderId).map(row => ({ orderId, ...row })));
}

export function verifyDraftResult(order: { _id?: string; version?: number } | null | undefined, orderId?: string) {
  if (!order || typeof order._id !== "string" || !order._id || !Number.isSafeInteger(order.version) || order.version! < 0 || (orderId && order._id !== orderId)) throw new Error("Phản hồi bản nháp không khớp. Giữ yêu cầu để đối chiếu.");
}

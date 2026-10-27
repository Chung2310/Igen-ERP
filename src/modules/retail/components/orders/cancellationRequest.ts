import type { RetailPaymentInput } from "../../types";

export type PendingCancellation = { cashSessionId?: string; reason: string; refunds: RetailPaymentInput[]; idempotencyKey: string; expectedVersion: number };
function parse(raw: string | null): PendingCancellation | null {
  if (raw === null) return null;
  const row = JSON.parse(raw);
  if (!row || typeof row.idempotencyKey !== "string" || !row.idempotencyKey.trim() || !Number.isSafeInteger(row.expectedVersion) || row.expectedVersion < 0 || !Array.isArray(row.refunds) || typeof row.reason !== "string" || !row.reason.trim()) throw new Error("Yêu cầu hủy đã lưu bị lỗi. Cần đối chiếu trước khi tiếp tục.");
  if (row.cashSessionId !== undefined && (typeof row.cashSessionId !== "string" || !/^[a-f0-9]{24}$/i.test(row.cashSessionId))) throw new Error("Phiên thu hoàn đã lưu không hợp lệ.");
  let total = 0;
  const refunds = row.refunds.map((p: RetailPaymentInput) => {
    if (!p || !["cash", "card", "transfer", "ewallet"].includes(p.method) || !Number.isSafeInteger(p.amount) || p.amount <= 0 || (p.reference !== undefined && typeof p.reference !== "string") || (p.tenderedAmount !== undefined && (p.method !== "cash" || !Number.isSafeInteger(p.tenderedAmount) || p.tenderedAmount < p.amount))) throw new Error("Chi tiết tiền hoàn đã lưu không hợp lệ.");
    total += p.amount;
    return { method: p.method, amount: p.amount, tenderedAmount: p.tenderedAmount, reference: p.reference };
  });
  if (!Number.isSafeInteger(total)) throw new Error("Tổng tiền hoàn đã lưu không hợp lệ.");
  return { ...(row.cashSessionId ? { cashSessionId: row.cashSessionId } : {}), reason: row.reason, refunds, idempotencyKey: row.idempotencyKey, expectedVersion: row.expectedVersion };
}
export function sameCancellation(a: PendingCancellation, b: PendingCancellation) {
  return JSON.stringify(parse(JSON.stringify(a))) === JSON.stringify(parse(JSON.stringify(b)));
}
export function readCancellation(key: string) {
  const shared = parse(localStorage.getItem(key)), legacy = parse(sessionStorage.getItem(key));
  if (shared && legacy && !sameCancellation(shared, legacy)) throw new Error("Yêu cầu hủy ở tab cũ khác bản lưu chung. Giữ cả hai để đối chiếu.");
  return shared || legacy;
}
/** Caller holds the browser lock for every write, including migration and cleanup. */
export function saveCancellation(key: string, request: PendingCancellation) {
  const prior = readCancellation(key);
  if (prior && !sameCancellation(prior, request)) throw new Error("Yêu cầu đã thay đổi. Không ghi đè yêu cầu hủy khác.");
  const valid = parse(JSON.stringify(request))!;
  localStorage.setItem(key, JSON.stringify(valid));
  const saved = parse(localStorage.getItem(key));
  if (!saved || !sameCancellation(saved, valid)) throw new Error("Không lưu được nguyên yêu cầu. Chưa gửi yêu cầu hủy.");
  sessionStorage.removeItem(key);
}
export function clearCancellation(key: string, request: PendingCancellation) {
  const prior = readCancellation(key);
  if (prior && !sameCancellation(prior, request)) throw new Error("Bản lưu đã thay đổi. Không xóa yêu cầu hủy khác.");
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}
export async function lockCancellation(key: string, work: () => Promise<void>) {
  if (!navigator.locks?.request) throw new Error("Không khóa được thao tác giữa các tab. Cần trình duyệt hỗ trợ và kết nối HTTPS.");
  await navigator.locks.request(key, { mode: "exclusive", ifAvailable: true }, async lock => {
    if (!lock) throw new Error("Yêu cầu hủy đang được xử lý ở tab khác. Chờ rồi thử lại yêu cầu cũ.");
    await work();
  });
}

export function listPendingCancellations(companyCode: string, branchId: string, userId: string) {
  const keys = new Set<string>();
  for (const storage of [localStorage, sessionStorage]) for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith('retail-cancellation-pending:v1:')) continue;
    const identity = JSON.parse(key.slice('retail-cancellation-pending:v1:'.length));
    if (Array.isArray(identity) && identity.length === 4 && identity[0] === companyCode && identity[1] === branchId && identity[2] === userId && typeof identity[3] === 'string') keys.add(key);
  }
  return [...keys].flatMap(key => cancellationCandidates(key).map(request => ({ key, orderId: JSON.parse(key.slice('retail-cancellation-pending:v1:'.length))[3] as string, request })));
}

export function cancellationCandidates(key: string): PendingCancellation[] {
  const shared = parse(localStorage.getItem(key)), legacy = parse(sessionStorage.getItem(key));
  return shared && legacy && !sameCancellation(shared, legacy) ? [shared, legacy] : shared ? [shared] : legacy ? [legacy] : [];
}
/** Caller holds the browser lock and has a server-confirmed terminal result. */
export function clearCancellationCandidate(key: string, request: PendingCancellation) {
  const shared = parse(localStorage.getItem(key)), legacy = parse(sessionStorage.getItem(key));
  if (legacy && sameCancellation(legacy, request)) sessionStorage.removeItem(key);
  if (shared && sameCancellation(shared, request)) localStorage.removeItem(key);
}

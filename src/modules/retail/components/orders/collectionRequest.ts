import type { RetailPaymentInput } from "../../types";

export type PendingCollection = { cashSessionId?: string; payments: RetailPaymentInput[]; idempotencyKey: string; expectedVersion: number };
function parse(raw: string | null): PendingCollection | null {
  if (raw === null) return null;
  const row = JSON.parse(raw);
  if (!row || typeof row.idempotencyKey !== "string" || !row.idempotencyKey.trim() || !Number.isSafeInteger(row.expectedVersion) || row.expectedVersion < 0 || !Array.isArray(row.payments) || !row.payments.length) throw new Error("Yêu cầu thu đã lưu bị lỗi. Cần đối chiếu trước khi tiếp tục.");
  if (row.cashSessionId !== undefined && (typeof row.cashSessionId !== "string" || !/^[a-f0-9]{24}$/i.test(row.cashSessionId))) throw new Error("Phiên thu hoàn đã lưu không hợp lệ.");
  let total = 0;
  const payments = row.payments.map((p: RetailPaymentInput) => {
    if (!p || !["cash", "card", "transfer", "ewallet"].includes(p.method) || !Number.isSafeInteger(p.amount) || p.amount <= 0 || (p.reference !== undefined && typeof p.reference !== "string") || (p.tenderedAmount !== undefined && (p.method !== "cash" || !Number.isSafeInteger(p.tenderedAmount) || p.tenderedAmount < p.amount))) throw new Error("Chi tiết khoản thu đã lưu không hợp lệ.");
    total += p.amount;
    return { method: p.method, amount: p.amount, tenderedAmount: p.tenderedAmount, reference: p.reference };
  });
  if (!Number.isSafeInteger(total)) throw new Error("Tổng khoản thu đã lưu không hợp lệ.");
  return { ...(row.cashSessionId ? { cashSessionId: row.cashSessionId } : {}), payments, idempotencyKey: row.idempotencyKey, expectedVersion: row.expectedVersion };
}
export function sameCollection(a: PendingCollection, b: PendingCollection) {
  return JSON.stringify(parse(JSON.stringify(a))) === JSON.stringify(parse(JSON.stringify(b)));
}
export function readCollection(key: string) {
  const shared = parse(localStorage.getItem(key)), legacy = parse(sessionStorage.getItem(key));
  if (shared && legacy && !sameCollection(shared, legacy)) throw new Error("Khoản thu ở tab cũ khác bản lưu chung. Giữ cả hai để đối chiếu.");
  return shared || legacy;
}
/** Caller holds the browser lock for every write, including migration and cleanup. */
export function saveCollection(key: string, request: PendingCollection) {
  const prior = readCollection(key);
  if (prior && !sameCollection(prior, request)) throw new Error("Yêu cầu đã thay đổi. Không ghi đè khoản thu khác.");
  const valid = parse(JSON.stringify(request))!;
  localStorage.setItem(key, JSON.stringify(valid));
  const saved = parse(localStorage.getItem(key));
  if (!saved || !sameCollection(saved, valid)) throw new Error("Không lưu được nguyên yêu cầu. Chưa gửi khoản thu.");
  sessionStorage.removeItem(key);
}
export function clearCollection(key: string, request: PendingCollection) {
  const prior = readCollection(key);
  if (prior && !sameCollection(prior, request)) throw new Error("Bản lưu đã thay đổi. Không xóa khoản thu khác.");
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}
export async function lockCollection(key: string, work: () => Promise<void>) {
  if (!navigator.locks?.request) throw new Error("Không khóa được thao tác giữa các tab. Cần trình duyệt hỗ trợ và kết nối HTTPS.");
  await navigator.locks.request(key, { mode: "exclusive", ifAvailable: true }, async lock => {
    if (!lock) throw new Error("Khoản thu đang được xử lý ở tab khác. Chờ rồi thử lại yêu cầu cũ.");
    await work();
  });
}

export function collectionCandidates(key: string): PendingCollection[] {
  const shared = parse(localStorage.getItem(key)), legacy = parse(sessionStorage.getItem(key));
  return shared && legacy && !sameCollection(shared, legacy) ? [shared, legacy] : shared ? [shared] : legacy ? [legacy] : [];
}
/** Only after server-confirmed completion or revocation, while holding the browser lock. */
export function clearCollectionCandidate(key: string, request: PendingCollection) {
  const shared = parse(localStorage.getItem(key)), legacy = parse(sessionStorage.getItem(key));
  if (legacy && sameCollection(legacy, request)) sessionStorage.removeItem(key);
  if (shared && sameCollection(shared, request)) localStorage.removeItem(key);
}

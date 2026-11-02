import type { RetailAfterSaleInput } from "../types";

function parse(raw: string | null): RetailAfterSaleInput | null {
  if (raw === null) return null;
  const row = JSON.parse(raw);
  if (!row || !["return", "buyback"].includes(row.type) || typeof row.orderId !== "string" || !row.orderId || typeof row.idempotencyKey !== "string" || !row.idempotencyKey.trim() || typeof row.reason !== "string" || !row.reason.trim() || !["cash", "card", "transfer", "ewallet"].includes(row.paymentMethod) || (row.paymentReference !== undefined && typeof row.paymentReference !== "string") || !Array.isArray(row.items) || !row.items.length) throw new Error("Yêu cầu hậu mãi đã lưu bị lỗi. Cần đối chiếu trước khi tiếp tục.");
  if (row.expectedVersion !== undefined && (!Number.isSafeInteger(row.expectedVersion) || row.expectedVersion < 0)) throw new Error("Phiên bản đơn đã lưu không hợp lệ.");
  for (const item of row.items) {
    if (!item || !Number.isSafeInteger(item.orderLineIndex) || item.orderLineIndex < 0 || !Number.isSafeInteger(item.quantity) || item.quantity <= 0 || !["like_new", "good", "fair", "poor"].includes(item.condition) || (item.unitAmount !== undefined && (!Number.isSafeInteger(item.unitAmount) || item.unitAmount < 0)) || (row.type === "buyback" && item.unitAmount === undefined) || (item.note !== undefined && typeof item.note !== "string")) throw new Error("Dòng hàng hậu mãi đã lưu không hợp lệ.");
    for (const codes of [item.serialNumbers, item.internalBarcodes]) if (codes !== undefined && (!Array.isArray(codes) || codes.some(code => typeof code !== "string" || !code.trim()))) throw new Error("Mã máy đã lưu không hợp lệ.");
  }
  return row;
}
function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  return value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
}
export function sameAfterSale(a: RetailAfterSaleInput, b: RetailAfterSaleInput) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
export function readAfterSale(key: string) {
  const shared = parse(localStorage.getItem(key)), legacy = parse(sessionStorage.getItem(key));
  if (shared && legacy && !sameAfterSale(shared, legacy)) throw new Error("Yêu cầu hậu mãi ở tab cũ khác bản lưu chung. Giữ cả hai để đối chiếu.");
  return shared || legacy;
}
/** Caller holds the browser lock for every write, including migration and cleanup. */
export function saveAfterSale(key: string, request: RetailAfterSaleInput) {
  const prior = readAfterSale(key);
  if (prior && !sameAfterSale(prior, request)) throw new Error("Yêu cầu đã thay đổi. Không ghi đè yêu cầu hậu mãi khác.");
  const valid = parse(JSON.stringify(request))!;
  localStorage.setItem(key, JSON.stringify(valid));
  const saved = parse(localStorage.getItem(key));
  if (!saved || !sameAfterSale(saved, valid)) throw new Error("Không lưu được nguyên yêu cầu. Chưa gửi yêu cầu hậu mãi.");
  sessionStorage.removeItem(key);
}
export function clearAfterSale(key: string, request: RetailAfterSaleInput) {
  const prior = readAfterSale(key);
  if (prior && !sameAfterSale(prior, request)) throw new Error("Bản lưu đã thay đổi. Không xóa yêu cầu hậu mãi khác.");
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}
export async function lockAfterSale<T>(key: string, work: () => Promise<T>) {
  if (!navigator.locks?.request) throw new Error("Không khóa được thao tác giữa các tab. Cần trình duyệt hỗ trợ và kết nối HTTPS.");
  return navigator.locks.request(key, { mode: "exclusive", ifAvailable: true }, async lock => {
    if (!lock) throw new Error("Yêu cầu hậu mãi đang được xử lý ở tab khác. Chờ rồi thử lại yêu cầu cũ.");
    return work();
  });
}

export function afterSaleCandidates(key: string): RetailAfterSaleInput[] {
  const shared = parse(localStorage.getItem(key)), legacy = parse(sessionStorage.getItem(key));
  return shared && legacy && !sameAfterSale(shared, legacy) ? [shared, legacy] : shared ? [shared] : legacy ? [legacy] : [];
}
export function clearAfterSaleCandidate(key: string, request: RetailAfterSaleInput) {
  const shared = parse(localStorage.getItem(key)), legacy = parse(sessionStorage.getItem(key));
  if (legacy && sameAfterSale(legacy, request)) sessionStorage.removeItem(key);
  if (shared && sameAfterSale(shared, request)) localStorage.removeItem(key);
}

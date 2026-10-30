import { apiFetch } from "../modules/shared/lib/apiFetch";
export type CountStatus = "draft" | "counting" | "pending_approval" | "completed" | "cancelled" | "conflict";
export type CountTrackingMode = "none" | "quantity" | "unit_barcode" | "lot" | "serial";
export type CountExpectedUnit = { serialUnitId: string; internalBarcode?: string; serialNumber?: string };
export type CountItem = { _id: string; productId: string; variantId?: string; sku: string; barcode?: string; productName: string; systemQuantity: number; countedQuantity: number; quantityDelta: number; trackingMode?: CountTrackingMode; expectedUnits?: CountExpectedUnit[]; scannedUnitIds?: string[]; note?: string };
export type UnexpectedScanReason = "other_warehouse" | "sold" | "unknown" | "wrong_status";
export type UnexpectedScan = { code: string; reason: UnexpectedScanReason; serialUnitId?: string; sku?: string; productName?: string; warehouseId?: string; status?: string; scannedAt: string };
export type ScanResult = { outcome: "counted" | "duplicate" | "unexpected"; reason?: UnexpectedScanReason; sku?: string; productName?: string; count: InventoryCount };
export type CountApprovalReview = { expectedVersion: number; discrepancyConfirmed: boolean; reason: string; unexpectedScanResolutions: Array<{ code: string; reason: string }> };
export type InventoryCount = { _id: string; version: number; countCode: string; warehouseId: string; status: CountStatus; items: CountItem[]; unexpectedScans?: UnexpectedScan[]; createdAt: string; createdById?: string; submittedBy?: string; submittedById?: string; approvedById?: string; recreatedFromId?: string; replacementCountId?: string; approvalReview?: { reason?: string; confirmedById: string; confirmedAt: string; expectedVersion: number; unexpectedScanResolutions: Array<{ code: string; reason: string }> } };
type Envelope<T> = { status: string; data: T };
const root = "/inventory/counts";
const legacyQueueKey = "igen.inventory-count.pending";
export type CountQueueScope = { companyCode: string; branchId: string; userId: string; isCurrent?: () => boolean };
export function countQueueKey(scope: CountQueueScope) {
  if (!scope?.companyCode?.trim() || !scope?.branchId?.trim() || !scope?.userId?.trim()) throw new Error("Chưa xác định tài khoản và chi nhánh kiểm kê.");
  return legacyQueueKey + ".v2." + JSON.stringify([scope.companyCode.trim().toUpperCase(), scope.branchId.trim(), scope.userId.trim()]);
}
export type PendingUpdate = { id: string; itemId: string; countedQuantity: number; expectedVersion?: number; requestId?: string };
export type CountQueueInspection = { raw: string | null; legacyRaw: string | null; entries: PendingUpdate[]; error?: string };
export const countQueueChangedEvent = "inventory-count-queue-changed";
const validRequestId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const validVersion = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function readQueue(key: string): PendingUpdate[] {
  const raw = localStorage.getItem(key);
  if (raw === null) return [];
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("Dữ liệu chờ kiểm kê bị lỗi; đã giữ nguyên để đối chiếu."); }
  if (!Array.isArray(value) || value.some(item => !item || typeof item.id !== "string" || !item.id || typeof item.itemId !== "string" || !item.itemId || !Number.isFinite(item.countedQuantity) || item.countedQuantity < 0)) throw new Error("Dữ liệu chờ kiểm kê không hợp lệ; đã giữ nguyên để đối chiếu.");
  return value;
}
function writeQueue(key: string, items: PendingUpdate[]) {
  const raw = JSON.stringify(items);
  localStorage.setItem(key, raw);
  if (localStorage.getItem(key) !== raw) throw new Error("Không thể xác minh bản lưu kiểm kê.");
  window.dispatchEvent(new Event(countQueueChangedEvent));
}
async function locked<T>(scope: CountQueueScope, work: (key: string, check: () => void) => Promise<T>): Promise<T> {
  const key = countQueueKey(scope), token = localStorage.getItem("accessToken");
  const check = () => {
    if (scope.isCurrent?.() === false || localStorage.getItem("accessToken") !== token) throw new Error("Tài khoản hoặc chi nhánh đã thay đổi. Hãy mở lại phiếu kiểm kê.");
  };
  check();
  if (!navigator.locks?.request) throw new Error("Trình duyệt chưa hỗ trợ khóa đồng bộ kiểm kê an toàn.");
  return navigator.locks.request(key, { mode: "exclusive", ifAvailable: true }, async lock => {
    if (!lock) throw new Error("Một tab khác đang xử lý kiểm kê. Hãy thử lại sau.");
    check();
    return work(key, check);
  });
}
function removeExact(key: string, entries: PendingUpdate[]) {
  const signatures = new Set(entries.map(item => JSON.stringify(item)));
  writeQueue(key, readQueue(key).filter(item => !signatures.has(JSON.stringify(item))));
}
export type CountRequestResult = { status: "completed" | "not_found" | "revoked"; requestId: string; countId: string; itemId: string; committedVersion?: number; currentVersion?: number };
async function requestEvidence(item: PendingUpdate, scope: CountQueueScope): Promise<CountRequestResult> {
  if (!validRequestId(item.requestId) || !validVersion(item.expectedVersion)) throw new Error("Bản chờ cũ thiếu mã yêu cầu hoặc phiên bản. Cần đối chiếu thủ công.");
  const result = (await apiFetch<Envelope<CountRequestResult>>(root + "/" + encodeURIComponent(item.id) + "/items/" + encodeURIComponent(item.itemId) + "/reconcile", { method: "POST", refreshSession: false, headers: { "x-branch-id": scope.branchId }, body: JSON.stringify({ requestId: item.requestId, countedQuantity: item.countedQuantity, expectedVersion: item.expectedVersion }) })).data;
  if (!result || result.requestId !== item.requestId || result.countId !== item.id || result.itemId !== item.itemId || !["completed", "not_found", "revoked"].includes(result.status)) throw new Error("Kết quả xác minh không khớp yêu cầu. Đã giữ bản chờ.");
  if (result.status === "completed" && (result.committedVersion !== item.expectedVersion + 1 || !validVersion(result.currentVersion) || result.currentVersion < result.committedVersion)) throw new Error("Bằng chứng phiên bản không đầy đủ. Đã giữ bản chờ.");
  return result;
}
async function sendUpdate(item: PendingUpdate, scope: CountQueueScope) {
  if (!validVersion(item.expectedVersion) || !validRequestId(item.requestId)) throw new Error("Bản chờ thiếu phiên bản hoặc mã yêu cầu. Cần đối chiếu thủ công.");
  const result = (await apiFetch<Envelope<InventoryCount>>(root + "/" + item.id + "/items/" + item.itemId, { method: "PATCH", refreshSession: false, headers: { "x-branch-id": scope.branchId }, body: JSON.stringify({ countedQuantity: item.countedQuantity, expectedVersion: item.expectedVersion, requestId: item.requestId }) })).data;
  if (!result || result._id !== item.id || !validVersion(result.version) || result.version < item.expectedVersion + 1) throw new Error("Phản hồi lưu kiểm kê không có bằng chứng phiên bản. Bản chờ được giữ để xác minh.");
  return result;
}
async function revokeQueuedEntry(key: string, entry: PendingUpdate, scope: CountQueueScope, check: () => void) {
  const matches = () => readQueue(key).some(item => JSON.stringify(item) === JSON.stringify(entry));
  if (!matches()) throw new Error("Bản chờ đã thay đổi. Hãy đọc lại danh sách.");
  if (!validRequestId(entry.requestId) || !validVersion(entry.expectedVersion)) throw new Error("Bản chờ cũ thiếu mã yêu cầu hoặc phiên bản. Không thể thu hồi tự động.");
  const result = (await apiFetch<Envelope<CountRequestResult>>(root + "/" + encodeURIComponent(entry.id) + "/items/" + encodeURIComponent(entry.itemId) + "/revoke-request", { method: "POST", refreshSession: false, headers: { "x-branch-id": scope.branchId }, body: JSON.stringify({ requestId: entry.requestId, countedQuantity: entry.countedQuantity, expectedVersion: entry.expectedVersion }) })).data;
  check();
  if (!matches()) throw new Error("Bản chờ đã thay đổi. Hãy đọc lại danh sách.");
  if (!result || result.requestId !== entry.requestId || result.countId !== entry.id || result.itemId !== entry.itemId || !["completed", "revoked"].includes(result.status)) throw new Error("Kết quả thu hồi không khớp yêu cầu. Bản chờ vẫn được giữ.");
  if (result.status === "completed" && (result.committedVersion !== entry.expectedVersion + 1 || !validVersion(result.currentVersion) || result.currentVersion < result.committedVersion)) throw new Error("Bằng chứng phiên bản không đầy đủ. Bản chờ vẫn được giữ.");
  removeExact(key, [entry]);
  if (result.status === "completed") window.dispatchEvent(new Event("inventory-count-reconciled"));
  return result;
}

export const inventoryCountService = {
  async revokePending(entry: PendingUpdate, scope: CountQueueScope) {
    return locked(scope, (key, check) => revokeQueuedEntry(key, entry, scope, check));
  },
  async reconcilePending(entry: PendingUpdate, scope: CountQueueScope) {
    return locked(scope, async (key, check) => {
      const matches = () => readQueue(key).some(item => JSON.stringify(item) === JSON.stringify(entry));
      if (!matches()) throw new Error("Bản chờ đã thay đổi. Hãy đọc lại danh sách.");
      const result = await requestEvidence(entry, scope);
      check();
      if (!matches()) throw new Error("Bản chờ đã thay đổi. Hãy đọc lại danh sách.");
      if (result.status === "completed" || result.status === "revoked") {
        removeExact(key, [entry]);
        if (result.status === "completed") window.dispatchEvent(new Event("inventory-count-reconciled"));
      }
      return result;
    });
  },
  inspectPending(scope: CountQueueScope): CountQueueInspection {
    const key = countQueueKey(scope);
    if (scope.isCurrent?.() === false) throw new Error("Phạm vi kiểm kê đã thay đổi.");
    const raw = localStorage.getItem(key), legacyRaw = localStorage.getItem(legacyQueueKey);
    try { return { raw, legacyRaw, entries: readQueue(key) }; }
    catch (error) { return { raw, legacyRaw, entries: [], error: error instanceof Error ? error.message : "Không thể đọc bản chờ." }; }
  },
  async comparePending(entry: PendingUpdate, scope: CountQueueScope) {
    const key = countQueueKey(scope), token = localStorage.getItem("accessToken");
    const check = () => {
      if (scope.isCurrent?.() === false || localStorage.getItem("accessToken") !== token) throw new Error("Phạm vi kiểm kê đã thay đổi.");
      if (!readQueue(key).some(item => JSON.stringify(item) === JSON.stringify(entry))) throw new Error("Bản chờ đã thay đổi. Hãy đọc lại danh sách.");
    };
    check();
    const latest = (await apiFetch<Envelope<InventoryCount>>(root + "/" + encodeURIComponent(entry.id), { refreshSession: false, headers: { "x-branch-id": scope.branchId } })).data;
    check();
    if (latest._id !== entry.id) throw new Error("Phiếu trả về không khớp bản chờ.");
    return latest;
  },
  async list(warehouseId?: string) { return (await apiFetch<Envelope<InventoryCount[]>>(root, { params: warehouseId ? { warehouseId } : {} })).data; },
  async get(id: string) { return (await apiFetch<Envelope<InventoryCount>>(root + "/" + id)).data; },
  async reload(id: string, scope: CountQueueScope) {
    return locked(scope, async (key, check) => {
      const snapshot = readQueue(key).filter(item => item.id === id);
      for (const item of snapshot) await revokeQueuedEntry(key, item, scope, check);
      const latest = (await apiFetch<Envelope<InventoryCount>>(root + "/" + id, { refreshSession: false, headers: { "x-branch-id": scope.branchId } })).data;
      check();
      return latest;
    });
  },
  async create(warehouseId: string) { return (await apiFetch<Envelope<InventoryCount>>(root, { method: "POST", body: JSON.stringify({ warehouseId }) })).data; },
  async recreate(id: string) { return (await apiFetch<Envelope<InventoryCount>>(root + "/" + id + "/recreate", { method: "POST" })).data; },
  async updateItem(id: string, itemId: string, countedQuantity: number, expectedVersion: number, scope: CountQueueScope) {
    if (!validVersion(expectedVersion)) throw new Error("Hãy tải lại phiếu kiểm kê trước khi lưu số lượng.");
    if (!Number.isFinite(countedQuantity) || countedQuantity < 0) throw new Error("Số lượng kiểm kê không hợp lệ.");
    return locked(scope, async (key, check) => {
      const queue = readQueue(key);
      if (queue.some(item => item.id === id)) throw new Error("Phiếu có số lượng đang chờ. Hãy đồng bộ hoặc tải lại để đối chiếu trước khi sửa tiếp.");
      const item = { id, itemId, countedQuantity, expectedVersion, requestId: crypto.randomUUID() };
      // Persist before sending: a lost response must not lose the original version.
      writeQueue(key, [...queue, item]);
      check();
      const result = await sendUpdate(item, scope);
      check();
      removeExact(key, [item]);
      return result;
    });
  },
  async scan(id: string, code: string) { return (await apiFetch<Envelope<ScanResult>>(root + "/" + id + "/scan", { method: "POST", body: JSON.stringify({ code }) })).data; },
  async syncPending(scope: CountQueueScope) {
    return locked(scope, async (key, check) => {
      let conflicts = 0;
      for (const item of readQueue(key)) {
        check();
        if (!validVersion(item.expectedVersion) || !validRequestId(item.requestId)) { conflicts += 1; continue; }
        try {
          const evidence = await requestEvidence(item, scope);
          check();
          if (!readQueue(key).some(current => JSON.stringify(current) === JSON.stringify(item))) continue;
          if (evidence.status === "not_found") await sendUpdate(item, scope);
          check();
          removeExact(key, [item]);
        } catch (error: any) {
          check();
          if (error?.status === 409 || error?.statusCode === 409) conflicts += 1;
        }
      }
      return { remaining: readQueue(key).length, conflicts, legacy: localStorage.getItem(legacyQueueKey) !== null };
    });
  },
  async discardPending(id: string, scope: CountQueueScope) {
    return locked(scope, async (key, check) => {
      const snapshot = readQueue(key).filter(item => item.id === id);
      for (const item of snapshot) await revokeQueuedEntry(key, item, scope, check);
    });
  },
  async start(id: string) { return (await apiFetch<Envelope<InventoryCount>>(root + "/" + id + "/start", { method: "POST" })).data; },
  async submit(id: string) { return (await apiFetch<Envelope<InventoryCount>>(root + "/" + id + "/submit", { method: "POST" })).data; },
  async approve(id: string, review: CountApprovalReview) { return (await apiFetch<Envelope<InventoryCount>>(root + "/" + id + "/approve", { method: "POST", body: JSON.stringify(review) })).data; },
  async cancel(id: string) { return (await apiFetch<Envelope<InventoryCount>>(root + "/" + id + "/cancel", { method: "POST" })).data; },
};

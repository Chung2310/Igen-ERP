import { InventoryCountRequestModel } from "./inventory-count-request.model";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { InventoryCountModel } from "../../../model/inventory-count.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { assertCountTransition, assertEditableStatus, calculateQuantityDelta } from "./inventory-count.rules";
import type { InventoryCountStatus } from "../../../interface/inventory.interface";
import { writeStockMovement } from "../../../integrations/shared/stock-movement.service";
import { SerialUnitModel } from "../serials/serial-unit.model";
import { SerialEventModel } from "../serials/serial-event.model";
import { normalizeSerialNumber } from "../serials/serial-state";
import { normalizeInternalBarcode } from "../serials/unit-barcode-validation";
import { WarehouseModel } from "../../../model/warehouse.model";
import { inInventoryTransaction } from "../inventory-transaction";

const isUnitTracked = (trackingMode?: string) => trackingMode === "serial" || trackingMode === "unit_barcode";

type Scope = { companyCode: string; branchId: string };
type Actor = { id?: string; email?: string };
const code = (value: unknown) => String(value || "").trim();
const normalizedCompany = (value: string) => code(value).toUpperCase();
const nameOf = (actor: Actor) => code(actor.email || actor.id) || "system";
function fail(message: string, statusCode = 400): never { throw Object.assign(new Error(message), { statusCode }); }

async function saveCount(count: any, session?: mongoose.ClientSession) {
  try {
    await count.save(session ? { session } : undefined);
  } catch (error: any) {
    if (error?.name === "VersionError") throw Object.assign(new Error("Phiếu kiểm kê vừa thay đổi. Hãy tải lại trước khi tiếp tục."), { statusCode: 409, code: "COUNT_VERSION_CONFLICT" });
    throw error;
  }
}

async function countItems(scope: Scope, warehouseId: string, session: mongoose.ClientSession) {
  const balances = await InventoryBalanceModel.find({ companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId, warehouseId }).sort({ sku: 1 }).session(session).lean();
  const productIds = [...new Set(balances.map((item) => item.productId))];
  const variantIds = balances.map((item) => item.variantId).filter(Boolean);
  // Operations on one transaction session must be sequential.
  const products = await ProductCatalogModel.find({ _id: { $in: productIds }, companyCode: normalizedCompany(scope.companyCode) }).select("name").session(session).lean();
  const variants = await ProductVariantModel.find({ _id: { $in: variantIds }, companyCode: normalizedCompany(scope.companyCode) }).select("barcode displayName trackingMode").session(session).lean();
  const productMap = new Map(products.map((item: any) => [String(item._id), item]));
  const variantMap = new Map(variants.map((item: any) => [String(item._id), item]));
  // Hàng theo dõi từng đơn vị đếm bằng cách quét, nên phải biết trước kho đang ghi những máy nào.
  const unitTrackedVariantIds = variants.filter((item: any) => isUnitTracked(item.trackingMode)).map((item: any) => String(item._id));
  const serialUnits = unitTrackedVariantIds.length
    ? await SerialUnitModel.find({ companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId, warehouseId, variantId: { $in: unitTrackedVariantIds }, status: "in_stock" }).select("variantId internalBarcode serialNumber").session(session).lean()
    : [];
  const unitsByVariant = new Map<string, any[]>();
  for (const unit of serialUnits as any[]) {
    const key = String(unit.variantId);
    unitsByVariant.set(key, [...(unitsByVariant.get(key) || []), unit]);
  }
  return balances.map((balance: any) => {
    const product: any = productMap.get(String(balance.productId));
    const variant: any = balance.variantId ? variantMap.get(String(balance.variantId)) : undefined;
    const quantity = Number(balance.quantity || 0);
    const trackingMode = variant?.trackingMode;
    const base = { productId: balance.productId, variantId: balance.variantId, sku: balance.sku, barcode: variant?.barcode, productName: variant?.displayName || product?.name || balance.sku, systemQuantity: quantity, sourceBalanceVersion: Number(balance.version || 0), trackingMode };
    if (!isUnitTracked(trackingMode)) return { ...base, countedQuantity: quantity, quantityDelta: 0 };
    const expectedUnits = (unitsByVariant.get(String(balance.variantId)) || []).map((unit: any) => ({ serialUnitId: String(unit._id), internalBarcode: unit.internalBarcode, serialNumber: unit.serialNumber }));
    // Chưa quét gì thì coi như chưa đếm được máy nào, lệch âm đúng bằng tồn.
    return { ...base, expectedUnits, scannedUnitIds: [], countedQuantity: 0, quantityDelta: calculateQuantityDelta(quantity, 0) };
  });
}

export async function listCounts(scope: Scope, filters: { warehouseId?: unknown; status?: unknown } = {}) {
  const filter: Record<string, unknown> = { companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId };
  if (code(filters.warehouseId)) filter.warehouseId = code(filters.warehouseId);
  if (code(filters.status)) filter.status = code(filters.status);
  return InventoryCountModel.find(filter as any).sort({ createdAt: -1 }).lean();
}

export async function getCount(scope: Scope, countId: string) {
  const count = await InventoryCountModel.findOne({ _id: countId, companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId }).lean();
  if (!count) fail("Không tìm thấy phiếu kiểm kê.", 404);
  return count;
}

export async function createCount(scope: Scope, warehouseId: string, actor: Actor, notes?: string) {
  if (!code(actor.id)) fail("Thiếu định danh người lập kiểm kê.", 401);
  if (!code(warehouseId)) fail("Kho kiểm kê là bắt buộc.");
  return inInventoryTransaction((session) => createCountSnapshot(scope, warehouseId, actor, session, notes), undefined, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
}

async function createCountSnapshot(scope: Scope, warehouseId: string, actor: Actor, session: mongoose.ClientSession, notes?: string, recreatedFromId?: string) {
    const snapshotStartedAt = new Date();
    const warehouse = await WarehouseModel.findOne({ _id: warehouseId, companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId, isActive: true, kind: { $ne: "transit" } }).session(session).lean();
    if (!warehouse) fail("Kho kiểm kê không còn hoạt động hoặc không thuộc phạm vi.", 409);
    const snapshotItems = await countItems(scope, warehouseId, session);
    const items = recreatedFromId ? snapshotItems.map((item) => ({ ...item, countedQuantity: 0, quantityDelta: -item.systemQuantity })) : snapshotItems;
    const countCode = "KK-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    const [count] = await InventoryCountModel.create([{ companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId, warehouseId, countCode, snapshotStartedAt, recreatedFromId, status: "draft", items, notes: code(notes) || undefined, createdBy: nameOf(actor), createdById: code(actor.id), version: 0 }], { session });
    return count;
}

export async function recreateCount(scope: Scope, countId: string, actor: Actor) {
  if (!code(actor.id)) fail("Thiếu định danh người lập kiểm kê.", 401);
  return inInventoryTransaction(async (session) => {
    const filter = { companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId };
    const source = await InventoryCountModel.findOne({ _id: countId, ...filter }).session(session);
    if (!source) fail("Không tìm thấy phiếu kiểm kê.", 404);
    if (source.status !== "conflict") fail("Chỉ tạo lại phiếu kiểm kê đã xung đột tồn kho.", 409);
    if (source.replacementCountId) {
      const existing = await InventoryCountModel.findOne({ _id: source.replacementCountId, ...filter, recreatedFromId: String(source._id) }).session(session);
      if (!existing) fail("Liên kết phiếu tạo lại không hợp lệ. Cần đối soát trước khi tiếp tục.", 409);
      return existing;
    }
    const replacement = await createCountSnapshot(scope, source.warehouseId, actor, session, undefined, String(source._id));
    source.replacementCountId = String(replacement._id);
    await saveCount(source, session);
    return replacement;
  }, undefined, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
}

type CountEditInput = { countedQuantity?: unknown; note?: unknown; expectedVersion?: unknown; requestId?: unknown };
const countRequestPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function countRequestIdentity(scope: Scope, countId: string, itemId: string, input: CountEditInput, actor: Actor) {
  if (!code(actor.id)) fail("Thiếu định danh người cập nhật kiểm kê.", 401);
  if (!code(scope.companyCode) || !code(scope.branchId)) fail("Thiếu phạm vi kiểm kê.", 400);
  if (typeof input.requestId !== "string" || !countRequestPattern.test(input.requestId)) fail("Mã yêu cầu kiểm kê không hợp lệ.");
  if (typeof input.expectedVersion !== "number" || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 || input.expectedVersion >= Number.MAX_SAFE_INTEGER) fail("Phiên bản kiểm kê không hợp lệ.");
  if (typeof input.countedQuantity !== "number" || !Number.isFinite(input.countedQuantity) || input.countedQuantity < 0) fail("Số đếm kiểm kê không hợp lệ.");
  if (input.note !== undefined && typeof input.note !== "string") fail("Ghi chú kiểm kê không hợp lệ.");
  const identity = { companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId, actorId: code(actor.id), requestId: input.requestId, countId, itemId };
  return { ...identity, fingerprint: JSON.stringify(["count-quantity-v1", identity.companyCode, identity.branchId, identity.actorId, countId, itemId, input.expectedVersion, input.countedQuantity, input.note === undefined ? null : code(input.note)]) };
}
async function countRequestEvidence(identity: ReturnType<typeof countRequestIdentity>, expectedVersion: number, session: mongoose.ClientSession) {
  const gate = await InventoryCountRequestModel.findOne({ companyCode: identity.companyCode, requestId: identity.requestId }).session(session).lean();
  if (!gate) return null;
  if (gate.fingerprint !== identity.fingerprint || gate.branchId !== identity.branchId || gate.actorId !== identity.actorId || gate.countId !== identity.countId || gate.itemId !== identity.itemId) fail("Mã yêu cầu đã được dùng với nội dung hoặc người thao tác khác.", 409);
  const count = await InventoryCountModel.findOne({ _id: identity.countId, companyCode: identity.companyCode, branchId: identity.branchId }).session(session).lean();
  if (gate.status === "revoked") return { gate, status: "revoked" as const };
  if (gate.status !== "completed" || gate.committedVersion !== expectedVersion + 1 || !count || !Number.isSafeInteger(count.version) || count.version < gate.committedVersion || !count.items.some(item => String(item._id) === identity.itemId)) fail("Bằng chứng lưu kiểm kê không đầy đủ. Cần đối chiếu riêng.", 409);
  return { gate, count, status: "completed" as const };
}
export async function reconcileCountItem(scope: Scope, countId: string, itemId: string, input: CountEditInput, actor: Actor) {
  const identity = countRequestIdentity(scope, countId, itemId, input, actor);
  return inInventoryTransaction(async session => {
    const evidence = await countRequestEvidence(identity, input.expectedVersion as number, session);
    const base = { requestId: identity.requestId, countId, itemId };
    if (evidence?.status === "revoked") return { ...base, status: "revoked" as const };
    if (evidence?.status === "completed") return { ...base, status: "completed" as const, committedVersion: evidence.gate.committedVersion, currentVersion: evidence.count.version };
    const count = await InventoryCountModel.findOne({ _id: countId, companyCode: identity.companyCode, branchId: identity.branchId }).session(session).lean();
    if (!count) fail("Không tìm thấy phiếu kiểm kê.", 404);
    return { ...base, status: "not_found" as const };
  }, undefined, { readConcern: { level: "snapshot" } });
}
export async function revokeCountItemRequest(scope: Scope, countId: string, itemId: string, input: CountEditInput, actor: Actor) {
  const identity = countRequestIdentity(scope, countId, itemId, input, actor);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await inInventoryTransaction(async session => {
        const evidence = await countRequestEvidence(identity, input.expectedVersion as number, session);
        const base = { requestId: identity.requestId, countId, itemId };
        if (evidence?.status === "completed") return { ...base, status: "completed" as const, committedVersion: evidence.gate.committedVersion, currentVersion: evidence.count.version };
        if (evidence?.status === "revoked") return { ...base, status: "revoked" as const };
        const count = await InventoryCountModel.findOne({ _id: countId, companyCode: identity.companyCode, branchId: identity.branchId }).session(session).lean();
        if (!count) fail("Không tìm thấy phiếu kiểm kê.", 404);
        if (count.version !== input.expectedVersion) fail("Phiếu đã tiến phiên bản nhưng chưa có bằng chứng yêu cầu này. Cần đối chiếu riêng; chưa thu hồi.", 409);
        assertEditableStatus(count.status as InventoryCountStatus);
        await InventoryCountRequestModel.create([{ ...identity, status: "revoked" }], { session });
        return { ...base, status: "revoked" as const };
      }, undefined, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    } catch (error: any) {
      if (error?.code !== 11000 || !error?.keyPattern?.requestId || !error?.keyPattern?.companyCode || attempt === 2) throw error;
    }
  }
  throw new Error("Unreachable count request revocation retry");
}

export async function updateCountItem(scope: Scope, countId: string, itemId: string, input: CountEditInput, actor: Actor = {}) {
  // Existing clients retain optimistic version protection, but receive no fabricated evidence.
  if (input.requestId === undefined) return updateCountItemOnce(scope, countId, itemId, input);
  const identity = countRequestIdentity(scope, countId, itemId, input, actor);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await inInventoryTransaction(async session => {
        const existing = await countRequestEvidence(identity, input.expectedVersion as number, session);
        if (existing?.status === "revoked") fail("Yêu cầu đếm này đã được thu hồi; không thể gửi lại.", 409);
        if (existing?.status === "completed") return existing.count;
        const count = await updateCountItemOnce(scope, countId, itemId, input, session);
        await InventoryCountRequestModel.create([{ ...identity, status: "completed", committedVersion: count.version }], { session });
        return count;
      }, undefined, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    } catch (error: any) {
      if (error?.code !== 11000 || !error?.keyPattern?.requestId || !error?.keyPattern?.companyCode || attempt === 2) throw error;
    }
  }
  throw new Error("Unreachable count request retry");
}
async function updateCountItemOnce(scope: Scope, countId: string, itemId: string, input: CountEditInput, session?: mongoose.ClientSession) {
  if (typeof input.expectedVersion !== "number" || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) fail("Cần phiên bản phiếu kiểm kê hợp lệ. Hãy tải lại phiếu trước khi lưu.");
  const count = await InventoryCountModel.findOne({ _id: countId, companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId }).session(session || null);
  if (!count) fail("Không tìm thấy phiếu kiểm kê.", 404);
  if (count.version !== input.expectedVersion) throw Object.assign(new Error("Phiếu kiểm kê đã thay đổi. Hãy tải lại phiếu và đối chiếu số lượng trước khi lưu."), { statusCode: 409, code: "COUNT_VERSION_CONFLICT" });
  assertEditableStatus(count.status as InventoryCountStatus);
  const item: any = count.items.find((entry: any) => String(entry._id) === itemId);
  if (!item) fail("Không tìm thấy dòng kiểm kê.", 404);
  // Hàng theo dõi từng đơn vị chỉ được đếm bằng quét, gõ tay sẽ phá mất đối chiếu theo máy.
  if (isUnitTracked(item.trackingMode) && input.countedQuantity !== undefined) fail(`SKU ${item.sku} phải đếm bằng cách quét mã nội bộ/IMEI từng máy.`);
  if (input.countedQuantity === undefined) {
    if (input.note !== undefined) item.note = code(input.note) || undefined;
    count.markModified("items");
    await saveCount(count, session);
    return count.toObject();
  }
  const counted = Number(input.countedQuantity);
  item.countedQuantity = counted;
  item.quantityDelta = calculateQuantityDelta(Number(item.systemQuantity), counted);
  if (input.note !== undefined) item.note = code(input.note) || undefined;
  count.markModified("items");
  await saveCount(count, session);
  return count.toObject();
}

/** Quét một mã nội bộ/IMEI trong lúc kiểm kê: đánh dấu đã thấy, hoặc xếp vào danh sách ngoài dự kiến. */
export async function scanCountUnit(scope: Scope, countId: string, rawCode: unknown) {
  // Re-read the latest list/status after a competing scan; retry only a known
  // version conflict, never persistence errors with an uncertain result.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try { return await scanCountUnitOnce(scope, countId, rawCode); }
    catch (error: any) {
      if (error?.code !== "COUNT_VERSION_CONFLICT" || attempt === 4) throw error;
    }
  }
  throw new Error("Unreachable scan retry state");
}

async function scanCountUnitOnce(scope: Scope, countId: string, rawCode: unknown) {
  const value = code(rawCode);
  if (!value) fail("Thiếu mã cần quét.");
  const count = await InventoryCountModel.findOne({ _id: countId, companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId });
  if (!count) fail("Không tìm thấy phiếu kiểm kê.", 404);
  assertEditableStatus(count.status as InventoryCountStatus);

  const unit: any = await SerialUnitModel.findOne({
    companyCode: normalizedCompany(scope.companyCode),
    $or: [{ normalizedSerialNumber: normalizeSerialNumber(value) }, { normalizedInternalBarcode: normalizeInternalBarcode(value) }, { normalizedBarcodeAliases: normalizeInternalBarcode(value) }, { normalizedImeis: normalizeInternalBarcode(value) }],
  }).lean();

  const recordUnexpected = async (reason: "other_warehouse" | "sold" | "unknown" | "wrong_status") => {
    const scans = (count.unexpectedScans || []) as any[];
    // Quét lại cùng một mã không nhân bản cảnh báo.
    if (!scans.some((scan) => scan.code === value)) {
      scans.push({ code: value, reason, serialUnitId: unit ? String(unit._id) : undefined, sku: unit?.sku, productName: unit?.productName, warehouseId: unit?.warehouseId, status: unit?.status, scannedAt: new Date() });
      count.unexpectedScans = scans as any;
      count.markModified("unexpectedScans");
      await saveCount(count);
    }
    return { outcome: "unexpected" as const, reason, count: count.toObject() };
  };

  if (!unit) return recordUnexpected("unknown");
  if (unit.status === "sold") return recordUnexpected("sold");
  if (unit.status !== "in_stock") return recordUnexpected("wrong_status");
  if (String(unit.warehouseId || "") !== String(count.warehouseId)) return recordUnexpected("other_warehouse");

  const item: any = count.items.find((entry: any) => isUnitTracked(entry.trackingMode) && String(entry.variantId || "") === String(unit.variantId || ""));
  // Máy đúng kho nhưng SKU của nó không có dòng nào trong phiếu (tồn kho lệch sẵn từ trước).
  if (!item) return recordUnexpected("unknown");

  const scanned: string[] = Array.isArray(item.scannedUnitIds) ? item.scannedUnitIds : [];
  if (scanned.includes(String(unit._id))) return { outcome: "duplicate" as const, sku: item.sku, count: count.toObject() };
  const expected: any[] = Array.isArray(item.expectedUnits) ? item.expectedUnits : [];
  if (!expected.some((entry) => String(entry.serialUnitId) === String(unit._id))) return recordUnexpected("unknown");

  item.scannedUnitIds = [...scanned, String(unit._id)];
  item.countedQuantity = item.scannedUnitIds.length;
  item.quantityDelta = calculateQuantityDelta(Number(item.systemQuantity), item.countedQuantity);
  count.markModified("items");
  await saveCount(count);
  return { outcome: "counted" as const, sku: item.sku, productName: item.productName, count: count.toObject() };
}

async function transition(scope: Scope, countId: string, status: InventoryCountStatus, actor: Actor) {
  const count = await InventoryCountModel.findOne({ _id: countId, companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId });
  if (!count) fail("Không tìm thấy phiếu kiểm kê.", 404);
  assertCountTransition(count.status as InventoryCountStatus, status);
  count.status = status;
  if (status === "pending_approval") {
    if (!code(actor.id)) fail("Thiếu định danh người gửi duyệt.", 401);
    count.submittedBy = nameOf(actor); count.submittedById = code(actor.id); count.submittedAt = new Date();
  }
  if (status === "cancelled") count.cancelledAt = new Date();
  await saveCount(count);
  return count.toObject();
}
export const startCount = (scope: Scope, id: string, actor: Actor) => transition(scope, id, "counting", actor);
export const submitCount = (scope: Scope, id: string, actor: Actor) => transition(scope, id, "pending_approval", actor);
export const cancelCount = (scope: Scope, id: string, actor: Actor) => transition(scope, id, "cancelled", actor);

export type CountApprovalInput = { expectedVersion?: unknown; discrepancyConfirmed?: unknown; reason?: unknown; unexpectedScanResolutions?: unknown };
export async function approveCount(scope: Scope, countId: string, actor: Actor, review: CountApprovalInput = {}) {
  if (!code(actor.id)) fail("Thiếu định danh người duyệt kiểm kê.", 401);
  const session = await mongoose.startSession();
  let conflictVersion: number | undefined;
  try {
    await session.withTransaction(async () => {
      const count: any = await InventoryCountModel.findOne({ _id: countId, companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId }).session(session);
      if (!count) fail("Không tìm thấy phiếu kiểm kê.", 404);
      assertCountTransition(count.status as InventoryCountStatus, "completed");
      if (!count.createdById) fail("Phiếu cũ thiếu định danh người lập. Hãy lập phiếu kiểm kê mới để duyệt độc lập.", 409);
      if (count.submittedBy && !count.submittedById) fail("Phiếu cũ thiếu định danh người gửi duyệt. Hãy lập phiếu kiểm kê mới.", 409);
      if (code(actor.id) === count.createdById || code(actor.id) === count.submittedById) fail("Người lập hoặc gửi duyệt không được tự duyệt phiếu kiểm kê.", 403);
      if (typeof review.expectedVersion !== "number" || !Number.isSafeInteger(review.expectedVersion) || review.expectedVersion < 0) fail("Cần phiên bản phiếu để xác nhận duyệt. Hãy tải lại phiếu.");
      if (review.expectedVersion !== count.version) fail("Phiếu đã thay đổi. Hãy tải lại và xác nhận chênh lệch mới.", 409);
      for (const item of count.items as any[]) {
        if (calculateQuantityDelta(Number(item.systemQuantity), Number(item.countedQuantity)) !== Number(item.quantityDelta)) fail("Số lượng và chênh lệch trên phiếu không khớp. Cần đối soát lại.", 409);
        if (isUnitTracked(item.trackingMode)) {
          const expected = (item.expectedUnits || []).map((unit: any) => String(unit.serialUnitId));
          const scanned = (item.scannedUnitIds || []).map(String);
          if (new Set(expected).size !== expected.length || expected.length !== item.systemQuantity || new Set(scanned).size !== scanned.length || scanned.length !== item.countedQuantity || scanned.some((id: string) => !expected.includes(id))) fail("Danh sách máy và số lượng trên phiếu không khớp. Cần đối soát lại.", 409);
        }
      }
      const missingCount = count.items.reduce((total: number, item: any) => total + (isUnitTracked(item.trackingMode) ? (item.expectedUnits || []).filter((unit: any) => !(item.scannedUnitIds || []).includes(String(unit.serialUnitId))).length : 0), 0);
      const hasDiscrepancy = missingCount > 0 || count.items.some((item: any) => Number(item.quantityDelta) !== 0);
      const reason = typeof review.reason === "string" ? review.reason.trim() : "";
      if (reason.length > 2000 || (hasDiscrepancy && (review.discrepancyConfirmed !== true || !reason))) fail("Phải xác nhận chênh lệch và nhập lý do (tối đa 2.000 ký tự) trước khi điều chỉnh tồn hoặc ghi nhận máy thất lạc.");
      const resolutions = Array.isArray(review.unexpectedScanResolutions) ? review.unexpectedScanResolutions : [];
      const unexpected = count.unexpectedScans || [];
      if (resolutions.length !== unexpected.length || new Set(resolutions.map((entry: any) => entry?.code)).size !== resolutions.length || resolutions.some((entry: any) => !entry || typeof entry.reason !== "string" || !entry.reason.trim() || entry.reason.trim().length > 2000 || !unexpected.some((scan: any) => scan.code === entry.code))) fail("Cần ghi rõ kết quả đối chiếu cho từng mã ngoài dự kiến; không được bỏ qua hoặc thêm mã khác.");
      count.approvalReview = { expectedVersion: review.expectedVersion, reason: reason || undefined, confirmedById: code(actor.id), confirmedAt: new Date(), unexpectedScanResolutions: resolutions.map((entry: any) => ({ code: entry.code, reason: entry.reason.trim() })) };
      const balances = await InventoryBalanceModel.find({ companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId, warehouseId: count.warehouseId }).session(session).lean();
      const balanceMap = new Map(balances.map((balance: any) => [String(balance.productId) + ":" + String(balance.variantId || ""), balance]));
      if (balances.length !== count.items.length) {
        conflictVersion = count.version;
        throw Object.assign(new Error("Danh sách tồn kho đã thay đổi sau khi chốt kiểm kê. Hãy tạo lại phiếu."), { statusCode: 409, code: "COUNT_STOCK_CONFLICT" });
      }
      for (const item of count.items as any[]) {
        const balance: any = balanceMap.get(String(item.productId) + ":" + String(item.variantId || ""));
        if (!balance || Number(balance.version) !== Number(item.sourceBalanceVersion)) {
          conflictVersion = count.version;
          throw Object.assign(new Error("Tồn kho đã thay đổi sau khi bắt đầu kiểm kê."), { statusCode: 409, code: "COUNT_STOCK_CONFLICT" });
        }
      }
      const items = count.items.filter((item: any) => Number(item.quantityDelta) !== 0);
      const input = (direction: "in" | "out", selected: any[]) => selected.length ? writeStockMovement({
        companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId, warehouseId: count.warehouseId,
        direction, purpose: "count_adjustment", sourceType: "inventory-count", sourceId: String(count._id),
        sourceCode: count.countCode, idempotencyKey: "inventory-count:" + String(count._id) + ":" + direction,
        operatorName: nameOf(actor), allowNegativeStock: true, session,
        reason: "Điều chỉnh theo kiểm kê " + count.countCode,
        items: selected.map((item: any) => ({ productId: item.productId, variantId: item.variantId, sku: item.sku, productName: item.productName, quantity: Math.abs(Number(item.quantityDelta)), unitCost: Number(balanceMap.get(String(item.productId) + ":" + String(item.variantId || ""))?.averageCost || 0) })),
      }) : Promise.resolve();
      await input("in", items.filter((item: any) => Number(item.quantityDelta) > 0));
      await input("out", items.filter((item: any) => Number(item.quantityDelta) < 0));
      // Máy hệ thống ghi còn trong kho nhưng không quét thấy thì đánh thất lạc, nếu không tồn về 0 mà POS vẫn bán được.
      for (const item of count.items as any[]) {
        if (!isUnitTracked(item.trackingMode)) continue;
        const scanned = new Set((item.scannedUnitIds || []).map(String));
        const missing = (item.expectedUnits || []).filter((entry: any) => !scanned.has(String(entry.serialUnitId)));
        for (const entry of missing) {
          const updated = await SerialUnitModel.findOneAndUpdate(
            { _id: entry.serialUnitId, companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId, warehouseId: count.warehouseId, productId: item.productId, variantId: item.variantId, status: "in_stock" },
            { $set: { status: "lost", updatedBy: code(actor.id), currentDocumentType: "inventory-count", currentDocumentId: String(count._id) } },
            { returnDocument: 'after', session },
          );
          if (!updated) fail("Máy chưa quét đã thay đổi trạng thái hoặc vị trí. Không thể ghi nhận thất lạc; cần đối soát lại.", 409);
          await SerialEventModel.create([{ companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId, serialUnitId: String(entry.serialUnitId), serialNumber: updated.serialNumber, eventType: "count_lost", fromStatus: "in_stock", toStatus: "lost", documentType: "inventory-count", documentId: String(count._id), reason: `Kiểm kê ${count.countCode} không tìm thấy máy`, actorId: code(actor.id), actorName: nameOf(actor) }], { session });
        }
      }
      count.status = "completed";
      count.approvedBy = nameOf(actor);
      count.approvedById = code(actor.id);
      count.approvedAt = new Date();
      await saveCount(count, session);
    });
    return getCount(scope, countId);
  } catch (error: any) {
    if (error?.code === "COUNT_STOCK_CONFLICT") await InventoryCountModel.updateOne({ _id: countId, companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId, status: "pending_approval", version: conflictVersion }, { $set: { status: "conflict" }, $inc: { version: 1 } });
    throw error;
  } finally {
    await session.endSession();
  }
}
import mongoose from "mongoose";

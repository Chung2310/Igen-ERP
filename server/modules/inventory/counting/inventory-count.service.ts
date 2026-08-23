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

const isUnitTracked = (trackingMode?: string) => trackingMode === "serial" || trackingMode === "unit_barcode";

type Scope = { companyCode: string; branchId: string };
type Actor = { id?: string; email?: string };
const code = (value: unknown) => String(value || "").trim();
const normalizedCompany = (value: string) => code(value).toUpperCase();
const nameOf = (actor: Actor) => code(actor.email || actor.id) || "system";
function fail(message: string, statusCode = 400): never { throw Object.assign(new Error(message), { statusCode }); }

async function countItems(scope: Scope, warehouseId: string) {
  const balances = await InventoryBalanceModel.find({ companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId, warehouseId }).sort({ sku: 1 }).lean();
  const productIds = [...new Set(balances.map((item) => item.productId))];
  const variantIds = balances.map((item) => item.variantId).filter(Boolean);
  const [products, variants] = await Promise.all([
    ProductCatalogModel.find({ _id: { $in: productIds }, companyCode: normalizedCompany(scope.companyCode) }).select("name").lean(),
    ProductVariantModel.find({ _id: { $in: variantIds }, companyCode: normalizedCompany(scope.companyCode) }).select("barcode displayName trackingMode").lean(),
  ]);
  const productMap = new Map(products.map((item: any) => [String(item._id), item]));
  const variantMap = new Map(variants.map((item: any) => [String(item._id), item]));
  // Hàng theo dõi từng đơn vị đếm bằng cách quét, nên phải biết trước kho đang ghi những máy nào.
  const unitTrackedVariantIds = variants.filter((item: any) => isUnitTracked(item.trackingMode)).map((item: any) => String(item._id));
  const serialUnits = unitTrackedVariantIds.length
    ? await SerialUnitModel.find({ companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId, warehouseId, variantId: { $in: unitTrackedVariantIds }, status: "in_stock" }).select("variantId internalBarcode serialNumber").lean()
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
  if (!code(warehouseId)) fail("Kho kiểm kê là bắt buộc.");
  const items = await countItems(scope, warehouseId);
  const countCode = "KK-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  return InventoryCountModel.create({ companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId, warehouseId, countCode, status: "draft", items, notes: code(notes) || undefined, createdBy: nameOf(actor), version: 0 });
}

export async function updateCountItem(scope: Scope, countId: string, itemId: string, input: { countedQuantity?: unknown; note?: unknown }) {
  const count = await InventoryCountModel.findOne({ _id: countId, companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId });
  if (!count) fail("Không tìm thấy phiếu kiểm kê.", 404);
  assertEditableStatus(count.status as InventoryCountStatus);
  const item: any = count.items.find((entry: any) => String(entry._id) === itemId);
  if (!item) fail("Không tìm thấy dòng kiểm kê.", 404);
  // Hàng theo dõi từng đơn vị chỉ được đếm bằng quét, gõ tay sẽ phá mất đối chiếu theo máy.
  if (isUnitTracked(item.trackingMode) && input.countedQuantity !== undefined) fail(`SKU ${item.sku} phải đếm bằng cách quét mã nội bộ/IMEI từng máy.`);
  if (input.countedQuantity === undefined) {
    if (input.note !== undefined) item.note = code(input.note) || undefined;
    count.markModified("items");
    await count.save();
    return count.toObject();
  }
  const counted = Number(input.countedQuantity);
  item.countedQuantity = counted;
  item.quantityDelta = calculateQuantityDelta(Number(item.systemQuantity), counted);
  if (input.note !== undefined) item.note = code(input.note) || undefined;
  count.markModified("items");
  await count.save();
  return count.toObject();
}

/** Quét một mã nội bộ/IMEI trong lúc kiểm kê: đánh dấu đã thấy, hoặc xếp vào danh sách ngoài dự kiến. */
export async function scanCountUnit(scope: Scope, countId: string, rawCode: unknown) {
  const value = code(rawCode);
  if (!value) fail("Thiếu mã cần quét.");
  const count = await InventoryCountModel.findOne({ _id: countId, companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId });
  if (!count) fail("Không tìm thấy phiếu kiểm kê.", 404);
  assertEditableStatus(count.status as InventoryCountStatus);

  const unit: any = await SerialUnitModel.findOne({
    companyCode: normalizedCompany(scope.companyCode),
    $or: [{ normalizedSerialNumber: normalizeSerialNumber(value) }, { normalizedInternalBarcode: normalizeInternalBarcode(value) }],
  }).lean();

  const recordUnexpected = async (reason: "other_warehouse" | "sold" | "unknown" | "wrong_status") => {
    const scans = (count.unexpectedScans || []) as any[];
    // Quét lại cùng một mã không nhân bản cảnh báo.
    if (!scans.some((scan) => scan.code === value)) {
      scans.push({ code: value, reason, serialUnitId: unit ? String(unit._id) : undefined, sku: unit?.sku, productName: unit?.productName, warehouseId: unit?.warehouseId, status: unit?.status, scannedAt: new Date() });
      count.unexpectedScans = scans as any;
      count.markModified("unexpectedScans");
      await count.save();
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
  await count.save();
  return { outcome: "counted" as const, sku: item.sku, productName: item.productName, count: count.toObject() };
}

async function transition(scope: Scope, countId: string, status: InventoryCountStatus, actor: Actor) {
  const count = await InventoryCountModel.findOne({ _id: countId, companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId });
  if (!count) fail("Không tìm thấy phiếu kiểm kê.", 404);
  assertCountTransition(count.status as InventoryCountStatus, status);
  count.status = status;
  if (status === "pending_approval") { count.submittedBy = nameOf(actor); count.submittedAt = new Date(); }
  if (status === "cancelled") count.cancelledAt = new Date();
  await count.save();
  return count.toObject();
}
export const startCount = (scope: Scope, id: string, actor: Actor) => transition(scope, id, "counting", actor);
export const submitCount = (scope: Scope, id: string, actor: Actor) => transition(scope, id, "pending_approval", actor);
export const cancelCount = (scope: Scope, id: string, actor: Actor) => transition(scope, id, "cancelled", actor);

export async function approveCount(scope: Scope, countId: string, actor: Actor) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const count: any = await InventoryCountModel.findOne({ _id: countId, companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId }).session(session);
      if (!count) fail("Không tìm thấy phiếu kiểm kê.", 404);
      assertCountTransition(count.status as InventoryCountStatus, "completed");
      const filters = count.items.map((item: any) => ({ productId: item.productId, ...(item.variantId ? { variantId: item.variantId } : {}) }));
      const balances = await InventoryBalanceModel.find({ companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId, warehouseId: count.warehouseId, $or: filters }).session(session).lean();
      const balanceMap = new Map(balances.map((balance: any) => [String(balance.productId) + ":" + String(balance.variantId || ""), balance]));
      for (const item of count.items as any[]) {
        const balance: any = balanceMap.get(String(item.productId) + ":" + String(item.variantId || ""));
        if (!balance || Number(balance.version) !== Number(item.sourceBalanceVersion)) {
          count.status = "conflict";
          await count.save({ session });
          fail("Tồn kho đã thay đổi sau khi bắt đầu kiểm kê.", 409);
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
            { _id: entry.serialUnitId, companyCode: normalizedCompany(scope.companyCode), status: "in_stock" },
            { $set: { status: "lost", updatedBy: nameOf(actor) } },
            { returnDocument: 'after', session },
          );
          if (!updated) continue;
          await SerialEventModel.create([{ companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId, serialUnitId: String(entry.serialUnitId), serialNumber: updated.serialNumber, eventType: "count_lost", fromStatus: "in_stock", toStatus: "lost", documentType: "inventory-count", documentId: String(count._id), reason: `Kiểm kê ${count.countCode} không tìm thấy máy`, actorId: code(actor.id), actorName: nameOf(actor) }], { session });
        }
      }
      count.status = "completed";
      count.approvedBy = nameOf(actor);
      count.approvedAt = new Date();
      await count.save({ session });
    });
    return getCount(scope, countId);
  } catch (error: any) {
    if (Number(error?.statusCode) === 409) await InventoryCountModel.updateOne({ _id: countId, companyCode: normalizedCompany(scope.companyCode), branchId: scope.branchId }, { $set: { status: "conflict" } });
    throw error;
  } finally {
    await session.endSession();
  }
}
import mongoose from "mongoose";

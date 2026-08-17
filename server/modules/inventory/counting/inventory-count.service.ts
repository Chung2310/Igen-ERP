import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { InventoryCountModel } from "../../../model/inventory-count.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { assertCountTransition, assertEditableStatus, calculateQuantityDelta } from "./inventory-count.rules";
import type { InventoryCountStatus } from "../../../interface/inventory.interface";
import { writeStockMovement } from "../../../integrations/shared/stock-movement.service";

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
    ProductVariantModel.find({ _id: { $in: variantIds }, companyCode: normalizedCompany(scope.companyCode) }).select("barcode displayName").lean(),
  ]);
  const productMap = new Map(products.map((item: any) => [String(item._id), item]));
  const variantMap = new Map(variants.map((item: any) => [String(item._id), item]));
  return balances.map((balance: any) => {
    const product: any = productMap.get(String(balance.productId));
    const variant: any = balance.variantId ? variantMap.get(String(balance.variantId)) : undefined;
    const quantity = Number(balance.quantity || 0);
    return { productId: balance.productId, variantId: balance.variantId, sku: balance.sku, barcode: variant?.barcode, productName: variant?.displayName || product?.name || balance.sku, systemQuantity: quantity, countedQuantity: quantity, quantityDelta: 0, sourceBalanceVersion: Number(balance.version || 0) };
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
  const counted = Number(input.countedQuantity);
  item.countedQuantity = counted;
  item.quantityDelta = calculateQuantityDelta(Number(item.systemQuantity), counted);
  if (input.note !== undefined) item.note = code(input.note) || undefined;
  count.markModified("items");
  await count.save();
  return count.toObject();
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
      count.status = "completed";
      count.approvedBy = nameOf(actor);
      count.approvedAt = new Date();
      await count.save({ session });
    });
    return getCount(scope, countId);
  } finally {
    await session.endSession();
  }
}
import mongoose from "mongoose";

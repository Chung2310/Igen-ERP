import type { ClientSession } from "mongoose";
import { InventoryBalanceModel } from "../../model/inventory-balance.model";
import { InventoryLedgerEntryModel } from "../../model/inventory-ledger-entry.model";
import { ProductModel } from "../../model/product.model";
import { StockLogModel } from "../../model/stock-log.model";
import type { InventoryMovementDirection, InventoryMovementPurpose } from "../../interface/inventory.interface";
import { ensureDefaultWarehouse } from "../../modules/inventory/warehouse/warehouse.service";
import { WarehouseModel } from "../../model/warehouse.model";

export interface StockMovementItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitCost?: number;
  unitPrice?: number;
  lineTotal?: number;
  category?: string;
  variantId?: string;
  legacyProductId?: string;
}

export interface WriteStockMovementInput {
  companyCode: string;
  branchId: string;
  direction: InventoryMovementDirection;
  purpose: InventoryMovementPurpose;
  sourceType: string;
  sourceId: string;
  sourceCode?: string;
  idempotencyKey: string;
  operatorName: string;
  items: StockMovementItem[];
  allowNegativeStock?: boolean;
  reason?: string;
  session?: ClientSession;
  writeLegacyStockLog?: boolean;
  warehouseId?: string;
}

function duplicate(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === 11000);
}

function normalizeCode(value: string) {
  return String(value || "").trim().toUpperCase();
}

function validateInput(input: WriteStockMovementInput) {
  if (!normalizeCode(input.companyCode) || !String(input.branchId || "").trim()) throw new Error("Phạm vi công ty và chi nhánh là bắt buộc.");
  if (!String(input.sourceType || "").trim() || !String(input.sourceId || "").trim()) throw new Error("Chứng từ nguồn của biến động tồn là bắt buộc.");
  if (!String(input.idempotencyKey || "").trim()) throw new Error("Idempotency key của biến động tồn là bắt buộc.");
  if (!input.items.length) throw new Error("Biến động tồn phải có ít nhất một sản phẩm.");
  for (const item of input.items) {
    if (!String(item.productId || "").trim() || !String(item.sku || "").trim() || !String(item.productName || "").trim()) throw new Error("Dòng biến động tồn thiếu sản phẩm.");
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) throw new Error("Số lượng biến động tồn không hợp lệ.");
    if (item.unitCost !== undefined && (!Number.isFinite(item.unitCost) || item.unitCost < 0)) throw new Error("Giá vốn không hợp lệ.");
  }
}

async function ensureBalance(input: { companyCode: string; branchId: string; warehouseId: string; item: StockMovementItem; session: ClientSession }) {
  const existing = await InventoryBalanceModel.findOne({ companyCode: input.companyCode, warehouseId: input.warehouseId, productId: input.item.productId, ...(input.item.variantId ? { variantId: input.item.variantId } : {}) }).session(input.session);
  if (existing) return existing;

  const legacyProduct = input.item.legacyProductId
    ? await ProductModel.findOne({ _id: input.item.legacyProductId, companyCode: input.companyCode, branchId: input.branchId }).session(input.session).lean()
    : null;
  try {
    return await InventoryBalanceModel.findOneAndUpdate(
      { companyCode: input.companyCode, warehouseId: input.warehouseId, productId: input.item.productId, ...(input.item.variantId ? { variantId: input.item.variantId } : {}) },
      { $setOnInsert: { companyCode: input.companyCode, branchId: input.branchId, warehouseId: input.warehouseId, productId: input.item.productId, ...(input.item.variantId ? { variantId: input.item.variantId } : {}), sku: input.item.sku, quantity: Number(legacyProduct?.stock || 0), reservedQuantity: 0, averageCost: Number(legacyProduct?.costPrice || input.item.unitCost || 0), version: 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: true, session: input.session },
    );
  } catch (error) {
    if (!duplicate(error)) throw error;
    return InventoryBalanceModel.findOne({ companyCode: input.companyCode, warehouseId: input.warehouseId, productId: input.item.productId, ...(input.item.variantId ? { variantId: input.item.variantId } : {}) }).session(input.session);
  }
}

export async function writeStockMovement(input: WriteStockMovementInput) {
  validateInput(input);
  const companyCode = normalizeCode(input.companyCode);
  const branchId = String(input.branchId).trim();
  const existing = await InventoryLedgerEntryModel.find({ companyCode, idempotencyKey: input.idempotencyKey }).session(input.session).lean();
  if (existing.length) return { warehouseId: existing[0].warehouseId, entries: existing, replayed: true };

  const warehouse = input.warehouseId
    ? await WarehouseModel.findOne({ _id: input.warehouseId, companyCode, branchId, isActive: true }).session(input.session).lean()
    : await ensureDefaultWarehouse(companyCode, branchId, input.session);
  if (!warehouse) throw new Error("Không thể xác định kho mặc định của chi nhánh.");
  const entries: Array<Record<string, unknown>> = [];
  for (const [sourceLine, item] of input.items.entries()) {
    const quantity = Number(item.quantity);
    const unitCost = Number(item.unitCost || 0);
    const balance = await ensureBalance({ companyCode, branchId, warehouseId: String(warehouse._id), item, session: input.session });
    const currentQuantity = Number(balance.quantity || 0);
    const reservedQuantity = Number(balance.reservedQuantity || 0);
    const delta = input.direction === "out" ? -quantity : quantity;
    if (input.direction === "out" && !input.allowNegativeStock && currentQuantity - reservedQuantity < quantity) {
      throw Object.assign(new Error(`Sản phẩm ${item.sku} không đủ tồn khả dụng.`), { code: "INSUFFICIENT_STOCK", status: 409, details: { sku: item.sku, requested: quantity, available: Math.max(0, currentQuantity - reservedQuantity) } });
    }
    const nextQuantity = currentQuantity + delta;
    const nextAverageCost = input.direction === "in" && nextQuantity > 0
      ? ((currentQuantity * Number(balance.averageCost || 0)) + quantity * unitCost) / nextQuantity
      : Number(balance.averageCost || unitCost || 0);
    const balanceUpdate = await InventoryBalanceModel.findOneAndUpdate(
      { _id: balance._id, version: Number(balance.version || 0), ...(input.direction === "out" && !input.allowNegativeStock ? { $expr: { $gte: [{ $subtract: ["$quantity", "$reservedQuantity"] }, quantity] } } : {}) },
      { $set: { quantity: nextQuantity, averageCost: nextAverageCost }, $inc: { version: 1 } },
      { new: true, session: input.session },
    );
    if (!balanceUpdate) throw Object.assign(new Error(`Số tồn của ${item.sku} vừa thay đổi, vui lòng thử lại.`), { code: "INVENTORY_CONFLICT", status: 409 });

    if (item.legacyProductId) {
      const legacyFilter: Record<string, unknown> = { _id: item.legacyProductId, companyCode, branchId };
      if (input.direction === "out" && !input.allowNegativeStock) legacyFilter.stock = { $gte: quantity };
      const legacyUpdate = await ProductModel.updateOne(legacyFilter, { $inc: { stock: delta } }, { session: input.session });
      if (legacyUpdate.modifiedCount !== 1) throw Object.assign(new Error(`Không thể đồng bộ tồn cũ của ${item.sku}.`), { code: "LEGACY_STOCK_CONFLICT", status: 409 });
    }

    entries.push({ companyCode, branchId, warehouseId: String(warehouse._id), productId: item.productId, ...(item.variantId ? { variantId: item.variantId } : {}), sku: item.sku, productName: item.productName, direction: input.direction, purpose: input.purpose, quantity, quantityDelta: delta, unitCost, unitPrice: item.unitPrice, sourceType: input.sourceType, sourceId: input.sourceId, sourceCode: input.sourceCode, sourceLine, idempotencyKey: input.idempotencyKey, operatorName: input.operatorName, reason: input.reason });
  }

  try {
    const created = await InventoryLedgerEntryModel.create(entries, { session: input.session });
    if (input.writeLegacyStockLog !== false) {
      await StockLogModel.create([{ type: input.direction === "out" ? "xuất" : "nhập", title: input.sourceCode ? `${input.sourceCode} - ${input.purpose}` : input.sourceType, items: input.items.map((item) => ({ productId: item.productId, sku: item.sku, productName: item.productName, quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.lineTotal, unitCost: item.unitCost, category: item.category })), purpose: input.direction === "out" ? (input.purpose === "sale" ? "bán" : input.purpose === "cancel" ? "hủy" : input.purpose === "transfer" ? "chuyển kho" : "nội bộ") : undefined, operatorName: input.operatorName, status: "Thành công", companyCode, branchId, refType: input.sourceType === "retail-order" ? "retail-order" : input.sourceType === "goods-receipt" ? "goods-receipt" : undefined, refId: input.sourceId, idempotencyKey: input.idempotencyKey, notes: input.reason }], { session: input.session });
    }
    return { warehouseId: String(warehouse._id), entries: created, replayed: false };
  } catch (error) {
    if (!duplicate(error)) throw error;
    const replayed = await InventoryLedgerEntryModel.find({ companyCode, idempotencyKey: input.idempotencyKey }).session(input.session).lean();
    return { warehouseId: String(warehouse._id), entries: replayed, replayed: true };
  }
}

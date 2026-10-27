import type { ClientSession } from "mongoose";
import { InventoryBalanceModel } from "../../model/inventory-balance.model";
import { InventoryLedgerEntryModel } from "../../model/inventory-ledger-entry.model";
import { ProductModel } from "../../model/product.model";
import { StockLogModel } from "../../model/stock-log.model";
import type { InventoryMovementDirection, InventoryMovementPurpose } from "../../interface/inventory.interface";
import { ensureDefaultWarehouse } from "../../modules/inventory/warehouse/warehouse.service";
import { WarehouseModel } from "../../model/warehouse.model";
import { runInventoryTransaction } from "./inventory-transaction";
import { stockQuantityTolerance } from "./inventory-quantity";

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

async function ensureBalance(input: { companyCode: string; branchId: string; warehouseId: string; isDefaultWarehouse: boolean; item: StockMovementItem; session: ClientSession }) {
  const variantFilter = { variantId: input.item.variantId || { $exists: false } };
  // Thiếu variantId thì filter theo productId là chưa đủ: nó khớp bừa một dòng biến
  // thể bất kỳ của cùng sản phẩm (thường là dòng tồn 0), nên phải ưu tiên tra theo
  // SKU — SKU chính là mã biến thể.
  if (!input.item.variantId) {
    const bySku = await InventoryBalanceModel.findOne({ companyCode: input.companyCode, warehouseId: input.warehouseId, productId: input.item.productId, sku: normalizeCode(input.item.sku) }).session(input.session);
    if (bySku) return bySku;
  }
  const existing = await InventoryBalanceModel.findOne({ companyCode: input.companyCode, warehouseId: input.warehouseId, productId: input.item.productId, ...variantFilter }).session(input.session);
  if (existing) return existing;

  const legacyProduct = input.item.legacyProductId
    ? await ProductModel.findOne({ _id: input.item.legacyProductId, companyCode: input.companyCode, branchId: input.branchId }).session(input.session).lean()
    : null;
  // The legacy stock field is a branch total. Only its unallocated remainder
  // belongs to a newly created default balance; another warehouse starts at zero.
  const allocated = legacyProduct && input.isDefaultWarehouse
    ? await InventoryBalanceModel.find({ companyCode: input.companyCode, branchId: input.branchId, productId: input.item.productId, variantId: { $exists: false } }).select("quantity").session(input.session).lean()
    : [];
  const initialQuantity = legacyProduct && input.isDefaultWarehouse
    ? Number(legacyProduct.stock || 0) - allocated.reduce((sum, balance) => sum + Number(balance.quantity || 0), 0) : 0;
  return InventoryBalanceModel.findOneAndUpdate(
    { companyCode: input.companyCode, warehouseId: input.warehouseId, productId: input.item.productId, ...variantFilter },
    { $setOnInsert: { companyCode: input.companyCode, branchId: input.branchId, warehouseId: input.warehouseId, productId: input.item.productId, ...(input.item.variantId ? { variantId: input.item.variantId } : {}), sku: input.item.sku, quantity: initialQuantity, reservedQuantity: 0, averageCost: Number(legacyProduct?.costPrice ?? input.item.unitCost ?? 0), version: 0 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session: input.session },
  );
}

function assertReplay(input: WriteStockMovementInput, entries: any[]) {
  const matches = entries.length === input.items.length && entries.every((entry, index) => {
    const item = input.items[index];
    return entry.branchId === String(input.branchId).trim()
      && (!input.warehouseId || entry.warehouseId === input.warehouseId)
      && entry.sourceType === input.sourceType && entry.sourceId === input.sourceId
      && entry.direction === input.direction && entry.purpose === input.purpose
      && entry.productId === item.productId && entry.sku === normalizeCode(item.sku)
      && (!item.variantId || entry.variantId === item.variantId)
      && Number(entry.quantity) === Number(item.quantity)
      && (input.direction === "out" || item.unitCost === undefined || Number(entry.unitCost) === Number(item.unitCost));
  });
  if (!matches) throw Object.assign(new Error("Khóa biến động tồn đã được dùng cho một giao dịch khác."), { code: "INVENTORY_IDEMPOTENCY_CONFLICT", status: 409 });
}

export async function writeStockMovement(input: WriteStockMovementInput) {
  validateInput(input);
  if (input.session) return writeStockMovementInSession(input);
  try {
    return await runInventoryTransaction((session) => writeStockMovementInSession({ ...input, session }));
  } catch (error) {
    if (!duplicate(error)) throw error;
    const entries = await InventoryLedgerEntryModel.find({ companyCode: normalizeCode(input.companyCode), idempotencyKey: input.idempotencyKey }).sort({ sourceLine: 1 }).lean();
    if (!entries.length) throw error;
    assertReplay(input, entries);
    return { warehouseId: entries[0].warehouseId, entries, replayed: true };
  }
}

async function writeStockMovementInSession(input: WriteStockMovementInput) {
  const companyCode = normalizeCode(input.companyCode);
  const branchId = String(input.branchId).trim();
  const existing = await InventoryLedgerEntryModel.find({ companyCode, idempotencyKey: input.idempotencyKey }).sort({ sourceLine: 1 }).session(input.session).lean();
  if (existing.length) {
    assertReplay(input, existing);
    return { warehouseId: existing[0].warehouseId, entries: existing, replayed: true };
  }

  const warehouse = input.warehouseId
    ? await WarehouseModel.findOne({ _id: input.warehouseId, companyCode, branchId, isActive: true }).session(input.session).lean()
    : await ensureDefaultWarehouse(companyCode, branchId, input.session);
  if (!warehouse) throw new Error("Không thể xác định kho mặc định của chi nhánh.");
  const entries: Array<StockMovementItem & Record<string, unknown>> = [];
  for (const [sourceLine, item] of input.items.entries()) {
    const quantity = Number(item.quantity);
    const balance = await ensureBalance({ companyCode, branchId, warehouseId: String(warehouse._id), isDefaultWarehouse: Boolean(warehouse.isDefault), item, session: input.session });
    const unitCost = input.direction === "out" ? Number(balance.averageCost || 0) : Number(item.unitCost ?? balance.averageCost ?? 0);
    const currentQuantity = Number(balance.quantity || 0);
    const reservedQuantity = Number(balance.reservedQuantity || 0);
    const tolerance = stockQuantityTolerance(currentQuantity, reservedQuantity, quantity);
    const delta = input.direction === "out" ? -quantity : quantity;
    if (input.direction === "out" && !input.allowNegativeStock && currentQuantity - reservedQuantity + tolerance < quantity) {
      throw Object.assign(new Error(`Sản phẩm ${item.sku} không đủ tồn khả dụng.`), { code: "INSUFFICIENT_STOCK", status: 409, details: { sku: item.sku, requested: quantity, available: Math.max(0, currentQuantity - reservedQuantity) } });
    }
    const rawNextQuantity = currentQuantity + delta;
    const nextQuantity = input.direction === "out" && !input.allowNegativeStock && Math.abs(rawNextQuantity - reservedQuantity) <= tolerance ? reservedQuantity : rawNextQuantity;
    const nextAverageCost = input.direction === "in"
      ? currentQuantity <= 0 ? unitCost : ((currentQuantity * Number(balance.averageCost || 0)) + quantity * unitCost) / nextQuantity
      : Number(balance.averageCost || 0);
    const balanceUpdate = await InventoryBalanceModel.findOneAndUpdate(
      { _id: balance._id, version: Number(balance.version || 0), ...(input.direction === "out" && !input.allowNegativeStock ? { $expr: { $gte: [{ $subtract: ["$quantity", "$reservedQuantity"] }, quantity - tolerance] } } : {}) },
      { $set: { quantity: nextQuantity, averageCost: nextAverageCost }, $inc: { version: 1 } },
      { returnDocument: 'after', session: input.session },
    );
    if (!balanceUpdate) throw Object.assign(new Error(`Số tồn của ${item.sku} vừa thay đổi, vui lòng thử lại.`), { code: "INVENTORY_CONFLICT", status: 409 });

    if (item.legacyProductId) {
      const legacyFilter: Record<string, unknown> = { _id: item.legacyProductId, companyCode, branchId };
      const protectedOutbound = input.direction === "out" && !input.allowNegativeStock;
      if (protectedOutbound) legacyFilter.stock = { $gte: quantity - tolerance };
      const legacyUpdate = await ProductModel.updateOne(legacyFilter,
        protectedOutbound ? [{ $set: { stock: { $max: [0, { $add: ["$stock", delta] }] } } }] : { $inc: { stock: delta } },
        { session: input.session, ...(protectedOutbound ? { updatePipeline: true } : {}) });
      if (legacyUpdate.modifiedCount !== 1) throw Object.assign(new Error(`Không thể đồng bộ tồn cũ của ${item.sku}.`), { code: "LEGACY_STOCK_CONFLICT", status: 409 });
    }

    entries.push({ companyCode, branchId, warehouseId: String(warehouse._id), productId: item.productId, ...(balance.variantId ? { variantId: balance.variantId } : {}), sku: item.sku, productName: item.productName, direction: input.direction, purpose: input.purpose, quantity, quantityDelta: delta, unitCost, unitPrice: item.unitPrice, sourceType: input.sourceType, sourceId: input.sourceId, sourceCode: input.sourceCode, sourceLine, idempotencyKey: input.idempotencyKey, operatorName: input.operatorName, reason: input.reason });
  }

  const created = await InventoryLedgerEntryModel.create(entries, { session: input.session, ordered: true });
  if (input.writeLegacyStockLog !== false) {
    await StockLogModel.create([{ type: input.direction === "out" ? "xuất" : "nhập", title: input.sourceCode ? `${input.sourceCode} - ${input.purpose}` : input.sourceType, items: input.items.map((item, index) => ({ productId: item.productId, variantId: entries[index].variantId, sku: item.sku, productName: item.productName, quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.lineTotal, unitCost: entries[index].unitCost, category: item.category })), purpose: input.direction === "out" ? (input.purpose === "sale" ? "bán" : input.purpose === "cancel" ? "hủy" : input.purpose === "transfer" ? "chuyển kho" : "nội bộ") : undefined, operatorName: input.operatorName, status: "Thành công", companyCode, branchId, warehouseId: String(warehouse._id), refType: input.sourceType === "retail-order" ? "retail-order" : input.sourceType === "goods-receipt" ? "goods-receipt" : undefined, refId: input.sourceId, idempotencyKey: input.idempotencyKey, notes: input.reason }], { session: input.session });
  }
  return { warehouseId: String(warehouse._id), entries: created, replayed: false };
}

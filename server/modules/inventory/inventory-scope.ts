import { Types, type ClientSession } from "mongoose";
import { WarehouseModel } from "../../model/warehouse.model";
import { BranchModel } from "../../model/branch.model";
import { ProductVariantModel } from "../../model/product-variant.model";
import { ProductCatalogModel } from "../../model/product-catalog.model";
import { ensureDefaultWarehouse } from "./warehouse/warehouse.service";

export type InventoryScope = { companyCode: string; branchId: string; warehouseId?: string };
export function inventoryError(message: string, statusCode = 400): never {
  throw Object.assign(new Error(message), { statusCode });
}

export function rejectScopeOverrides(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) inventoryError("Dữ liệu kho không hợp lệ.");
  for (const key of ["companyCode", "branchId", "_id", "createdBy", "updatedBy"]) {
    if (Object.prototype.hasOwnProperty.call(input, key)) inventoryError(`Không được truyền trường ${key}.`);
  }
}

export async function resolveInventoryWarehouse(scope: InventoryScope, warehouseId: unknown, session: ClientSession) {
  if (!scope.companyCode || !Types.ObjectId.isValid(scope.branchId)) inventoryError("Phạm vi kho không hợp lệ.");
  const branch = await BranchModel.exists({ _id: scope.branchId, companyCode: scope.companyCode, isActive: true }).session(session);
  if (!branch) inventoryError("Chi nhánh không thuộc công ty hoặc đã ngừng hoạt động.");
  const id = String(warehouseId || scope.warehouseId || "").trim();
  if (scope.warehouseId && id !== scope.warehouseId) inventoryError("Kho không thuộc phạm vi đang thao tác.");
  if (id && !Types.ObjectId.isValid(id)) inventoryError("Kho không hợp lệ.");
  const warehouse = id
    ? await WarehouseModel.findOne({ _id: id, companyCode: scope.companyCode, branchId: scope.branchId, isActive: true }).session(session).lean()
    : await ensureDefaultWarehouse(scope.companyCode, scope.branchId, session);
  if (!warehouse?.isActive) inventoryError("Không tìm thấy kho đang hoạt động trong chi nhánh.");
  if (warehouse.kind === "transit") inventoryError("Hàng đang vận chuyển chỉ được xử lý qua chứng từ điều chuyển.", 409);
  return warehouse;
}

export async function resolveInventoryVariant(companyCode: string, input: { productId?: unknown; variantId?: unknown; sku?: unknown }, session: ClientSession) {
  const productId = String(input.productId || "").trim();
  const variantId = String(input.variantId || "").trim();
  const sku = String(input.sku || "").trim().toUpperCase();
  if (!Types.ObjectId.isValid(productId) || (variantId && !Types.ObjectId.isValid(variantId))) inventoryError("Sản phẩm/SKU không hợp lệ.");
  const variant = await ProductVariantModel.findOne({ companyCode, productId, status: "active", ...(variantId ? { _id: variantId } : { sku }) }).session(session).lean();
  if (!variant || (sku && variant.sku !== sku)) inventoryError("SKU không khớp sản phẩm hoặc đã ngừng dùng.");
  const product = await ProductCatalogModel.findOne({ _id: productId, companyCode, productType: { $in: ["physical", "bundle"] }, status: { $in: ["active", "draft"] } }).session(session).lean();
  if (!product) inventoryError("Không tìm thấy sản phẩm có thể nhập xuất kho.");
  return { product, variant };
}

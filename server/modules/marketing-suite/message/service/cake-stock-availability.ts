import { BranchModel } from "../../../../model/branch.model";
import { InventoryBalanceModel } from "../../../../model/inventory-balance.model";
import { ProductCatalogModel } from "../../../../model/product-catalog.model";
import { ProductVariantModel } from "../../../../model/product-variant.model";
import { WarehouseModel } from "../../../../model/warehouse.model";
import { matchCakeBranchLocation } from "./cake-branch-location";

export type CakeStockCheck = {
  status: "available" | "insufficient" | "untracked" | "unknown";
  availableQuantity?: number;
  branchName?: string;
};

export async function checkCakeStockAtBranch(input: {
  companyCode: string; branchId: string; sku: string; quantity: number;
}): Promise<CakeStockCheck> {
  const companyCode = input.companyCode.trim().toUpperCase();
  const variant = await ProductVariantModel.findOne({ companyCode, sku: input.sku.trim().toUpperCase(), status: "active" })
    .select("_id productId trackingMode").lean();
  if (!variant || variant.trackingMode === "none") return { status: "untracked" };
  const product = await ProductCatalogModel.findOne({ companyCode, _id: variant.productId, status: "active" }).select("productType").lean();
  if (!product || product.productType !== "physical") return { status: "untracked" };
  const warehouse = await WarehouseModel.findOne({ companyCode, branchId: input.branchId, isDefault: true, isActive: true })
    .select("_id").lean();
  if (!warehouse) return { status: "unknown" };
  const balances = await InventoryBalanceModel.find({ companyCode, branchId: input.branchId, warehouseId: String(warehouse._id), variantId: String(variant._id) })
    .select("quantity reservedQuantity").lean();
  const availableQuantity = balances.reduce((total, row) => total + Math.max(0, Number(row.quantity || 0) - Number(row.reservedQuantity || 0)), 0);
  return { status: availableQuantity >= input.quantity ? "available" : "insufficient", availableQuantity };
}

export async function checkCakeStockAtLocation(input: {
  companyCode: string; location: string; sku: string; quantity: number;
}): Promise<CakeStockCheck> {
  const companyCode = input.companyCode.trim().toUpperCase();
  const branches = await BranchModel.find({ companyCode, isActive: true }).select("_id code name address").lean();
  const branch = matchCakeBranchLocation(branches, input.location) || (branches.length === 1 ? branches[0] : undefined);
  if (!branch) return { status: "unknown" };
  const result = await checkCakeStockAtBranch({ ...input, companyCode, branchId: String(branch._id) });
  return { ...result, branchName: branch.name };
}

import { CompanyModel } from "../../../model/company.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductModel } from "../../../model/product.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { ProductPriceModel } from "../../../model/product-price.model";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { WarehouseModel } from "../../../model/warehouse.model";
import { SerialUnitModel } from "../serials/serial-unit.model";
import { INVENTORY_WORKSPACE_MODES, type CatalogBranchSummary, type CatalogWorkspaceSettings, type InventoryWorkspaceMode } from "../../../../shared/inventory/catalog-workspace";

export async function readCatalogWorkspace(companyCode: string): Promise<CatalogWorkspaceSettings> {
  const [company, serialVariant] = await Promise.all([
    CompanyModel.findOne({ code: companyCode }).select("inventoryWorkspaceMode businessType").lean(),
    ProductVariantModel.exists({ companyCode, trackingMode: { $in: ["serial", "unit_barcode"] } }),
  ]);
  const hasSerial = Boolean(serialVariant || await SerialUnitModel.exists({ companyCode }));
  if (company?.inventoryWorkspaceMode) return { mode: company.inventoryWorkspaceMode, configured: true, hasSerial };

  const [goods, services] = await Promise.all([
    ProductCatalogModel.exists({ companyCode, productType: { $in: ["physical", "bundle"] } }),
    ProductCatalogModel.exists({ companyCode, productType: "service" }),
  ]);
  const hasGoods = Boolean(goods || hasSerial || await ProductModel.exists({ companyCode }));
  const serviceBusiness = company?.businessType === "service" || company?.businessType === "education";
  const mode = hasGoods ? services ? "mixed" : "goods" : services || serviceBusiness ? "services" : "goods";
  return { mode, configured: false, hasSerial };
}

export async function updateCatalogWorkspace(companyCode: string, mode: unknown) {
  if (!INVENTORY_WORKSPACE_MODES.some(option => option === mode)) {
    throw Object.assign(new Error("Chế độ danh mục không hợp lệ."), { statusCode: 400 });
  }
  const company = await CompanyModel.updateOne(
    { code: companyCode }, { $set: { inventoryWorkspaceMode: mode as InventoryWorkspaceMode } }, { runValidators: true },
  );
  if (!company.matchedCount) throw Object.assign(new Error("Không tìm thấy doanh nghiệp."), { statusCode: 404 });
  return readCatalogWorkspace(companyCode);
}

export async function readCatalogBranchSummaries(
  companyCode: string,
  branchId: string,
  products: Array<{ _id: unknown; productType: string; serviceBranchIds?: string[] }>,
) {
  if (!products.length) return new Map<string, CatalogBranchSummary>();
  const productIds = products.map(product => String(product._id));
  const variants = await ProductVariantModel.find({ companyCode, productId: { $in: productIds }, status: "active" })
    .select("_id productId trackingMode").lean();
  const productsById = new Map(products.map(product => [String(product._id), product]));
  const activeVariants = new Map(variants.map(variant => [String(variant._id), variant]));
  const trackedVariants = variants.filter(variant =>
    productsById.get(variant.productId)?.productType !== "service" && variant.trackingMode !== "none");
  const [prices, warehouses] = await Promise.all([
    ProductPriceModel.find({ companyCode, branchId, productId: { $in: productIds }, status: "active" })
      .select("variantId sellingPrice").lean(),
    trackedVariants.length ? WarehouseModel.find({ companyCode, branchId, isActive: true, kind: "selling" }).select("_id").lean() : [],
  ]);
  const balances = warehouses.length ? await InventoryBalanceModel.find({
    companyCode, branchId, warehouseId: { $in: warehouses.map(warehouse => String(warehouse._id)) },
    variantId: { $in: trackedVariants.map(variant => String(variant._id)) },
  }).select("variantId quantity reservedQuantity").lean() : [];
  const summaries = new Map<string, CatalogBranchSummary>(productIds.map(id => [
    id, { sellingPriceMin: null, sellingPriceMax: null, availableStock: null },
  ]));
  for (const variant of trackedVariants) summaries.get(variant.productId)!.availableStock = 0;
  for (const balance of balances) {
    const summary = summaries.get(activeVariants.get(balance.variantId || "")?.productId || "");
    if (summary?.availableStock != null) summary.availableStock += Math.max(0, balance.quantity - (balance.reservedQuantity ?? 0));
  }
  for (const price of prices) {
    const productId = activeVariants.get(price.variantId)?.productId;
    if (!productId) continue;
    const product = productsById.get(productId);
    if (product?.serviceBranchIds?.length && !product.serviceBranchIds.includes(branchId)) continue;
    const summary = summaries.get(productId)!;
    summary.sellingPriceMin = Math.min(summary.sellingPriceMin ?? price.sellingPrice, price.sellingPrice);
    summary.sellingPriceMax = Math.max(summary.sellingPriceMax ?? price.sellingPrice, price.sellingPrice);
  }
  return summaries;
}

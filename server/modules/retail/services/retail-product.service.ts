import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductCatalogLegacyMappingModel } from "../../../model/product-catalog-legacy-mapping.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { ProductPriceModel } from "../../../model/product-price.model";
import type { RetailBranchScope } from "../contracts";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function normalizeRetailProductSearch(query: any) {
  return {
    q: String(query?.q || "").trim(),
    barcode: String(query?.barcode || "").trim(),
    page: Math.max(1, Number(query?.page) || 1),
    limit: Math.min(500, Math.max(1, Number(query?.limit) || 20)),
  };
}

export function buildRetailProductFilter(scope: RetailBranchScope, query: any) {
  const normalized = normalizeRetailProductSearch(query);
  return { scope: { ...scope }, search: escapeRegex(normalized.q), ...normalized };
}

export const RetailProductService = {
  async search(scope: RetailBranchScope, query: any) {
    const { q, barcode, page, limit, search } = buildRetailProductFilter(scope, query);
    const balances: any[] = await InventoryBalanceModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, $expr: { $gt: [{ $subtract: ["$quantity", "$reservedQuantity"] }, 0] } }).lean();
    const variantIds = balances.map((item) => String(item.variantId || "")).filter(Boolean);
    const variantFilter: any = { companyCode: scope.companyCode, _id: { $in: variantIds }, status: "active" };
    if (barcode) variantFilter.$or = [{ barcode }, { sku: barcode }];
    else if (q) variantFilter.$or = [{ sku: { $regex: search, $options: "i" } }, { barcode: { $regex: search, $options: "i" } }];
    const variants: any[] = await ProductVariantModel.find(variantFilter).lean();
    const products: any[] = await ProductCatalogModel.find({ companyCode: scope.companyCode, _id: { $in: [...new Set(variants.map((item) => String(item.productId)))] }, status: "active" }).lean();
    const prices: any[] = await ProductPriceModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, variantId: { $in: variantIds }, status: "active" }).lean();
    const balanceByVariant = new Map(balances.map((item) => [String(item.variantId), item]));
    const productById = new Map(products.map((item) => [String(item._id), item]));
    const priceByVariant = new Map(prices.map((item) => [String(item.variantId), item]));
    const items: any[] = variants.map((variant) => { const product = productById.get(String(variant.productId)); const price = priceByVariant.get(String(variant._id)); const balance = balanceByVariant.get(String(variant._id)); if (!product || !price) return null; return { _id: String(variant._id), productId: String(product._id), variantId: String(variant._id), sku: variant.sku, barcode: variant.barcode, name: `${product.name} - ${variant.displayName || variant.sku}`, variantName: variant.displayName || variant.sku, category: product.categoryCode, brand: product.brandCode, unit: variant.unitCode, stock: Number(balance.quantity || 0) - Number(balance.reservedQuantity || 0), price: Number(price.sellingPrice), costPrice: Number(price.costPrice || balance.averageCost || 0), trackingMode: variant.trackingMode }; }).filter(Boolean);
    const filteredItems = q && !barcode ? items.filter((item) => item.name.toLowerCase().includes(q.toLowerCase()) || item.sku.toLowerCase().includes(q.toLowerCase()) || item.barcode?.toLowerCase().includes(q.toLowerCase())) : items;
    const total = filteredItems.length;
    const pageItems = filteredItems.slice((page - 1) * limit, page * limit);
    return { items: pageItems, total, page, limit };
  },
};

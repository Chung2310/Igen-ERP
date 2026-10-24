import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductCatalogLegacyMappingModel } from "../../../model/product-catalog-legacy-mapping.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { ProductPriceModel } from "../../../model/product-price.model";
import { ProductCatalogBrandModel, ProductCatalogCategoryModel } from "../../../model/product-catalog-resource.model";
import type { RetailBranchScope } from "../contracts";
import { SerialUnitModel } from "../../inventory/serials/serial-unit.model";
import { ensureDefaultWarehouse } from "../../inventory/warehouse/warehouse.service";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function buildRetailCategoryPath(code: string, categories: Map<string, { code: string; name: string; parentCode?: string }>) {
  const path: Array<{ code: string; name: string }> = [];
  const visited = new Set<string>();
  let current = code;
  while (current && !visited.has(current)) {
    visited.add(current);
    const category = categories.get(current);
    path.unshift({ code: current, name: category?.name || current });
    current = category?.parentCode || "";
  }
  return path;
}

export function matchesScannedUnit(unit: any, variant: any) {
  if (!unit) return false;
  return unit.variantId ? String(unit.variantId) === String(variant._id) : String(unit.productId) === String(variant.productId);
}

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
  const search = escapeRegex(normalized.q);
  return {
    scope: { ...scope },
    search,
    productNameFilter: { $regex: search, $options: "i" },
    ...normalized,
  };
}

export const RetailProductService = {
  async search(scope: RetailBranchScope, query: any) {
    const { q, barcode, page, limit, search, productNameFilter } = buildRetailProductFilter(scope, query);
    const defaultWarehouse = await ensureDefaultWarehouse(scope.companyCode, scope.branchId);
    // Keep zero-stock variants visible in POS so cashiers can explain availability
    // and select another SKU. Checkout still revalidates stock in the order service.
    const prices: any[] = await ProductPriceModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, status: "active" }).lean();
    const variantIds = prices.map((item) => String(item.variantId || "")).filter(Boolean);
    const balances: any[] = await InventoryBalanceModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: String(defaultWarehouse._id), variantId: { $in: variantIds } }).lean();
    const scannedUnit: any = barcode ? await SerialUnitModel.findOne({ companyCode: scope.companyCode, branchId: scope.branchId, status: "in_stock", $or: [{ normalizedSerialNumber: barcode.toUpperCase() }, { normalizedInternalBarcode: barcode.toUpperCase() }] }).lean() : null;
    const productIdsByName = q && !barcode
      ? (await ProductCatalogModel.find({ companyCode: scope.companyCode, status: "active", name: productNameFilter }).lean()).map((item: any) => String(item._id))
      : [];
    const variantFilter: any = { companyCode: scope.companyCode, _id: { $in: variantIds }, status: "active" };
    if (barcode) variantFilter.$or = [{ barcode }, { sku: barcode }, ...(scannedUnit ? [scannedUnit.variantId ? { _id: String(scannedUnit.variantId) } : { productId: String(scannedUnit.productId) }] : [])];
    else if (q) variantFilter.$or = [{ sku: { $regex: search, $options: "i" } }, { barcode: { $regex: search, $options: "i" } }, ...(productIdsByName.length ? [{ productId: { $in: productIdsByName } }] : [])];
    const variants: any[] = await ProductVariantModel.find(variantFilter).lean();
    const products: any[] = await ProductCatalogModel.find({ companyCode: scope.companyCode, _id: { $in: [...new Set(variants.map((item) => String(item.productId)))] }, status: "active" }).lean();
    const balanceByVariant = new Map<string, any>();
    for (const item of balances) {
      const key = String(item.variantId);
      const current = balanceByVariant.get(key) || { quantity: 0, reservedQuantity: 0, averageCost: 0 };
      const quantity = Number(item.quantity || 0); const reservedQuantity = Number(item.reservedQuantity || 0);
      const totalQuantity = current.quantity + quantity;
      current.averageCost = totalQuantity > 0 ? ((current.averageCost * current.quantity) + (Number(item.averageCost || 0) * quantity)) / totalQuantity : 0;
      current.quantity = totalQuantity; current.reservedQuantity += reservedQuantity; balanceByVariant.set(key, current);
    }
    const productById = new Map(products.map((item) => [String(item._id), item]));
    const categories: any[] = await ProductCatalogCategoryModel.find({ companyCode: scope.companyCode, status: "active" }).select("code name parentCode").lean();
    const categoryByCode = new Map(categories.map((category) => [category.code, category]));
    const brands: any[] = await ProductCatalogBrandModel.find({ companyCode: scope.companyCode, status: "active" }).select("code name").lean();
    const brandByCode = new Map(brands.map((brand) => [brand.code, brand.name]));
    const priceByVariant = new Map(prices.map((item) => [String(item.variantId), item]));
    const items: any[] = variants.map((variant) => { const product = productById.get(String(variant.productId)); const price = priceByVariant.get(String(variant._id)); const balance = balanceByVariant.get(String(variant._id)); if (!product || !price) return null; return { _id: String(variant._id), productId: String(product._id), variantId: String(variant._id), sku: variant.sku, barcode: variant.barcode, name: `${product.name} - ${variant.displayName || variant.sku}`, variantName: variant.displayName || variant.sku, category: product.categoryCode, categoryPath: buildRetailCategoryPath(product.categoryCode, categoryByCode), brand: brandByCode.get(product.brandCode) || product.brandCode, brandCode: product.brandCode, unit: variant.unitCode, stock: Number(balance?.quantity || 0) - Number(balance?.reservedQuantity || 0), price: Number(price.sellingPrice), costPrice: Number(price.costPrice || balance?.averageCost || 0), trackingMode: variant.trackingMode, optionValues: variant.optionValues || [], attributes: variant.attributes || [], ...(matchesScannedUnit(scannedUnit, variant) ? { matchedSerialNumber: scannedUnit.normalizedSerialNumber, matchedInternalBarcode: scannedUnit.normalizedInternalBarcode } : {}) }; }).filter(Boolean);
    const filteredItems = q && !barcode ? items.filter((item) => item.name.toLowerCase().includes(q.toLowerCase()) || item.sku.toLowerCase().includes(q.toLowerCase()) || item.barcode?.toLowerCase().includes(q.toLowerCase())) : items;
    const total = filteredItems.length;
    const pageItems = filteredItems.slice((page - 1) * limit, page * limit);
    return { items: pageItems, total, page, limit, categories: categories.map((category) => ({ code: category.code, name: category.name, parentCode: category.parentCode || "" })) };
  },
  async categories(scope: RetailBranchScope) {
    return ProductCatalogCategoryModel.find({ companyCode: scope.companyCode, status: "active" })
      .select("code name parentCode")
      .sort({ name: 1 })
      .lean();
  },
};

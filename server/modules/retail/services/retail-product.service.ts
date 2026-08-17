import { ProductModel } from "../../../model/product.model";
import { ProductCatalogLegacyMappingModel } from "../../../model/product-catalog-legacy-mapping.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
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
    const filter: any = {
      companyCode: scope.companyCode,
      status: "Active",
      $or: [{ branchId: scope.branchId }, { branchId: { $exists: false } }, { branchId: null }],
    };
    if (barcode) filter.$or = [{ barcode }, { sku: barcode }];
    else if (q) filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { barcode: { $regex: search, $options: "i" } },
    ];
    const [items, total] = await Promise.all([
      ProductModel.find(filter)
        .select("sku barcode name category brand unit stock price imageUrl trackingMode variantId")
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ProductModel.countDocuments(filter),
    ]);
    const legacyIds = items.map((item: any) => String(item._id));
    const mappings = await ProductCatalogLegacyMappingModel.find({ companyCode: scope.companyCode, legacyProductId: { $in: legacyIds }, $or: [{ legacyBranchId: scope.branchId }, { legacyBranchId: { $exists: false } }, { legacyBranchId: null }] }).select("legacyProductId variantId").lean();
    const variantIds = mappings.map((mapping: any) => String(mapping.variantId));
    const variants = await ProductVariantModel.find({ companyCode: scope.companyCode, _id: { $in: variantIds }, status: "active" }).select("sku barcode trackingMode productId").lean();
    const variantById = new Map(variants.map((variant: any) => [String(variant._id), variant]));
    const mappingByLegacyId = new Map(mappings.map((mapping: any) => [String(mapping.legacyProductId), mapping]));
    return { items: items.map((item: any) => {
      const mapping = mappingByLegacyId.get(String(item._id));
      const variant = mapping ? variantById.get(String(mapping.variantId)) : undefined;
      return { ...item, ...(variant ? { variantId: String(variant._id), trackingMode: variant.trackingMode, sku: variant.sku, barcode: variant.barcode || item.barcode } : {}) };
    }), total, page, limit };
  },
};

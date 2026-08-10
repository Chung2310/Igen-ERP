import { ProductModel } from "../../../model/product.model";
import type { RetailBranchScope } from "../contracts";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function normalizeRetailProductSearch(query: any) {
  return {
    q: String(query?.q || "").trim(),
    barcode: String(query?.barcode || "").trim(),
    page: Math.max(1, Number(query?.page) || 1),
    limit: Math.min(100, Math.max(1, Number(query?.limit) || 20)),
  };
}

export function buildRetailProductFilter(scope: RetailBranchScope, query: any) {
  const normalized = normalizeRetailProductSearch(query);
  return { scope: { ...scope }, search: escapeRegex(normalized.q), ...normalized };
}

export const RetailProductService = {
  async search(scope: RetailBranchScope, query: any) {
    const { q, barcode, page, limit, search } = buildRetailProductFilter(scope, query);
    const filter: any = { ...scope, status: "Active" };
    if (barcode) filter.$or = [{ barcode }, { sku: barcode }];
    else if (q) filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { barcode: { $regex: search, $options: "i" } },
    ];
    const [items, total] = await Promise.all([
      ProductModel.find(filter)
        .select("sku barcode name category brand unit stock price imageUrl")
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ProductModel.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },
};

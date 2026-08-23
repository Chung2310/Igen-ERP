import { ProductPriceModel } from "../../../model/product-price.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";

export const ProductPriceService = {
  async list(companyCode: string, branchId: string, query: any = {}) {
    const filter: any = { companyCode, branchId };
    if (query.variantId) filter.variantId = String(query.variantId);
    const items = await ProductPriceModel.find(filter).sort({ sku: 1 }).lean();
    return { items };
  },
  async upsert(companyCode: string, branchId: string, variantId: string, input: any, actor: string) {
    const variant: any = await ProductVariantModel.findOne({ _id: variantId, companyCode, status: "active" }).lean();
    if (!variant) throw Object.assign(new Error("SKU không tồn tại hoặc đã ngừng hoạt động."), { statusCode: 404 });
    const product: any = await ProductCatalogModel.findOne({ _id: variant.productId, companyCode, status: "active" }).lean();
    if (!product) throw Object.assign(new Error("Sản phẩm không tồn tại hoặc chưa được kích hoạt."), { statusCode: 400 });
    const sellingPrice = Number(input?.sellingPrice);
    const costPrice = Number(input?.costPrice || 0);
    if (!Number.isSafeInteger(sellingPrice) || sellingPrice < 0 || !Number.isSafeInteger(costPrice) || costPrice < 0) throw Object.assign(new Error("Giá bán và giá vốn phải là số nguyên không âm."), { statusCode: 400 });
    return ProductPriceModel.findOneAndUpdate(
      { companyCode, branchId, variantId: String(variant._id) },
      { $set: { productId: String(variant.productId), sku: variant.sku, sellingPrice, costPrice, status: "active", updatedBy: actor }, $setOnInsert: { companyCode, branchId, variantId: String(variant._id), createdBy: actor } },
      { returnDocument: 'after', upsert: true, runValidators: true },
    ).lean();
  },
};

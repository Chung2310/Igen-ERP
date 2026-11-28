import { Types } from "mongoose";
import { runInTransaction } from "../../../config/database";
import { ProductCatalogCategoryModel } from "../../../model/product-catalog-resource.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { RetailCommissionBasePolicyModel, RetailCommissionPolicyModel, RetailProductCommissionModel } from "../models/retail-commission.model";
import { RetailPartnerModel } from "../models/retail-partner.model";

const bad = (message: string, status = 400) => Object.assign(new Error(message), { status });

function integer(value: unknown, minimum: number, maximum: number, label: string) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) throw bad(`${label} không hợp lệ.`);
  return number;
}

function normalizeBaseConfig(input: any) {
  if (!input || typeof input !== "object") throw bad("Thiếu cấu hình chính sách hoa hồng.");
  return {
    phoneAmount: integer(input.phoneAmount, 150_000, 300_000, "Hoa hồng điện thoại"),
    accessoryBps: integer(input.accessoryBps, 1_000, 1_500, "Hoa hồng phụ kiện"),
    repairBps: integer(input.repairBps, 1_000, 1_500, "Hoa hồng công sửa chữa"),
  };
}

export async function listRetailBasePolicies(companyCode: string) {
  const [items, legacy] = await Promise.all([
    RetailCommissionBasePolicyModel.find({ companyCode }).sort({ effectiveAt: -1 }).limit(200).lean(),
    RetailCommissionPolicyModel.find({ companyCode }).sort({ partnerId: 1, kind: 1, sku: 1 }).lean(),
  ]);
  const partnerIds = [...new Set([...items, ...legacy].map(item => String(item.partnerId || "")).filter(id => Types.ObjectId.isValid(id)))];
  const partners = partnerIds.length ? await RetailPartnerModel.find({ companyCode, _id: { $in: partnerIds } }).select("_id name code").lean() : [];
  const partnerNames = new Map(partners.map(partner => [String(partner._id), partner.name]));
  const namedItems = items.map(item => ({ ...item, partnerName: item.partnerId ? partnerNames.get(String(item.partnerId)) || "Đối tác đã ngừng hoạt động" : "Chính sách chung" }));
  const assistantItems = [
    ...namedItems.map(item => ({
      _policyId: String(item._id), partnerName: item.partnerName, scope: item.partnerId ? "partner-specific" : "common",
      effectiveAt: item.effectiveAt, config: item.config, kind: "base",
    })),
    ...legacy.flatMap((item: any) => {
      const partnerName = partnerNames.get(String(item.partnerId || ""));
      if (!partnerName) return [];
      return [{
        _policyId: String(item._id), partnerName, scope: "partner-specific",
        effectiveFrom: item.effectiveFrom, kind: item.kind, sku: item.sku,
        ratePercent: Number(item.ratePercent), status: item.active === false ? "inactive" : "active",
      }];
    }),
  ];
  return { items: namedItems, legacy, assistantItems };
}

export async function saveRetailBasePolicy(companyCode: string, actorId: string, input: any, id?: string) {
  const existing = id && Types.ObjectId.isValid(id)
    ? await RetailCommissionBasePolicyModel.findOne({ companyCode, _id: id }).lean()
    : null;
  if (id && !existing) throw bad("Không tìm thấy chính sách hoa hồng bán lẻ.", 404);
  const partnerId = String(input?.partnerId ?? existing?.partnerId ?? "").trim();
  if (partnerId && (!Types.ObjectId.isValid(partnerId) || !await RetailPartnerModel.exists({ companyCode, _id: partnerId, roles: "collaborator" }))) {
    throw bad("Cộng tác viên bán lẻ không hợp lệ.");
  }
  const effectiveAt = input?.effectiveAt ? new Date(input.effectiveAt) : existing?.effectiveAt || new Date();
  if (Number.isNaN(effectiveAt.valueOf())) throw bad("Ngày hiệu lực không hợp lệ.");
  if (input?.effectiveAt && effectiveAt.getTime() < Date.now() && (!existing || effectiveAt.getTime() !== existing.effectiveAt.getTime())) {
    throw bad("Ngày hiệu lực không được nhỏ hơn ngày hiện tại.");
  }
  const config = normalizeBaseConfig(input?.config);
  if (existing) {
    return RetailCommissionBasePolicyModel.findOneAndUpdate(
      { companyCode, _id: existing._id },
      { $set: { partnerId, effectiveAt, config, updatedBy: actorId } },
      { returnDocument: "after", runValidators: true },
    ).lean();
  }
  return RetailCommissionBasePolicyModel.create({ companyCode, partnerId, effectiveAt, config, createdBy: actorId, updatedBy: actorId });
}

export async function listRetailProductCommissions(companyCode: string) {
  const now = new Date();
  const [products, variants, categories, configurations, legacyRules, basePolicy] = await Promise.all([
    ProductCatalogModel.find({ companyCode }).select("name categoryCode").lean(),
    ProductVariantModel.find({ companyCode }).select("productId sku displayName trackingMode").sort({ sku: 1 }).lean(),
    ProductCatalogCategoryModel.find({ companyCode }).select("code name parentCode").lean(),
    RetailProductCommissionModel.find({ companyCode }).select("sku rule").lean(),
    RetailCommissionPolicyModel.find({ companyCode, kind: "sale", sku: { $ne: "*" }, active: true }).select("partnerId sku ratePercent effectiveFrom").lean(),
    RetailCommissionBasePolicyModel.find({ companyCode, partnerId: "", effectiveAt: { $lte: now } }).sort({ effectiveAt: -1 }).limit(1).lean(),
  ]);
  const partnerIds = [...new Set(legacyRules.map((rule: any) => String(rule.partnerId || "")).filter(Boolean))];
  const partners = partnerIds.length
    ? await RetailPartnerModel.find({ companyCode, _id: { $in: partnerIds } }).select("_id name").lean()
    : [];
  const partnerNameById = new Map(partners.map((partner: any) => [String(partner._id), String(partner.name || "").trim()]));
  const productNameById = new Map(products.map((product: any) => [String(product._id), String(product.name || "").trim()]));
  const productById = new Map(products.map((product: any) => [String(product._id), product]));
  const categoryNameByCode = new Map(categories.map((category: any) => [String(category.code || "").toUpperCase(), String(category.name || "").trim()]));
  const productNameBySku = new Map(variants.map((variant: any) => [
    String(variant.sku || "").trim().toUpperCase(), productNameById.get(String(variant.productId)) || "",
  ]));
  const configurationBySku = new Map(configurations.map((configuration: any) => [
    String(configuration.sku || "").trim().toUpperCase(), configuration,
  ]));

  const assistantItems: Array<Record<string, string | number>> = [];
  for (const variant of variants as any[]) {
    const sku = String(variant.sku || "").trim().toUpperCase();
    const productName = productNameBySku.get(sku) || "";
    const product = productById.get(String(variant.productId));
    const rule = configurationBySku.get(sku)?.rule;
    if (!sku || !productName) continue;
    const variantName = String(variant.displayName || sku);
    const categoryCode = String((product as any)?.categoryCode || "").toUpperCase();
    const categoryName = categoryNameByCode.get(categoryCode) || categoryCode;
    const commonPolicy = (basePolicy as any[])[0];
    const phone = variant.trackingMode === "serial";
    const safeMetadata = { sku, productName, variantName, categoryCode, categoryName };
    if (rule?.kind === "phone" && Number.isSafeInteger(Number(rule.amount)) && Number(rule.amount) > 0) {
      assistantItems.push({ ...safeMetadata, kind: "phone", commissionType: "fixed", commissionValue: Number(rule.amount), status: "configured" });
    } else if (rule?.kind === "accessory" && Number.isSafeInteger(Number(rule.rateBps)) && Number(rule.rateBps) > 0) {
      const ratePercent = Number(rule.rateBps) / 100;
      assistantItems.push({ ...safeMetadata, kind: "accessory", commissionType: "percent", commissionValue: ratePercent, ratePercent, status: "configured" });
    } else if (commonPolicy?.config) {
      const ratePercent = Number(commonPolicy.config.accessoryBps) / 100;
      assistantItems.push(phone
        ? { ...safeMetadata, kind: "phone", commissionType: "fixed", commissionValue: Number(commonPolicy.config.phoneAmount), status: "common" }
        : { ...safeMetadata, kind: "accessory", commissionType: "percent", commissionValue: ratePercent, ratePercent, status: "common" });
    } else {
      assistantItems.push({ ...safeMetadata, status: "no-policy" });
    }
  }
  for (const rule of legacyRules as any[]) {
    const sku = String(rule.sku || "").trim().toUpperCase();
    const productName = productNameBySku.get(sku) || "";
    const partnerName = partnerNameById.get(String(rule.partnerId || "")) || "";
    const ratePercent = Number(rule.ratePercent);
    if (!sku || !productName || !partnerName || !Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) continue;
    const variant = (variants as any[]).find(entry => String(entry.sku || "").trim().toUpperCase() === sku);
    const product = variant && productById.get(String(variant.productId));
    const categoryCode = String((product as any)?.categoryCode || "").toUpperCase();
    assistantItems.push({ sku, productName, variantName: String(variant?.displayName || sku), categoryCode, categoryName: categoryNameByCode.get(categoryCode) || categoryCode, partnerName, kind: String(rule.kind || "sale"), commissionType: "percent", commissionValue: ratePercent, ratePercent, status: "partner-specific" });
  }
  return { products, variants, categories, configurations, legacyRules, assistantItems };
}

export async function saveRetailProductCommissions(companyCode: string, actorId: string, input: any) {
  if (!Array.isArray(input?.skus) || input.skus.length < 1 || input.skus.length > 500 || input.skus.some((value: unknown) => typeof value !== "string")) throw bad("Chọn từ 1 đến 500 SKU.");
  const skus = [...new Set<string>(input.skus.map((value: unknown) => String(value || "").trim().toUpperCase()))];
  if (skus.some((sku) => !sku)) throw bad("SKU sản phẩm không hợp lệ.");
  const count = await ProductVariantModel.countDocuments({ companyCode, sku: { $in: skus } });
  if (count !== skus.length) throw bad("Sản phẩm không thuộc danh mục công ty.");
  let rule: { kind: "phone"; amount: number } | { kind: "accessory"; rateBps: number } | null = null;
  if (input.rule !== null) {
    if (input.rule?.kind === "phone") rule = { kind: "phone", amount: integer(input.rule.amount, 1, Number.MAX_SAFE_INTEGER, "Mức hoa hồng điện thoại") };
    else if (input.rule?.kind === "accessory") rule = { kind: "accessory", rateBps: integer(input.rule.rateBps, 1, 10_000, "Tỷ lệ hoa hồng phụ kiện") };
    else throw bad("Loại hoa hồng sản phẩm không hợp lệ.");
  }
  await runInTransaction(async (session) => {
    await RetailProductCommissionModel.bulkWrite(skus.map((sku) => ({ updateOne: {
      filter: { companyCode, sku },
      update: { $set: { rule, updatedBy: actorId }, $setOnInsert: { companyCode, sku } },
      upsert: true,
    } })), session ? { session } : {});
  });
  return { updated: skus.length };
}

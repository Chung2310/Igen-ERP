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
  return { items, legacy };
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
  const [products, variants, categories, configurations, legacyRules] = await Promise.all([
    ProductCatalogModel.find({ companyCode }).select("name categoryCode").lean(),
    ProductVariantModel.find({ companyCode }).select("productId sku displayName trackingMode").sort({ sku: 1 }).lean(),
    ProductCatalogCategoryModel.find({ companyCode }).select("code name parentCode").lean(),
    RetailProductCommissionModel.find({ companyCode }).select("sku rule").lean(),
    RetailCommissionPolicyModel.find({ companyCode, kind: "sale", sku: { $ne: "*" }, active: true }).select("partnerId sku ratePercent effectiveFrom").lean(),
  ]);
  return { products, variants, categories, configurations, legacyRules };
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

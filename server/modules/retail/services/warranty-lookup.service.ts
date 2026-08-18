import { SerialUnitModel } from "../../inventory/serials/serial-unit.model";
import { effectiveCustomerWarranty, evaluateCoverage, resolveCustomerWarrantyMonths } from "../../inventory/serials/warranty-clock";
import { normalizeSerialNumber } from "../../inventory/serials/serial-state";
import { normalizeInternalBarcode } from "../../inventory/serials/unit-barcode-validation";
import type { RetailScope } from "../contracts";
import { SerialEventModel } from "../../inventory/serials/serial-event.model";
import { computeWarrantyEnd } from "../../inventory/serials/warranty-clock";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";

export async function lookupWarranty(scope: RetailScope, code: string, at = new Date()) {
  const normalized = normalizeSerialNumber(code);
  const unit: any = await SerialUnitModel.findOne({ companyCode: scope.companyCode, $or: [{ normalizedSerialNumber: normalized }, { normalizedInternalBarcode: normalizeInternalBarcode(code) }] }).lean();
  if (!unit) return { found: false as const };
  const variant: any = unit.variantId ? await ProductVariantModel.findOne({ _id: unit.variantId, companyCode: scope.companyCode }).select("productId warrantyMonths").lean() : null; const product: any = await ProductCatalogModel.findOne({ _id: unit.productId || variant?.productId, companyCode: scope.companyCode }).select("warrantyMonths").lean(); const promisedMonths = resolveCustomerWarrantyMonths(product?.warrantyMonths, variant?.warrantyMonths); const customerWarranty = effectiveCustomerWarranty(unit, promisedMonths); const coverage = evaluateCoverage({ ...unit, customerWarranty }, at); const promisedEnd = promisedMonths ? computeWarrantyEnd(unit.soldAt || at, promisedMonths) : undefined; const gapMonths = promisedEnd && unit.supplierWarranty?.endAt && unit.supplierWarranty.endAt < promisedEnd ? Math.max(0, Math.ceil((promisedEnd.getTime() - new Date(unit.supplierWarranty.endAt).getTime()) / (30 * 86_400_000))) : 0;
  return { found: true as const, serialNumber: unit.serialNumber, internalBarcode: unit.internalBarcode, product: { productId: unit.productId, variantId: unit.variantId, sku: unit.sku, name: unit.productName }, sold: unit.soldAt ? { at: unit.soldAt, orderId: unit.soldOrderId, orderCode: unit.soldOrderCode, branchId: unit.soldBranchId, customerId: unit.customerId } : undefined, customerWarranty: coverage.customer, supplierWarranty: { ...coverage.supplier, supplierId: unit.supplierWarranty?.supplierId, supplierName: unit.supplierWarranty?.supplierName }, costBearer: coverage.costBearer, gapMonths, status: unit.status };
}

export async function listExpiringWarranty(scope: RetailScope, kind: "supplier" | "customer", days = 30, at = new Date()) {
  const end = new Date(at.getTime() + Math.max(0, Number(days) || 30) * 86_400_000);
  const field = kind === "supplier" ? "supplierWarranty.endAt" : "customerWarranty.endAt";
  return SerialUnitModel.find({ companyCode: scope.companyCode, status: { $ne: "scrapped" }, [field]: { $gte: at, $lte: end } }).sort({ [field]: 1 }).lean();
}

export async function listWarrantyGapRisk(scope: RetailScope, at = new Date()) {
  const units: any[] = await SerialUnitModel.find({ companyCode: scope.companyCode, status: "in_stock", supplierWarranty: { $exists: true } }).lean();
  const variantIds = [...new Set(units.map((unit) => unit.variantId).filter(Boolean))]; const productIds = [...new Set(units.map((unit) => unit.productId).filter(Boolean))]; const [variants, products]: any[][] = await Promise.all([ProductVariantModel.find({ companyCode: scope.companyCode, _id: { $in: variantIds } }).select("_id warrantyMonths").lean(), ProductCatalogModel.find({ companyCode: scope.companyCode, _id: { $in: productIds } }).select("_id warrantyMonths").lean()]); const monthsByVariant = new Map(variants.map((variant) => [String(variant._id), Number(variant.warrantyMonths || 0)])); const monthsByProduct = new Map(products.map((product) => [String(product._id), product.warrantyMonths]));
  const monthsFor = (unit: any) => resolveCustomerWarrantyMonths(monthsByProduct.get(String(unit.productId)), monthsByVariant.get(String(unit.variantId)));
  return units.filter((unit) => { const months = monthsFor(unit); return unit.supplierWarranty?.endAt && months > 0 && new Date(unit.supplierWarranty.endAt) < computeWarrantyEnd(at, months); }).map((unit) => { const months = monthsFor(unit); return { ...unit, gapMonths: Math.max(0, Math.ceil((computeWarrantyEnd(at, months).getTime() - new Date(unit.supplierWarranty.endAt).getTime()) / (30 * 86_400_000))) }; });
}

export async function updateWarranty(scope: RetailScope, id: string, input: { kind: "supplier" | "customer"; startAt: string; months: number }, actor: { id: string; name: string }) {
  const startAt = new Date(input.startAt); const months = Number(input.months);
  if (Number.isNaN(startAt.valueOf()) || !Number.isFinite(months) || months < 0 || months > 1200) throw Object.assign(new Error("Ngày bắt đầu hoặc số tháng bảo hành không hợp lệ."), { statusCode: 400 });
  const unit: any = await SerialUnitModel.findOne({ _id: id, companyCode: scope.companyCode }); if (!unit) throw Object.assign(new Error("Không tìm thấy IMEI/serial."), { statusCode: 404 });
  const field = input.kind === "supplier" ? "supplierWarranty" : "customerWarranty"; const current = unit[field] || {};
  unit[field] = { ...current, months, startAt, endAt: computeWarrantyEnd(startAt, months), startSource: "manual", source: "manual" }; unit.updatedBy = actor.id; await unit.save();
  await SerialEventModel.create({ companyCode: scope.companyCode, branchId: unit.branchId, serialUnitId: String(unit._id), serialNumber: unit.serialNumber, eventType: "warranty_adjusted", toStatus: unit.status, reason: `${input.kind}:${months} tháng`, actorId: actor.id, actorName: actor.name });
  return unit.toObject();
}

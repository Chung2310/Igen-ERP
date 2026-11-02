/* eslint-disable @typescript-eslint/no-explicit-any */
import { SerialUnitModel } from "../../inventory/serials/serial-unit.model";
import { effectiveCustomerWarranty, evaluateCoverage, resolveCustomerWarrantyMonths } from "../../inventory/serials/warranty-clock";
import { normalizeSerialNumber } from "../../inventory/serials/serial-state";
import { normalizeInternalBarcode } from "../../inventory/serials/unit-barcode-validation";
import type { RetailScope } from "../contracts";
import { SerialEventModel } from "../../inventory/serials/serial-event.model";
import { computeWarrantyEnd } from "../../inventory/serials/warranty-clock";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { getCustomerContact } from "../../customer-management/contracts";
import { CustomerModel } from "../../customer-management/models/customer.model";
import { RetailOrderModel } from "../models/retail-order.model";
import { phoneLookupVariants } from "../../customer-management/customer-normalization";

export async function lookupWarranty(scope: RetailScope, code: string, at = new Date()) {
  const normalized = normalizeSerialNumber(code);
  const internalBarcode = normalizeInternalBarcode(code);
  const unit: any = await SerialUnitModel.findOne({ companyCode: scope.companyCode, $or: [{ normalizedSerialNumber: normalized }, { normalizedInternalBarcode: internalBarcode }, { normalizedBarcodeAliases: internalBarcode }, { normalizedImeis: normalized }] }).lean();
  if (!unit) return { found: false as const };
  const variant: any = unit.variantId ? await ProductVariantModel.findOne({ _id: unit.variantId, companyCode: scope.companyCode }).select("productId warrantyMonths").lean() : null;
  const product: any = await ProductCatalogModel.findOne({ _id: unit.productId || variant?.productId, companyCode: scope.companyCode }).select("warrantyMonths").lean();
  const promisedMonths = resolveCustomerWarrantyMonths(product?.warrantyMonths, variant?.warrantyMonths);
  const customerWarranty = effectiveCustomerWarranty(unit, promisedMonths);
  const coverage = evaluateCoverage({ ...unit, customerWarranty }, at);
  const promisedEnd = promisedMonths ? computeWarrantyEnd(unit.soldAt || at, promisedMonths) : undefined;
  const gapMonths = promisedEnd && unit.supplierWarranty?.endAt && unit.supplierWarranty.endAt < promisedEnd ? Math.max(0, Math.ceil((promisedEnd.getTime() - new Date(unit.supplierWarranty.endAt).getTime()) / (30 * 86_400_000))) : 0;
  const customer = unit.customerId ? await getCustomerContact({ companyCode: scope.companyCode }, String(unit.customerId), { includeInactive: true }) : null;
  const isHex = (id?: unknown) => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id.trim());
  const friendlyCustId = customer?.customerCode || (unit.customerId && !isHex(unit.customerId) ? String(unit.customerId) : undefined);
  return {
    found: true as const,
    serialNumber: unit.serialNumber,
    internalBarcode: unit.internalBarcode,
    product: { productId: unit.productId, variantId: unit.variantId, sku: unit.sku, name: unit.productName },
    sold: unit.soldAt ? { at: unit.soldAt, orderId: unit.soldOrderId, orderCode: unit.soldOrderCode, branchId: unit.soldBranchId, customerId: friendlyCustId || (customer?.phone ? `KH-${customer.phone}` : String(unit.customerId || "")), customerCode: customer?.customerCode, customerName: customer?.name, customerPhone: customer?.phone } : undefined,
    customerWarranty: coverage.customer,
    supplierWarranty: { ...coverage.supplier, supplierId: unit.supplierWarranty?.supplierId, supplierName: unit.supplierWarranty?.supplierName },
    costBearer: coverage.costBearer,
    gapMonths,
    status: unit.status,
  };
}

export interface PhoneWarrantyLookupResult {
  found: boolean;
  customer?: {
    customerId?: string;
    customerCode?: string;
    name?: string;
    phone?: string;
  };
  totalDevices: number;
  devices: Array<Awaited<ReturnType<typeof lookupWarranty>>>;
}

export async function lookupWarrantyByPhone(scope: RetailScope, rawPhone: string, at = new Date()): Promise<PhoneWarrantyLookupResult> {
  const digits = String(rawPhone || "").trim().replace(/\D/g, "");
  if (!digits || digits.length < 4) {
    return { found: false, totalDevices: 0, devices: [] };
  }
  const variants = phoneLookupVariants(rawPhone);
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const phonePattern = escapeRegex(digits.startsWith("0") ? digits.slice(1) : digits);
  const phoneRegex = new RegExp(phonePattern, "i");

  // 1. Tìm thông tin khách hàng từ CustomerModel
  const customers = await CustomerModel.find({
    companyCode: scope.companyCode,
    $or: [
      { normalizedPhone: { $in: variants } },
      { phone: { $in: variants } },
      { phone: phoneRegex },
    ],
  }).select("_id name phone customerCode").lean();

  const customerIds = customers.map((c: any) => String(c._id));
  let mainCustomer: { customerId?: string; customerCode?: string; name?: string; phone?: string } | undefined = customers[0]
    ? {
        customerId: String(customers[0]._id),
        customerCode: customers[0].customerCode,
        name: customers[0].name,
        phone: customers[0].phone,
      }
    : undefined;

  // 2. Tìm đơn hàng bán lẻ đã hoàn thành/xác nhận
  const orders: any[] = await RetailOrderModel.find({
    companyCode: scope.companyCode,
    status: { $in: ["confirmed", "completed"] },
    $or: [
      { customerPhone: { $in: variants } },
      { customerPhone: phoneRegex },
      { "customerSnapshot.phone": { $in: variants } },
      { "customerSnapshot.phone": phoneRegex },
      ...(customerIds.length ? [{ customerId: { $in: customerIds } }] : []),
    ],
  }).select("_id orderCode customerName customerPhone customerSnapshot items confirmedAt completedAt branchId").sort({ confirmedAt: -1, completedAt: -1, _id: -1 }).lean();

  if (!mainCustomer && orders.length > 0) {
    const firstWithCust = orders.find((o) => o.customerSnapshot?.name || o.customerName);
    if (firstWithCust) {
      mainCustomer = {
        name: firstWithCust.customerSnapshot?.name || firstWithCust.customerName,
        phone: firstWithCust.customerSnapshot?.phone || firstWithCust.customerPhone,
        customerCode: firstWithCust.customerSnapshot?.customerCode,
      };
    }
  }

  const orderIds = orders.map((o) => String(o._id));
  const orderSerials = [
    ...new Set(
      orders.flatMap((o) =>
        (o.items || []).flatMap((i: any) => i.serialNumbers || []),
      ).filter(Boolean),
    ),
  ];

  // 3. Tìm các SerialUnitModel tương ứng
  const serialQuery: any[] = [];
  if (customerIds.length > 0) serialQuery.push({ customerId: { $in: customerIds } });
  if (orderIds.length > 0) serialQuery.push({ soldOrderId: { $in: orderIds } });
  if (orderSerials.length > 0) {
    serialQuery.push({ serialNumber: { $in: orderSerials } });
    serialQuery.push({ normalizedSerialNumber: { $in: orderSerials.map(normalizeSerialNumber) } });
  }

  const units: any[] = serialQuery.length > 0
    ? await SerialUnitModel.find({ companyCode: scope.companyCode, $or: serialQuery }).lean()
    : [];

  const foundSerials = new Set<string>();
  const devices: any[] = [];

  for (const unit of units) {
    if (foundSerials.has(unit.serialNumber)) continue;
    foundSerials.add(unit.serialNumber);
    const lookupResult = await lookupWarranty(scope, unit.serialNumber, at);
    if (lookupResult.found) {
      devices.push(lookupResult);
    }
  }

  // 4. Nếu đơn hàng có các sản phẩm có bảo hành mà không quản lý serial
  for (const order of orders) {
    for (const item of order.items || []) {
      const itemSerials: string[] = item.serialNumbers || [];
      const hasTrackedSerial = itemSerials.some((s) => foundSerials.has(s));
      if (!hasTrackedSerial && (item.customerWarrantyMonths > 0 || item.customerWarrantyEndAt)) {
        const startAt = item.customerWarrantyStartAt ? new Date(item.customerWarrantyStartAt) : undefined;
        const endAt = item.customerWarrantyEndAt ? new Date(item.customerWarrantyEndAt) : undefined;
        const covered = Boolean(endAt && endAt >= at);
        const daysLeft = endAt ? Math.max(0, Math.ceil((endAt.getTime() - at.getTime()) / 86_400_000)) : 0;
        devices.push({
          found: true as const,
          serialNumber: itemSerials[0] || undefined,
          product: { productId: item.productId, variantId: item.variantId, sku: item.sku, name: item.productName },
          sold: {
            at: String(item.soldAt || order.confirmedAt || order.completedAt || ""),
            orderId: String(order._id),
            orderCode: order.orderCode,
            branchId: order.branchId,
            customerName: order.customerSnapshot?.name || order.customerName,
            customerPhone: order.customerSnapshot?.phone || order.customerPhone,
          },
          customerWarranty: {
            covered,
            startAt: startAt?.toISOString(),
            endAt: endAt?.toISOString(),
            daysLeft: covered ? daysLeft : 0,
          },
          supplierWarranty: { covered: false },
          costBearer: covered ? "shop" : "customer",
          status: "sold",
        });
      }
    }
  }

  devices.sort((a, b) => {
    const timeA = a.sold?.at ? new Date(a.sold.at).getTime() : 0;
    const timeB = b.sold?.at ? new Date(b.sold.at).getTime() : 0;
    return timeB - timeA;
  });

  return {
    found: devices.length > 0,
    customer: mainCustomer,
    totalDevices: devices.length,
    devices,
  };
}

export async function listExpiringWarranty(scope: RetailScope, kind: "supplier" | "customer", days = 30, at = new Date()) {
  const end = new Date(at.getTime() + Math.max(0, Number(days) || 30) * 86_400_000);
  const field = kind === "supplier" ? "supplierWarranty.endAt" : "customerWarranty.endAt";
  return SerialUnitModel.find({ companyCode: scope.companyCode, status: { $ne: "scrapped" }, [field]: { $gte: at, $lte: end } }).sort({ [field]: 1 }).lean();
}

export async function listWarrantyGapRisk(scope: RetailScope, at = new Date()) {
  const units: any[] = await SerialUnitModel.find({ companyCode: scope.companyCode, status: "in_stock", supplierWarranty: { $exists: true } }).lean();
  const variantIds = [...new Set(units.map((unit) => unit.variantId).filter(Boolean))];
  const productIds = [...new Set(units.map((unit) => unit.productId).filter(Boolean))];
  const [variants, products]: any[][] = await Promise.all([ProductVariantModel.find({ companyCode: scope.companyCode, _id: { $in: variantIds } }).select("_id warrantyMonths").lean(), ProductCatalogModel.find({ companyCode: scope.companyCode, _id: { $in: productIds } }).select("_id warrantyMonths").lean()]);
  const monthsByVariant = new Map(variants.map((variant) => [String(variant._id), Number(variant.warrantyMonths || 0)]));
  const monthsByProduct = new Map(products.map((product) => [String(product._id), product.warrantyMonths]));
  const monthsFor = (unit: any) => resolveCustomerWarrantyMonths(monthsByProduct.get(String(unit.productId)), monthsByVariant.get(String(unit.variantId)));
  return units.filter((unit) => { const months = monthsFor(unit); return unit.supplierWarranty?.endAt && months > 0 && new Date(unit.supplierWarranty.endAt) < computeWarrantyEnd(at, months); }).map((unit) => { const months = monthsFor(unit); return { ...unit, gapMonths: Math.max(0, Math.ceil((computeWarrantyEnd(at, months).getTime() - new Date(unit.supplierWarranty.endAt).getTime()) / (30 * 86_400_000))) }; });
}

type WarrantyUpdateInput = { kind: "supplier" | "customer"; startAt: string; months: number };
type WarrantyUpdateActor = { id: string; name: string };

function validateWarrantyUpdate(input: WarrantyUpdateInput) {
  const startAt = new Date(String(input?.startAt || "")); const months = Number(input?.months);
  if (!input || !["supplier", "customer"].includes(input.kind) || Number.isNaN(startAt.valueOf()) || !Number.isInteger(months) || months < 0 || months > 1200) throw Object.assign(new Error("Loại bảo hành, ngày bắt đầu hoặc số tháng bảo hành không hợp lệ."), { statusCode: 400 });
  return { startAt, months };
}

async function saveWarrantyUpdate(unit: any, input: WarrantyUpdateInput, actor: WarrantyUpdateActor) {
  const { startAt, months } = validateWarrantyUpdate(input);
  const field = input.kind === "supplier" ? "supplierWarranty" : "customerWarranty"; const current = unit[field] || {};
  unit[field] = { ...current, months, startAt, endAt: computeWarrantyEnd(startAt, months), startSource: "manual", source: "manual" }; unit.updatedBy = actor.id; await unit.save();
  await SerialEventModel.create({ companyCode: String(unit.companyCode || ""), branchId: unit.branchId, serialUnitId: String(unit._id), serialNumber: unit.serialNumber, eventType: "warranty_adjusted", toStatus: unit.status, reason: `${input.kind}:${months} tháng`, actorId: actor.id, actorName: actor.name });
  return unit.toObject();
}

export async function updateWarranty(scope: RetailScope, id: string, input: WarrantyUpdateInput, actor: WarrantyUpdateActor) {
  validateWarrantyUpdate(input);
  const unit: any = await SerialUnitModel.findOne({ _id: id, companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}) });
  if (!unit) throw Object.assign(new Error("Không tìm thấy IMEI/serial trong phạm vi đã chọn."), { statusCode: 404 });
  return saveWarrantyUpdate(unit, input, actor);
}

export async function updateWarrantyByCode(scope: RetailScope, code: string, input: WarrantyUpdateInput, actor: WarrantyUpdateActor) {
  validateWarrantyUpdate(input);
  const visibleCode = String(code || "").trim();
  if (!visibleCode) throw Object.assign(new Error("Hãy nhập IMEI, số sê-ri hoặc mã vạch hợp lệ."), { statusCode: 400 });
  const normalizedSerial = normalizeSerialNumber(visibleCode);
  const normalizedBarcode = normalizeInternalBarcode(visibleCode);
  const filter = {
    companyCode: scope.companyCode,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
    $or: [
      ...(normalizedSerial ? [{ normalizedSerialNumber: normalizedSerial }, { normalizedImeis: normalizedSerial }] : []),
      ...(normalizedBarcode ? [{ normalizedInternalBarcode: normalizedBarcode }, { normalizedBarcodeAliases: normalizedBarcode }] : []),
    ],
  };
  const units: any[] = await SerialUnitModel.find(filter).limit(2);
  if (!units.length) throw Object.assign(new Error("Không tìm thấy IMEI/serial trong phạm vi đã chọn."), { statusCode: 404 });
  if (units.length > 1) throw Object.assign(new Error("Mã này khớp với nhiều thiết bị; hãy dùng IMEI, số sê-ri hoặc mã vạch chính xác hơn."), { statusCode: 409 });
  return saveWarrantyUpdate(units[0], input, actor);
}

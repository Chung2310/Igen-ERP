import type { ISerialUnit } from "./serial-unit.interface";

export function computeWarrantyEnd(startAt: Date, months: number): Date {
  const result = new Date(startAt);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + Math.max(0, months));
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function coverage(endAt: Date | undefined, at: Date) {
  if (!endAt) return { covered: false };
  const daysLeft = Math.ceil((new Date(endAt).getTime() - at.getTime()) / 86_400_000);
  return { covered: daysLeft >= 0, endAt: new Date(endAt), daysLeft };
}

export function evaluateCoverage(unit: ISerialUnit, at: Date) {
  const customer = coverage(unit.customerWarranty?.endAt, at);
  const supplier = coverage(unit.supplierWarranty?.endAt, at);
  const costBearer = customer.covered && supplier.covered ? "supplier" : customer.covered ? "shop" : "customer";
  return { customer, supplier, costBearer } as const;
}

export function snapshotCoverage(unit: ISerialUnit, checkedAt = new Date()) {
  const evaluated = evaluateCoverage(unit, checkedAt);
  return { customer: evaluated.customer, supplier: { ...evaluated.supplier, supplierId: unit.supplierWarranty?.supplierId, supplierName: unit.supplierWarranty?.supplierName }, costBearer: evaluated.costBearer, checkedAt };
}

export function inheritCustomerWarranty(source: ISerialUnit, sourceSerialUnitId: string) {
  if (!source.customerWarranty) return undefined;
  return { months: source.customerWarranty.months, startAt: source.customerWarranty.startAt, endAt: source.customerWarranty.endAt, source: "inherited" as const, inheritedFromSerialUnitId: sourceSerialUnitId };
}

export function warrantyGapMonths(unit: ISerialUnit, sellAt: Date, customerMonths: number): number {
  const customerEnd = computeWarrantyEnd(sellAt, customerMonths);
  const supplierEnd = unit.supplierWarranty?.endAt;
  if (!supplierEnd || supplierEnd >= customerEnd) return 0;
  let months = 0;
  let cursor = new Date(supplierEnd);
  while (computeWarrantyEnd(cursor, 1) < customerEnd) { months += 1; cursor = computeWarrantyEnd(cursor, 1); }
  return months + 1;
}

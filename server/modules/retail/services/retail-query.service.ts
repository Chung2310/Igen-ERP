import type { RetailBranchScope } from "../contracts";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pageValues = (query: any) => {
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

export function buildOrderListQuery(scope: RetailBranchScope, query: any) {
  const filter: any = { ...scope };
  for (const key of ["status", "paymentStatus", "customerId", "shiftId"]) if (query?.[key]) filter[key] = String(query[key]);
  if (query?.heldOnly === "true" || query?.heldOnly === true) filter.status = "draft";
  if (query?.ownerId) filter.createdBy = String(query.ownerId);
  if (query?.from || query?.to) filter.businessDate = {
    ...(query.from ? { $gte: String(query.from) } : {}),
    ...(query.to ? { $lte: String(query.to) } : {}),
  };
  const search = escapeRegex(String(query?.q || "").trim());
  if (search) filter.$or = ["orderCode", "customerName", "customerPhone"].map((key) => ({ [key]: { $regex: search, $options: "i" } }));
  return { filter, ...pageValues(query) };
}

export function buildInvoiceListQuery(scope: RetailBranchScope, query: any) {
  const filter: any = { ...scope };
  if (query?.status) filter.status = String(query.status);
  if (query?.orderId) filter.orderId = String(query.orderId);
  if (query?.from || query?.to) filter.issuedAt = {
    ...(query.from ? { $gte: new Date(`${query.from}T00:00:00+07:00`) } : {}),
    ...(query.to ? { $lte: new Date(`${query.to}T23:59:59.999+07:00`) } : {}),
  };
  const search = escapeRegex(String(query?.q || "").trim());
  if (search) filter.$or = [
    { invoiceNo: { $regex: search, $options: "i" } },
    { orderCode: { $regex: search, $options: "i" } },
    { "snapshot.customerName": { $regex: search, $options: "i" } },
  ];
  return { filter, ...pageValues(query) };
}

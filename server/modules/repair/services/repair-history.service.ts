import { CustomerModel } from "../../customer-management/models/customer.model";
import { normalizePhone, phoneLookupVariants } from "../../customer-management/customer-normalization";
import { lookupWarranty } from "../../retail/services/warranty-lookup.service";
import { RepairTicketModel } from "../repair-ticket.model";
import type { RepairScope } from "../repair-ticket.service";

export type RepairHistoryScope = { companyCode: string; branchId?: string };

const TICKET_FIELDS = "ticketCode branchId status device customerId customerName customerPhone symptom diagnosis coverage laborFee partCost partRevenue totalAmount paidAmount dueAmount paymentStatus technicianId technicianName receivedAt completedAt deliveredAt";

/** Bảo hành do module retail nắm; module đó tắt hoặc máy mua nơi khác thì vẫn phải tra được lịch sử sửa. */
async function safeLookupWarranty(scope: RepairHistoryScope, code: string) {
  try {
    return await lookupWarranty(scope, code);
  } catch {
    return { found: false as const };
  }
}

/**
 * Lịch sử một thiết bị: nguồn gốc + bảo hành hiện tại (nếu máy do cửa hàng bán) và
 * toàn bộ phiếu SCBH của IMEI/serial đó trên mọi chi nhánh trong cùng công ty.
 */
export async function lookupDeviceHistory(scope: RepairHistoryScope, imei: string) {
  const code = String(imei || "").trim().toUpperCase();
  if (!code) throw Object.assign(new Error("IMEI/serial là bắt buộc."), { statusCode: 400 });
  const [warranty, tickets] = await Promise.all([
    safeLookupWarranty(scope, code),
    RepairTicketModel.find({
      ...scope,
      $or: [{ "device.normalizedImei": code }, { "device.normalizedSerialNumber": code }],
    }).select(TICKET_FIELDS).sort({ receivedAt: -1 }).lean(),
  ]);
  return { imei: code, warranty, tickets, ticketCount: tickets.length };
}

/**
 * Lịch sử theo số điện thoại khách: gom các phiếu về từng thiết bị để thấy ngay
 * máy nào đã sửa mấy lần.
 */
export async function lookupCustomerHistory(scope: RepairHistoryScope, phone: string, selectedCustomerId?: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw Object.assign(new Error("Số điện thoại là bắt buộc."), { statusCode: 400 });
  const variants = phoneLookupVariants(normalized);
  const customers = (await CustomerModel.find({ companyCode: scope.companyCode, normalizedPhone: { $in: variants } })
    .select("_id name customerCode").sort({ customerCode: 1 }).lean())
    .map(customer => ({ customerId: String(customer._id), customerCode: customer.customerCode, name: customer.name }));
  const selected = selectedCustomerId
    ? customers.find(customer => customer.customerId === selectedCustomerId)
    : customers.length === 1 ? customers[0] : undefined;
  const empty = { phone: normalized, customerName: "", ticketCount: 0, devices: [] };
  if (selectedCustomerId && !selected) return empty;
  if (!selected && customers.length > 1) return { ...empty, candidates: customers };

  const tickets = await RepairTicketModel.find({
    ...scope,
    ...(selected ? { customerId: { $in: [selected.customerId, selected.customerCode] } } : { normalizedCustomerPhone: { $in: variants } }),
  }).select(TICKET_FIELDS).sort({ receivedAt: -1 }).lean();
  if (!selected && tickets.length > 1) {
    const firstId = tickets[0].customerId;
    if (!firstId || tickets.some(ticket => ticket.customerId !== firstId)) return { ...empty, needsIdentification: true };
  }

  const devices = new Map<string, { imei?: string; deviceName: string; ticketCount: number; lastReceivedAt: Date; tickets: any[] }>();
  for (const ticket of tickets) {
    const key = String(ticket.device?.normalizedImei || ticket.device?.normalizedSerialNumber || `name:${ticket.device?.name || ""}`);
    const current = devices.get(key);
    if (current) { current.ticketCount += 1; current.tickets.push(ticket); continue; }
    devices.set(key, {
      ...(ticket.device?.imei || ticket.device?.serialNumber ? { imei: String(ticket.device.imei || ticket.device.serialNumber) } : {}),
      deviceName: String(ticket.device?.name || ""),
      ticketCount: 1,
      lastReceivedAt: ticket.receivedAt,
      tickets: [ticket],
    });
  }

  return {
    phone: normalized,
    customerName: selected?.name || String(tickets[0]?.customerName || ""),
    ticketCount: tickets.length,
    devices: [...devices.values()],
  };
}

export async function lookupRepairHistory(scope: RepairScope | RepairHistoryScope, query: { imei?: string; phone?: string; customerId?: string }) {
  if (query.imei) return { kind: "device" as const, ...(await lookupDeviceHistory(scope, query.imei)) };
  if (query.phone) return { kind: "customer" as const, ...(await lookupCustomerHistory(scope, query.phone, query.customerId)) };
  throw Object.assign(new Error("Cần truyền imei hoặc phone để tra cứu."), { statusCode: 400 });
}

import { apiFetch } from "../modules/shared/lib/apiFetch";

export type RepairStatus = "received" | "diagnosing" | "quoted" | "approved" | "repairing" | "waiting_parts" | "waiting_supplier" | "done" | "delivered" | "cancelled" | "returned";
export interface RepairTicket { _id: string; ticketCode: string; status: RepairStatus; customerId: string; customerName: string; customerPhone: string; device: { productId?: string; name: string; serialNumber?: string; imei?: string; condition: string; accessories: string[] }; coverage: { customer: { covered: boolean; startAt?: string; endAt?: string; daysLeft?: number }; supplier: { covered: boolean; startAt?: string; endAt?: string; daysLeft?: number; supplierName?: string }; costBearer: string; checkedAt: string }; symptom: string; diagnosis?: string; laborFee: number; partCost: number; discountAmount: number; totalAmount: number; paidAmount: number; dueAmount: number; paymentStatus: string; quotedAmount?: number; receivedAt: string; promisedAt?: string; completedAt?: string; deliveredAt?: string; statusHistory?: Array<{ from?: string; to: string; at: string; byName: string; note?: string; customerNotified?: boolean }>; partRevenue?: number; technicianId?: string; technicianName?: string; assignedAt?: string }
type Envelope<T> = { success: boolean; data: T };
const root = "/repair/tickets";
export const repairService = {
  async list(params: Record<string, string | number | undefined> = {}) { return (await apiFetch<Envelope<{ items: RepairTicket[]; total: number; page: number; limit: number }>>(root, { params })).data; },
  async board() { return (await apiFetch<Envelope<Record<RepairStatus, RepairTicket[]>>>(`${root}/board`)).data; },
  async lookupDevice(serialNumber: string) { return (await apiFetch<Envelope<any>>(`${root}/lookup-device`, { method: "POST", body: JSON.stringify({ serialNumber }) })).data; },
  async create(input: Record<string, unknown>) { return (await apiFetch<Envelope<RepairTicket>>(root, { method: "POST", body: JSON.stringify(input) })).data; },
  async transition(id: string, to: RepairStatus, note?: string) { return (await apiFetch<Envelope<RepairTicket>>(`${root}/${id}/status`, { method: "POST", body: JSON.stringify({ to, note }) })).data; },
  async quote(id: string, amount: number) { return (await apiFetch<Envelope<RepairTicket>>(`${root}/${id}/quote`, { method: "POST", body: JSON.stringify({ amount }) })).data; },
  async approveQuote(id: string) { return (await apiFetch<Envelope<RepairTicket>>(`${root}/${id}/approve-quote`, { method: "POST", body: JSON.stringify({}) })).data; },
  async pay(id: string, amount: number) { return (await apiFetch<Envelope<RepairTicket>>(`${root}/${id}/payments`, { method: "POST", body: JSON.stringify({ amount }) })).data; },
  async parts(id: string) { return (await apiFetch<Envelope<unknown[]>>(`${root}/${id}/parts`)).data; },
  async cancel(id: string, reason: string) { return (await apiFetch<Envelope<RepairTicket>>(`${root}/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) })).data; },
  async deliver(id: string) { return (await apiFetch<Envelope<RepairTicket>>(`${root}/${id}/deliver`, { method: "POST", body: JSON.stringify({}) })).data; },
  async issuePart(id: string, input: Record<string, unknown>) { return (await apiFetch<Envelope<unknown>>(`${root}/${id}/parts`, { method: "POST", body: JSON.stringify(input) })).data; },
  async returnPart(id: string, partId: string, reason: string) { return (await apiFetch<Envelope<unknown>>(`${root}/${id}/parts/${partId}/return`, { method: "POST", body: JSON.stringify({ reason }) })).data; },
};

export type RepairPartBilling = "customer" | "warranty_shop" | "warranty_supplier";
export interface RepairPart { _id: string; sku: string; productName: string; quantity: number; unitCost: number; unitPrice: number; lineTotal: number; billing: RepairPartBilling; chargeable: boolean; status: string; issuedAt: string; issuedByName: string; returnReason?: string }
export interface RepairNotification { _id: string; event: string; channel?: string; recipient?: string; status: "sent" | "failed" | "skipped"; reason?: string; sentAt: string }
export interface RepairRevenueRow { key: string; branchId?: string; ticketCount: number; warrantyTicketCount: number; laborRevenue: number; partRevenue: number; revenue: number; collected: number; outstanding: number; technicianName?: string; partCost?: number; warrantyPartCost?: number; grossProfit?: number }
export interface RepairTechnicianRow { technicianId: string; technicianName: string; ticketCount: number; revenue: number; averageMinutes: number; reworkCount: number; reworkRate: number; ratingCount: number; averageRating: number; criteria: { skill: number; attitude: number; speed: number } }
export type RepairRatingCriteria = { skill?: number; attitude?: number; speed?: number };

export const repairExtras = {
  async assignTechnician(id: string, technicianId: string) { return (await apiFetch<Envelope<RepairTicket>>(`${root}/${id}/assign`, { method: "POST", body: JSON.stringify({ technicianId }) })).data; },
  async rate(id: string, input: { rating: number; comment?: string; criteria?: RepairRatingCriteria }) { return (await apiFetch<Envelope<unknown>>(`${root}/${id}/feedback`, { method: "POST", body: JSON.stringify(input) })).data; },
  async notifications(id: string) { return (await apiFetch<Envelope<RepairNotification[]>>(`${root}/${id}/notifications`)).data; },
  async resendNotification(id: string, event: "received" | "done") { return (await apiFetch<Envelope<{ status: string; reason?: string }>>(`${root}/${id}/notifications/resend`, { method: "POST", body: JSON.stringify({ event }) })).data; },
  async historyByImei(imei: string) { return (await apiFetch<Envelope<any>>("/repair/history", { params: { imei } })).data; },
  async historyByPhone(phone: string) { return (await apiFetch<Envelope<any>>("/repair/history", { params: { phone } })).data; },
  async revenueReport(params: { from: string; to: string; groupBy?: "branch" | "technician" | "day"; branchId?: string }) { return (await apiFetch<Envelope<{ groupBy: string; items: RepairRevenueRow[]; total: RepairRevenueRow }>>("/repair/reports/revenue", { params })).data; },
  async technicianReport(params: { from: string; to: string; branchId?: string }) { return (await apiFetch<Envelope<RepairTechnicianRow[]>>("/repair/reports/technician-performance", { params })).data; },
  async feedbackSummary(params: { from: string; to: string; branchId?: string }) { return (await apiFetch<Envelope<Array<{ branchId: string; count: number; averageRating: number; distribution: Record<string, number> }>>>("/repair/reports/feedback-summary", { params })).data; },
  async notificationSettings() { return (await apiFetch<Envelope<any>>("/repair/settings/notifications")).data; },
  async saveNotificationSettings(input: Record<string, unknown>) { return (await apiFetch<Envelope<any>>("/repair/settings/notifications", { method: "PUT", body: JSON.stringify(input) })).data; },
};

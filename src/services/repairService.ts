import { apiFetch } from "../modules/shared/lib/apiFetch";

export type RepairStatus = "received" | "diagnosing" | "quoted" | "approved" | "repairing" | "waiting_parts" | "waiting_supplier" | "done" | "delivered" | "cancelled" | "returned";
export interface RepairTicket { _id: string; ticketCode: string; status: RepairStatus; customerId: string; customerName: string; customerPhone: string; device: { productId?: string; name: string; serialNumber?: string; condition: string; accessories: string[] }; coverage: { customer: { covered: boolean; startAt?: string; endAt?: string; daysLeft?: number }; supplier: { covered: boolean; startAt?: string; endAt?: string; daysLeft?: number; supplierName?: string }; costBearer: string; checkedAt: string }; symptom: string; diagnosis?: string; laborFee: number; partCost: number; discountAmount: number; totalAmount: number; paidAmount: number; dueAmount: number; paymentStatus: string; quotedAmount?: number; receivedAt: string; promisedAt?: string; completedAt?: string; deliveredAt?: string; statusHistory?: Array<{ from?: string; to: string; at: string; byName: string; note?: string }> }
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

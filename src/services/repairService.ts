import { apiFetch } from "../modules/shared/lib/apiFetch";

export type RepairStatus = "received" | "diagnosing" | "quoted" | "approved" | "repairing" | "waiting_parts" | "waiting_supplier" | "done" | "delivered" | "cancelled" | "returned";
export interface RepairTicket { _id: string; ticketCode: string; status: RepairStatus; customerName: string; customerPhone: string; device: { name: string; serialNumber?: string; condition: string; accessories: string[] }; coverage: { customer: { covered: boolean; endAt?: string; daysLeft?: number }; supplier: { covered: boolean; endAt?: string; daysLeft?: number; supplierName?: string }; costBearer: string; checkedAt: string }; symptom: string; totalAmount: number; paidAmount: number; dueAmount: number; receivedAt: string }
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
};

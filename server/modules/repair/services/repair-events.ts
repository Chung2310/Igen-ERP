import type { ClientSession } from "mongoose";
import { publishDomainEvent } from "../../../integrations/shared/event-bus";
import type { NewDomainEvent } from "../../../integrations/shared/event-types";
import type { RepairActor } from "../repair-ticket.service";

type RepairEventName = "received" | "done" | "delivered";
type Options = { session?: ClientSession; publish?: (event: NewDomainEvent<any>, session?: ClientSession) => Promise<void> };

export async function publishRepairTicketEvent(event: RepairEventName, ticket: any, actor: RepairActor, options: Options = {}) {
  const publish = options.publish || publishDomainEvent;
  const ticketId = String(ticket._id);
  return publish({
    eventId: `repair-ticket:${ticketId}:${event}`,
    eventType: `repair.ticket.${event}` as const,
    companyCode: String(ticket.companyCode),
    branchId: String(ticket.branchId || ""),
    aggregateType: "RepairTicket",
    aggregateId: ticketId,
    occurredAt: new Date(),
    actorId: String(actor?.id || "system"),
    actorName: String(actor?.name || "Hệ thống"),
    payload: {
      ticketId,
      ticketCode: String(ticket.ticketCode || ""),
      branchId: String(ticket.branchId || ""),
      customerId: String(ticket.customerId || ""),
      customerName: String(ticket.customerName || ""),
      customerPhone: String(ticket.customerPhone || ""),
      deviceName: String(ticket.device?.name || ""),
      ...(ticket.device?.serialNumber ? { serialNumber: String(ticket.device.serialNumber) } : {}),
      ...(ticket.device?.imei ? { imei: String(ticket.device.imei) } : {}),
      ...(ticket.technicianId ? { technicianId: String(ticket.technicianId), technicianName: String(ticket.technicianName || "") } : {}),
      status: String(ticket.status),
      totalAmount: Number(ticket.totalAmount || 0),
      dueAmount: Number(ticket.dueAmount || 0),
      occurredAt: new Date().toISOString(),
    },
  }, options.session);
}

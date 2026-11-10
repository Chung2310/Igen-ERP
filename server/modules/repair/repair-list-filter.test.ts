import { describe, expect, it } from "vitest";
import { buildRepairTicketListFilter } from "./repair-list-filter";

describe("repair ticket list filters", () => {
  it("applies status, payment, relationship, text and received-date filters", () => {
    expect(buildRepairTicketListFilter({
      status: "waiting_parts",
      paymentStatus: "partial",
      customerId: "customer-1",
      technicianId: "employee-1",
      q: "SC.[001]",
      from: "2026-11-01",
      to: "2026-11-05",
    })).toEqual({
      status: "waiting_parts",
      paymentStatus: "partial",
      customerId: "customer-1",
      technicianId: "employee-1",
      $or: [
        { ticketCode: { $regex: "SC\\.\\[001\\]", $options: "i" } },
        { customerName: { $regex: "SC\\.\\[001\\]", $options: "i" } },
        { "device.serialNumber": { $regex: "SC\\.\\[001\\]", $options: "i" } },
      ],
      receivedAt: { $gte: new Date("2026-11-01T00:00:00.000Z"), $lt: new Date("2026-11-06T00:00:00.000Z") },
    });
  });

  it("ignores invalid enum and date values while escaping regular-expression input", () => {
    expect(buildRepairTicketListFilter({ status: "$where", paymentStatus: "pending", q: ".*", from: "2026-02-30" })).toEqual({
      $or: [
        { ticketCode: { $regex: "\\.\\*", $options: "i" } },
        { customerName: { $regex: "\\.\\*", $options: "i" } },
        { "device.serialNumber": { $regex: "\\.\\*", $options: "i" } },
      ],
    });
  });
});

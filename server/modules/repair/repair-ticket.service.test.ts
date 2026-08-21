import { beforeEach, describe, expect, test, vi } from "vitest";

const ticket: any = {
  _id: "ticket-1",
  status: "received",
  statusHistory: [],
  save: vi.fn(async () => undefined),
  toObject() { return { ...this, statusHistory: [...this.statusHistory] }; },
};
const findOneTicket = vi.fn();
const findOneUser = vi.fn();

vi.mock("./repair-ticket.model", () => ({ RepairTicketModel: { findOne: (...args: any[]) => findOneTicket(...args) } }));
vi.mock("../../model/user.model", () => ({ UserModel: { findOne: (...args: any[]) => findOneUser(...args) } }));

const { approveRepairQuote, deliverRepairTicket, quoteRepairTicket, recordRepairPayment, transitionRepairTicket } = await import("./repair-ticket.service");

const scope = { companyCode: "company-a", branchId: "branch-a" };
const actor = { id: "actor-1", name: "Người tiếp nhận" };

describe("transitionRepairTicket", () => {
  beforeEach(() => {
    ticket.status = "received";
    ticket.statusHistory = [];
    ticket.technicianId = undefined;
    ticket.technicianName = undefined;
    ticket.assignedAt = undefined;
    ticket.assignedBy = undefined;
    ticket.totalAmount = 0;
    ticket.quotedAmount = undefined;
    ticket.paidAmount = 0;
    ticket.dueAmount = 0;
    ticket.paymentStatus = "unpaid";
    ticket.save.mockClear();
    findOneTicket.mockReset();
    findOneTicket.mockReturnValue(ticket);
    findOneUser.mockReset();
  });

  test("received → diagnosing rejects a missing technician", async () => {
    await expect(transitionRepairTicket(scope, "ticket-1", "diagnosing", actor)).rejects.toMatchObject({ statusCode: 400 });
  });

  test("received → diagnosing assigns an active company technician and snapshots it", async () => {
    findOneUser.mockReturnValue({ select: () => ({ lean: async () => ({ _id: "tech-1", displayName: "Kỹ thuật viên A" }) }) });

    const result = await transitionRepairTicket(scope, "ticket-1", "diagnosing", actor, undefined, false, undefined, "tech-1");

    expect(findOneUser).toHaveBeenCalledWith({ _id: "tech-1", companyCode: "company-a", isActive: { $ne: false } });
    expect(result.technicianId).toBe("tech-1");
    expect(result.assignedAt).toBeInstanceOf(Date);
    expect(result.assignedBy).toBe("actor-1");
    expect(result.statusHistory.at(-1)).toMatchObject({ to: "diagnosing", technicianId: "tech-1", technicianName: "Kỹ thuật viên A" });
  });

  test("received → diagnosing rejects a technician that is inactive or outside the company", async () => {
    findOneUser.mockReturnValue({ select: () => ({ lean: async () => null }) });

    await expect(transitionRepairTicket(scope, "ticket-1", "diagnosing", actor, undefined, false, undefined, "inactive-tech")).rejects.toMatchObject({ statusCode: 400 });
    expect(findOneUser).toHaveBeenCalledWith({ _id: "inactive-tech", companyCode: "company-a", isActive: { $ne: false } });
  });

  test("stores the trimmed quote note in the status history", async () => {
    ticket.status = "diagnosing";
    ticket.paidAmount = 0;

    const result = await quoteRepairTicket(scope, "ticket-1", 250_000, actor, "  Thay pin chinh hang  ");

    expect(result.statusHistory.at(-1)).toMatchObject({ from: "diagnosing", to: "quoted", note: "Thay pin chinh hang" });
  });

  test("keeps a quoted ticket free of debt until handoff", async () => {
    ticket.status = "diagnosing";

    const result = await quoteRepairTicket(scope, "ticket-1", 250_000, actor);

    expect(result).toMatchObject({ status: "quoted", quotedAmount: 250_000, totalAmount: 250_000, dueAmount: 0, paymentStatus: "unpaid" });
  });

  test("keeps an approved quote free of debt", async () => {
    ticket.status = "quoted";
    ticket.totalAmount = 250_000;
    ticket.quotedAmount = 250_000;
    ticket.dueAmount = 250_000;

    const result = await approveRepairQuote(scope, "ticket-1", actor);

    expect(result).toMatchObject({ status: "approved", totalAmount: 250_000, dueAmount: 0, paymentStatus: "unpaid" });
  });

  test("activates the payable balance only when the repair is ready for delivery", async () => {
    ticket.status = "repairing";
    ticket.totalAmount = 250_000;

    const result = await transitionRepairTicket(scope, "ticket-1", "done", actor);

    expect(result).toMatchObject({ status: "done", dueAmount: 250_000, paymentStatus: "unpaid" });
  });

  test("rejects payment before the repair reaches the delivery handoff", async () => {
    ticket.status = "approved";
    ticket.totalAmount = 250_000;

    await expect(recordRepairPayment(scope, "ticket-1", 250_000, actor)).rejects.toMatchObject({ statusCode: 409, code: "REPAIR_PAYMENT_NOT_DUE" });
  });

  test("requires full payment before delivery", async () => {
    ticket.status = "done";
    ticket.totalAmount = 250_000;
    ticket.dueAmount = 250_000;

    await recordRepairPayment(scope, "ticket-1", 100_000, actor);

    await expect(deliverRepairTicket(scope, "ticket-1", actor, true)).rejects.toMatchObject({ statusCode: 403, code: "REPAIR_DEBT_BLOCKED" });

    await recordRepairPayment(scope, "ticket-1", 150_000, actor);
    const delivered = await deliverRepairTicket(scope, "ticket-1", actor);

    expect(delivered).toMatchObject({ status: "delivered", dueAmount: 0, paymentStatus: "paid" });
  });

  test("does not let the generic status transition bypass the delivery payment check", async () => {
    ticket.status = "done";
    ticket.totalAmount = 250_000;
    ticket.dueAmount = 250_000;

    await expect(transitionRepairTicket(scope, "ticket-1", "delivered", actor)).rejects.toMatchObject({ statusCode: 403, code: "REPAIR_DEBT_BLOCKED" });
  });
});

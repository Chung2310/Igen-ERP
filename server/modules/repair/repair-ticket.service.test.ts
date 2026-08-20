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

const { transitionRepairTicket } = await import("./repair-ticket.service");

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
});

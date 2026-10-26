import mongoose from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CashierShiftModel } from "../models/cashier-shift.model";
import { RetailOrderModel } from "../models/retail-order.model";
import { CashierShiftService } from "./cashier-shift.service";

const scope = { companyCode: "ACME", branchId: "branch-a" };
const actor = { id: "cashier-a", displayName: "Thu ngân A" };
const id = "507f1f77bcf86cd799439011";
const input = { type: "out", amount: 50_000, reason: "Bàn giao tiền", idempotencyKey: "request-1" };
afterEach(() => vi.restoreAllMocks());

function sessionFor(shift: any) {
  const session = { withTransaction: async (work: () => Promise<unknown>) => work(), endSession: vi.fn() };
  vi.spyOn(mongoose, "startSession").mockResolvedValue(session as any);
  vi.spyOn(CashierShiftModel, "findOne").mockReturnValue({ session: async () => shift } as any);
  return session;
}

describe("POS cash movements", () => {
  it("records a keyed movement inside the transaction", async () => {
    const shift = { ...scope, _id: id, cashierId: actor.id, status: "open", openingFloat: 100_000,
      operationalEndsAt: new Date(Date.now() + 60_000), cashMovements: [], voidedCashMovements: [], auditLog: [], save: vi.fn() };
    const session = sessionFor(shift);
    vi.spyOn(RetailOrderModel, "find").mockReturnValue({ session: () => ({ lean: async () => [] }) } as any);
    await CashierShiftService.moveCash(scope, id, input, actor);
    expect(shift.cashMovements).toEqual([expect.objectContaining({ key: input.idempotencyKey, amount: input.amount, type: input.type })]);
    expect(shift.save).toHaveBeenCalledWith({ session });
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it("returns a recorded request and rejects reuse with another amount", async () => {
    const shift = { ...scope, _id: id, cashMovements: [{ ...input, key: input.idempotencyKey }] };
    sessionFor(shift);
    expect(await CashierShiftService.moveCash(scope, id, input, actor)).toBe(shift);
    await expect(CashierShiftService.moveCash(scope, id, { ...input, amount: 10_000 }, actor))
      .rejects.toMatchObject({ code: "SHIFT_MOVEMENT_CONFLICT" });
  });

  it("requires a count before reconciliation", async () => {
    const update = vi.spyOn(CashierShiftModel, "findOneAndUpdate");
    await expect(CashierShiftService.reconcile(scope, id, {}, actor)).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });

  it("clears only the current device when pausing a session", async () => {
    const update = vi.spyOn(CashierShiftModel, "findOneAndUpdate").mockResolvedValue(null);
    await CashierShiftService.pause(scope, id, { terminalId: "POS-1" }, actor);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ cashierId: actor.id, status: "open", terminalId: "POS-1" }),
      expect.objectContaining({ $unset: { terminalId: 1 } }), expect.anything(),
    );
  });

  it("fences device transfer using the expected previous terminal", async () => {
    vi.spyOn(CashierShiftService, "current").mockResolvedValue({ _id: id, terminalId: "POS-1" } as any);
    const update = vi.spyOn(CashierShiftModel, "findOneAndUpdate").mockResolvedValue({ ...scope, _id: id, terminalId: "POS-2" } as any);
    await CashierShiftService.resume(scope, id, { terminalId: "POS-2", expectedTerminalId: "POS-1" }, actor);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ cashierId: actor.id, status: "open", terminalId: "POS-1" }),
      expect.objectContaining({ $set: expect.objectContaining({ terminalId: "POS-2" }) }), expect.anything(),
    );
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { CashierShiftModel } from "../models/cashier-shift.model";
import { CashierShiftService } from "./cashier-shift.service";
import { UserModel } from "../../../model/user.model";

const scope = { companyCode: "ACME", branchId: "branch-a" };
const actor = { id: "cashier-a", displayName: "Thu ngân A" };
const id = "507f1f77bcf86cd799439011";
const input = { type: "out", amount: 50_000, reason: "Bàn giao tiền", idempotencyKey: "request-1" };
afterEach(() => vi.restoreAllMocks());

describe("thu/rút quỹ ca bán", () => {
  it("dùng điều kiện nguyên tử để tránh ghi trùng khi gửi lại", async () => {
    const update = vi.spyOn(CashierShiftModel, "findOneAndUpdate").mockResolvedValue({ _id: id } as any);
    await CashierShiftService.recordMovement(scope, id, input, actor);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ cashierId: actor.id, status: "open", pausedAt: { $exists: false }, "cashMovements.idempotencyKey": { $ne: input.idempotencyKey } }), expect.anything(), expect.anything());
  });

  it("trả lại giao dịch đã ghi và chặn tái dùng khóa cho số tiền khác", async () => {
    vi.spyOn(CashierShiftModel, "findOneAndUpdate").mockResolvedValue(null);
    vi.spyOn(CashierShiftModel, "findOne").mockResolvedValue({ cashMovements: [input] } as any);
    expect(await CashierShiftService.recordMovement(scope, id, input, actor)).toMatchObject({ cashMovements: [input] });
    await expect(CashierShiftService.recordMovement(scope, id, { ...input, amount: 10_000 }, actor)).rejects.toMatchObject({ code: "SHIFT_MOVEMENT_KEY_REUSED" });
  });

  it("chỉ duyệt ca đã đóng và có số kiểm đếm", async () => {
    const update = vi.spyOn(CashierShiftModel, "findOneAndUpdate").mockResolvedValue({ status: "reconciled" } as any);
    await CashierShiftService.reconcile(scope, id, { id: "manager-a", displayName: "Quản lý" });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "closed", countedCash: { $exists: true }, varianceAmount: { $exists: true } }), expect.objectContaining({ $set: expect.objectContaining({ approvedBy: "manager-a" }) }), expect.anything());
  });
});

describe("tạm dừng và đổi quầy ca bán", () => {
  it("tạm dừng bằng điều kiện nguyên tử và lưu lý do", async () => {
    const update = vi.spyOn(CashierShiftModel, "findOneAndUpdate").mockResolvedValue({ pausedAt: new Date() } as any);
    await CashierShiftService.pause(scope, id, { reason: "Đổi máy" }, actor);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ cashierId: actor.id, status: "open", pausedAt: { $exists: false } }),
      expect.objectContaining({ $set: expect.objectContaining({ pauseReason: "Đổi máy" }) }),
      expect.anything(),
    );
  });

  it("chỉ mở lại ca đang tạm dừng và lưu lịch sử đổi quầy", async () => {
    const pausedAt = new Date();
    vi.spyOn(CashierShiftModel, "findOne").mockResolvedValue({ pausedAt, terminalId: "POS-1", operationalEndsAt: new Date(Date.now() + 60_000) } as any);
    const update = vi.spyOn(CashierShiftModel, "findOneAndUpdate").mockResolvedValue({ terminalId: "POS-2" } as any);
    await CashierShiftService.resume(scope, id, { terminalId: "POS-2" }, actor);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ cashierId: actor.id, status: "open", pausedAt }),
      expect.objectContaining({ $unset: expect.objectContaining({ pausedAt: 1 }), $push: { terminalHistory: expect.objectContaining({ fromTerminalId: "POS-1", toTerminalId: "POS-2" }) } }),
      expect.anything(),
    );
  });
});

describe("quản lý mở ca cho thu ngân", () => {
  it("chỉ tra tài khoản ở đúng công ty và chi nhánh", async () => {
    const userLookup = vi.spyOn(UserModel, "findOne").mockReturnValue({ select: () => ({ lean: async () => null }) } as any);
    await expect(CashierShiftService.openFor(scope, { cashierId: id, openingFloat: 0 }, { id: "manager-a" }))
      .rejects.toMatchObject({ code: "SHIFT_CASHIER_INVALID" });
    expect(userLookup).toHaveBeenCalledWith(expect.objectContaining({ _id: id, companyCode: scope.companyCode, branchId: scope.branchId }));
  });
});

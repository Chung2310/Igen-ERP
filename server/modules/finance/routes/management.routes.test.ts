import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../../../middleware/auth", () => ({ requirePermission: () => (_req: any, _res: any, next: any) => next() }));
vi.mock("../services/management.service", () => ({ createVoucher: vi.fn() }));
import { createVoucher } from "../services/management.service";
import { financeManagementRoutes } from "./management.routes";
const handler = financeManagementRoutes.stack.find((layer: any) => layer.route?.path === "/vouchers")!.route!.stack.at(-1)!.handle;
beforeEach(() => vi.clearAllMocks());
it("explains standalone MongoDB rejection without reporting a successful payment", async () => {
  vi.mocked(createVoucher).mockRejectedValue(Object.assign(new Error("Transaction numbers are only allowed on a replica set member or mongos"), { code: 20 }));
  const req = { user: { companyCode: "TEST", branchId: "B", role: "user" }, query: {}, body: { kind: "payment", category: "supplier", expenseClass: "none", amount: 400000000, date: "2026-09-28", method: "cash", payableId: "a".repeat(24), idempotencyKey: "late-payment" } };
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() }, next = vi.fn();
  await handler(req as any, res, next);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "FINANCE_TRANSACTIONS_REQUIRED", message: "Giao dịch gặp sự cố, vui lòng thử lại sau." }));
  expect(next).not.toHaveBeenCalled();
});

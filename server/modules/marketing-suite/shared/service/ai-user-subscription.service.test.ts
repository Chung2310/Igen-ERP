import { afterEach, expect, it, vi } from "vitest";
import { aiSubscriptionService } from "./ai-subscription.service";
import { AiUserSubscriptionModel } from "../model/ai-user-subscription.model";

afterEach(() => vi.restoreAllMocks());
it("uses an active personal AI quota before the company quota", async () => {
  vi.spyOn(aiSubscriptionService, "recoverExpired").mockResolvedValue(undefined);
  const companySummary = vi.spyOn(aiSubscriptionService, "summary");
  const find = vi.spyOn(AiUserSubscriptionModel, "findOne").mockReturnValue({
    lean: async () => ({ aiLimit: 10, used: 3, reserved: 1, companyCode: "ACME", status: "active" }),
  } as any);
  const result = await aiSubscriptionService.available("ACME", 2, "507f1f77bcf86cd799439011");
  expect(result.remaining).toBe(6);
  expect(find).toHaveBeenCalledWith(expect.objectContaining({ userId: "507f1f77bcf86cd799439011", companyCode: "ACME" }));
  expect(companySummary).not.toHaveBeenCalled();
});

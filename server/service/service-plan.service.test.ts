import { afterEach, expect, it, vi } from "vitest";
import { CompanyModel } from "../model/company.model";
import { ServicePlanModel } from "../model/service-plan.model";
import { servicePlanService } from "./service-plan.service";

afterEach(() => vi.restoreAllMocks());
it("grants a service plan and replaces tenant modules atomically", async () => {
  const company = { serviceSubscription: null as any, enabledModules: ["hr"], save: vi.fn().mockResolvedValue(undefined) };
  vi.spyOn(CompanyModel, "findOne").mockReturnValue({ session: async () => company } as any);
  vi.spyOn(ServicePlanModel, "findOne").mockReturnValue({ session: async () => ({
    _id: "507f1f77bcf86cd799439011", name: "Gói Marketing", priceVnd: 99000,
    durationDays: 30, modules: ["marketing", "company-knowledge"], updatedAt: new Date("2026-10-01"),
  }) } as any);
  const session = {} as any;
  const assigned = await servicePlanService.assign("acme", "507f1f77bcf86cd799439011", "superadmin", null, "2026-10-01", session);
  expect(company.enabledModules).toEqual(["marketing", "company-knowledge"]);
  expect(assigned.status).toBe("active");
  expect(assigned.expiresAt.getTime() - assigned.startsAt.getTime()).toBe(30 * 86_400_000);
  expect(company.save).toHaveBeenCalledWith({ session });
});

import { afterEach, expect, it, vi } from "vitest";
import { CompanyModel } from "../../../../model/company.model.ts";
import { companySepayService } from "./company-sepay.service.ts";

afterEach(() => vi.restoreAllMocks());

it("reads SePay configuration without creating a webhook ID or saving the company", async () => {
  const save = vi.fn();
  const company = { code: "TEST", name: "Doanh nghiệp kiểm thử", sepayConfig: {}, save };
  const select = vi.fn().mockResolvedValue(company);
  const findOne = vi.spyOn(CompanyModel, "findOne").mockReturnValue({ select } as any);

  const config = await companySepayService.getConfig(" test ", "https://erp.example.test");

  expect(findOne).toHaveBeenCalledWith({ code: "TEST" });
  expect(select).toHaveBeenCalledWith("+sepayConfig.webhookSecretEncrypted");
  expect(save).not.toHaveBeenCalled();
  expect(config.webhookId).toBe("");
  expect(config.webhookUrl).toBe("");
});

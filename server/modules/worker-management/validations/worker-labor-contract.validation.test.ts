import { describe, expect, it } from "vitest";
import { renewWorkerLaborContractSchema } from "./worker-labor-contract.validation";

describe("renewWorkerLaborContractSchema", () => {
  it("accepts the source worker ID submitted by the contract renewal form", () => {
    const result = renewWorkerLaborContractSchema.validate({
      workerId: "6a4c5d666ca790ac78608698",
      code: "HD-RENEW-01",
      startDate: "2027-01-01",
      endDate: "2027-12-31",
    });

    expect(result.error).toBeUndefined();
  });
});

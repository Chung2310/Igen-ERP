import { describe, expect, it } from "vitest";
import { reviewedContracts } from "./reviewed-contracts.mjs";

describe("reviewed student batch contract", () => {
  it("publishes the class capacity fields provided by the GET batches service", () => {
    const operation = reviewedContracts["GET /batches"];

    expect(operation.resultFields).toEqual(expect.arrayContaining([
      "courseCode",
      "maxLearners",
      "enrolledCount",
      "remainingSlots",
    ]));
    expect(operation.description).toContain("remainingSlots=null");
  });
});

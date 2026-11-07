import { describe, expect, it } from "vitest";
import { summarizeEmployeeContracts } from "./hr-contract-overview";

describe("summarizeEmployeeContracts", () => {
  it("counts employees once and identifies those without an effective contract", () => {
    const result = summarizeEmployeeContracts([
      { _id: "a", displayName: "An", email: "an@example.com" },
      { _id: "b", displayName: "", email: "binh@example.com" },
      { _id: "c", displayName: "Chi", email: "chi@example.com" },
    ], ["a", "a", "c", "deleted-user"], ["a", "a", "b", "deleted-user"]);

    expect(result).toEqual({
      activeContractEmployeeCount: 2,
      withoutContractCount: 1,
      withoutContractEmployees: [{ id: "b", name: "binh@example.com" }],
      renewedEmployeeCount: 2,
    });
  });
});

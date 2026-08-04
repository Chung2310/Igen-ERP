import { describe, expect, it } from "vitest";
import { buildWorkerQuery, normalizeWorkerInput } from "./worker.service";

describe("worker service", () => {
  it("scopes active workers by company and optional branch", () => {
    expect(buildWorkerQuery({ companyCode: "ACME", branchId: "B1" })).toEqual({ companyCode: "ACME", branchId: "B1", deletedAt: null });
    expect(buildWorkerQuery({ companyCode: "ACME" })).toEqual({ companyCode: "ACME", deletedAt: null });
  });

  it("normalizes optional worker profile fields without accepting student-only fields", () => {
    const normalized = normalizeWorkerInput({
      fullName: " A ",
      phone: " 090 ",
      email: " WORKER@EXAMPLE.COM ",
      address: " HN ",
      birthday: "2000-01-01",
      idCard: " 001 ",
      registrationDate: " 2026-08-04 ",
      note: " note ",
      customFields: { preferredShift: "morning" },
      rank: "B2",
      fee: "1000000",
      batchId: "student-batch",
    } as any);

    expect(normalized).toMatchObject({
      fullName: "A",
      phone: "090",
      email: "worker@example.com",
      address: "HN",
      birthday: "2000-01-01",
      idCard: "001",
      registrationDate: "2026-08-04",
      note: "note",
      customFields: { preferredShift: "morning" },
      status: "active",
    });
    expect(normalized).not.toHaveProperty("rank");
    expect(normalized).not.toHaveProperty("fee");
    expect(normalized).not.toHaveProperty("batchId");
  });

  it("defaults invalid status to active", () => {
    expect(normalizeWorkerInput({ fullName: "Nguyen Van A", status: "graduated" }).status).toBe("active");
  });
});
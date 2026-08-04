import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkerModel } from "../models/worker.model";
import { WorkerService, buildWorkerQuery, normalizeWorkerInput } from "./worker.service";

afterEach(() => vi.restoreAllMocks());

describe("worker service", () => {
  it("scopes list by company, branch and active rows", async () => {
    const lean = vi.fn().mockResolvedValue([]);
    const sort = vi.fn().mockReturnValue({ lean });
    const find = vi.spyOn(WorkerModel, "find").mockReturnValue({ sort } as any);
    await WorkerService.list({ companyCode: "ACME", branchId: "B1" });
    expect(find).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1", deletedAt: null });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it("persists only normalized worker fields in tenant scope", async () => {
    const create = vi.spyOn(WorkerModel, "create").mockResolvedValue({ _id: "w1" } as any);
    await WorkerService.create({ companyCode: "ACME", branchId: "B1" }, {
      fullName: " A ", email: " WORKER@EXAMPLE.COM ", address: " HN ",
      rank: "B2", fee: 1000, batchId: "student-batch",
    } as any);
    const persisted = create.mock.calls[0][0] as Record<string, unknown>;
    expect(persisted).toMatchObject({ fullName: "A", email: "worker@example.com", address: "HN", companyCode: "ACME", branchId: "B1", status: "active", deletedAt: null });
    expect(persisted).not.toHaveProperty("rank");
    expect(persisted).not.toHaveProperty("fee");
    expect(persisted).not.toHaveProperty("batchId");
  });

  it("updates within tenant and branch scope", async () => {
    const lean = vi.fn().mockResolvedValue({ _id: "w1" });
    const update = vi.spyOn(WorkerModel, "findOneAndUpdate").mockReturnValue({ lean } as any);
    await WorkerService.update({ companyCode: "ACME", branchId: "B1" }, "w1", { fullName: " Worker " });
    expect(update).toHaveBeenCalledWith(
      { _id: "w1", companyCode: "ACME", branchId: "B1", deletedAt: null },
      { $set: expect.objectContaining({ fullName: "Worker", branchId: "B1" }) },
      { new: true },
    );
  });

  it("soft deletes within tenant scope without removing the document", async () => {
    const lean = vi.fn().mockResolvedValue({ _id: "w1" });
    const update = vi.spyOn(WorkerModel, "findOneAndUpdate").mockReturnValue({ lean } as any);
    await WorkerService.delete({ companyCode: "ACME", branchId: "B1" }, "w1");
    expect(update).toHaveBeenCalledWith(
      { _id: "w1", companyCode: "ACME", branchId: "B1", deletedAt: null },
      { $set: { deletedAt: expect.any(Date) } },
      { new: true },
    );
  });

  it("normalizes optional fields and rejects student-only fields", () => {
    const normalized = normalizeWorkerInput({ fullName: " A ", phone: " 090 ", email: " WORKER@EXAMPLE.COM ", address: " HN ", birthday: "2000-01-01", idCard: " 001 ", registrationDate: " 2026-08-04 ", note: " note ", customFields: { preferredShift: "morning" }, rank: "B2", fee: "1000000", batchId: "student-batch" } as any);
    expect(normalized).toMatchObject({ fullName: "A", phone: "090", email: "worker@example.com", address: "HN", birthday: "2000-01-01", idCard: "001", registrationDate: "2026-08-04", note: "note", customFields: { preferredShift: "morning" }, status: "active" });
    expect(normalized).not.toHaveProperty("rank");
    expect(normalized).not.toHaveProperty("fee");
    expect(normalized).not.toHaveProperty("batchId");
    expect(buildWorkerQuery({ companyCode: "ACME" })).toEqual({ companyCode: "ACME", deletedAt: null });
  });
});
import { afterEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { WorkerModel } from "../models/worker.model";
import { WorkerProjectModel } from "../models/worker-project.model";
import { WorkerService, buildWorkerQuery, normalizeWorkerInput, normalizeWorkerPhone } from "./worker.service";

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

  it("normalizes phone numbers down to digits so lookups match regardless of input format", () => {
    expect(normalizeWorkerPhone(" 0912 345 678 ")).toBe("0912345678");
    expect(normalizeWorkerPhone("0912.345.678")).toBe("0912345678");
    expect(normalizeWorkerPhone("0912-345-678")).toBe("0912345678");
    expect(normalizeWorkerPhone("+84912345678")).toBe("0912345678");
    expect(normalizeWorkerPhone("84912345678")).toBe("0912345678");
    expect(normalizeWorkerPhone("912345678")).toBe("0912345678");
    expect(normalizeWorkerPhone("")).toBe("");
    expect(normalizeWorkerPhone(undefined)).toBe("");
  });

  it("stores a digits-only phone through create and update", async () => {
    const create = vi.spyOn(WorkerModel, "create").mockResolvedValue({ _id: "w1" } as any);
    await WorkerService.create({ companyCode: "ACME" }, { fullName: "A", phone: "0912 345 678" });
    expect((create.mock.calls[0][0] as Record<string, unknown>).phone).toBe("0912345678");

    const lean = vi.fn().mockResolvedValue({ _id: "w1" });
    const update = vi.spyOn(WorkerModel, "findOneAndUpdate").mockReturnValue({ lean } as any);
    await WorkerService.update({ companyCode: "ACME" }, "w1", { fullName: "A", phone: "+84 912 345 678" });
    expect((update.mock.calls[0][1] as any).$set.phone).toBe("0912345678");
  });
});

describe("worker bulk import", () => {
  const scope = { companyCode: "ACME", branchId: "B1" };

  function mockExisting(rows: Array<Record<string, unknown>>) {
    const lean = vi.fn().mockResolvedValue(rows);
    const select = vi.fn().mockReturnValue({ lean });
    vi.spyOn(WorkerModel, "find").mockReturnValue({ select } as any);
    return { select };
  }

  it("imports valid rows and reports the inserted count", async () => {
    mockExisting([]);
    const insertMany = vi.spyOn(WorkerModel, "insertMany").mockImplementation(async (docs: any) => docs);
    const result = await WorkerService.bulkCreate(scope, [
      { fullName: "Nguyễn Văn A", phone: "0912345678" },
      { fullName: "Trần Thị B", phone: "0987654321", email: "B@Example.com", idCard: "001", note: "ghi chú" },
    ]);
    expect(result.importedCount).toBe(2);
    expect(result.skippedCount).toBe(0);
    expect(result.errors).toEqual([]);
    const docs = insertMany.mock.calls[0][0] as any[];
    expect(docs[0]).toMatchObject({ fullName: "Nguyễn Văn A", phone: "0912345678", companyCode: "ACME", branchId: "B1", status: "active", deletedAt: null });
    expect(docs[1]).toMatchObject({ email: "b@example.com", idCard: "001" });
  });

  it("scopes the uniqueness lookup to the company and branch", async () => {
    const { select } = mockExisting([]);
    vi.spyOn(WorkerModel, "insertMany").mockResolvedValue([] as any);
    await WorkerService.bulkCreate(scope, []);
    expect(WorkerModel.find).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1", deletedAt: null });
    expect(select).toHaveBeenCalledWith("phone email idCard");
  });

  it("skips rows without a name and reports the row number", async () => {
    mockExisting([]);
    vi.spyOn(WorkerModel, "insertMany").mockImplementation(async (docs: any) => docs);
    const result = await WorkerService.bulkCreate(scope, [{ fullName: "  ", phone: "0912345678" }]);
    expect(result.importedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(result.errors[0]).toMatchObject({ row: 1, reason: expect.stringContaining("Họ và tên") });
  });

  it("skips a phone that already exists even when stored in a different format", async () => {
    mockExisting([{ phone: "0912 345 678" }]);
    vi.spyOn(WorkerModel, "insertMany").mockImplementation(async (docs: any) => docs);
    const result = await WorkerService.bulkCreate(scope, [{ fullName: "A", phone: "+84912345678" }]);
    expect(result.importedCount).toBe(0);
    expect(result.errors[0].reason).toContain("Số điện thoại đã tồn tại");
  });

  it("skips duplicate phones inside the same file", async () => {
    mockExisting([]);
    vi.spyOn(WorkerModel, "insertMany").mockImplementation(async (docs: any) => docs);
    const result = await WorkerService.bulkCreate(scope, [
      { fullName: "A", phone: "0912345678" },
      { fullName: "B", phone: "0912.345.678" },
    ]);
    expect(result.importedCount).toBe(1);
    expect(result.errors[0]).toMatchObject({ row: 2, reason: expect.stringContaining("trùng") });
  });

  it("skips duplicate email and idCard against existing rows", async () => {
    mockExisting([{ phone: "0900000000", email: "a@example.com", idCard: "001" }]);
    vi.spyOn(WorkerModel, "insertMany").mockImplementation(async (docs: any) => docs);
    const result = await WorkerService.bulkCreate(scope, [
      { fullName: "A", phone: "0912345678", email: "A@Example.com" },
      { fullName: "B", phone: "0987654321", idCard: " 001 " },
    ]);
    expect(result.importedCount).toBe(0);
    expect(result.errors.map((e) => e.reason)).toEqual([
      expect.stringContaining("Email đã tồn tại"),
      expect.stringContaining("CCCD/CMND đã tồn tại"),
    ]);
  });

  it("assigns imported workers to a project when a project id is supplied", async () => {
    mockExisting([]);
    vi.spyOn(WorkerModel, "insertMany").mockResolvedValue([{ _id: "w1" }, { _id: "w2" }] as any);
    const assign = vi.spyOn(WorkerProjectModel, "findOneAndUpdate").mockResolvedValue({} as any);
    const projectId = new Types.ObjectId().toString();
    await WorkerService.bulkCreate(scope, [
      { fullName: "A", phone: "0912345678" },
      { fullName: "B", phone: "0987654321" },
    ], projectId);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign.mock.calls[0][1]).toEqual({ $addToSet: { workerIds: { $each: ["w1", "w2"] } } });
  });

  it("does not touch the database when every row is invalid", async () => {
    mockExisting([]);
    const insertMany = vi.spyOn(WorkerModel, "insertMany");
    const result = await WorkerService.bulkCreate(scope, [{ fullName: "", phone: "" }]);
    expect(insertMany).not.toHaveBeenCalled();
    expect(result.importedCount).toBe(0);
  });
});

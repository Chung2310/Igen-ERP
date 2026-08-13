import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose, { Types } from "mongoose";
import { WorkerLaborContractModel } from "../models/worker-labor-contract.model";
import { WorkerModel } from "../models/worker.model";
import {
  WorkerLaborContractService,
  buildWorkerLaborContractQuery,
  isValidIsoCalendarDate,
  normalizeWorkerLaborContractInput,
  resolveAlertLevel,
  withAlertLevel,
} from "./worker-labor-contract.service";

const mongoSession = {
  withTransaction: vi.fn(async (operation: () => Promise<void>) => operation()),
  endSession: vi.fn(async () => undefined),
};

beforeEach(() => {
  mongoSession.withTransaction.mockClear();
  mongoSession.endSession.mockClear();
  vi.spyOn(mongoose, "startSession").mockResolvedValue(mongoSession as any);
});

afterEach(() => vi.restoreAllMocks());

const TODAY = new Date(2026, 7, 13); // 13/08/2026

function contractDoc(overrides: Record<string, unknown> = {}) {
  const id = new Types.ObjectId();
  return {
    _id: id,
    rootContractId: id,
    workerId: new Types.ObjectId(),
    code: "HD-01",
    clientName: "Công ty A",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "active",
    sequence: 1,
    lockedAt: null,
    ...overrides,
  };
}

describe("worker labor contract service", () => {
  it("scopes contracts by company and branch and hides soft-deleted rows", () => {
    const branchId = new Types.ObjectId();
    const query = buildWorkerLaborContractQuery({
      companyCode: "ACME",
      branchId: branchId.toString(),
    });

    expect(query.companyCode).toBe("ACME");
    expect(query.branchId?.toString()).toBe(branchId.toString());
    expect(query.deletedAt).toBeNull();
  });

  it("requires the contract essentials and a valid period", () => {
    expect(() => normalizeWorkerLaborContractInput({ code: "" })).toThrow(/Mã hợp đồng/);
    expect(() =>
      normalizeWorkerLaborContractInput({ code: "hd-1", clientName: "" }),
    ).toThrow(/Khách hàng/);
    expect(() =>
      normalizeWorkerLaborContractInput({
        code: "hd-1",
        clientName: "A",
        startDate: "2026-05-01",
        endDate: "2026-05-01",
      }),
    ).toThrow(/sau ngày bắt đầu/);

    expect(
      normalizeWorkerLaborContractInput({
        code: " hd-1 ",
        clientName: " Công ty A ",
        startDate: "2026-01-01",
        endDate: "2026-06-30",
      }),
    ).toMatchObject({ code: "HD-1", clientName: "Công ty A", status: "draft" });
  });

  it.each(["2026-02-30", "2026-99-99", "2026-00-10", "not-a-date"])(
    "rejects invalid calendar date %s",
    (value) => {
      expect(isValidIsoCalendarDate(value)).toBe(false);
      expect(() =>
        normalizeWorkerLaborContractInput({
          code: "HD-DATE",
          clientName: "Công ty A",
          startDate: value,
          endDate: "2026-12-31",
        }),
      ).toThrow(/ngày hợp lệ.*YYYY-MM-DD/i);
    },
  );

  it.each([
    ["2026-09-14", "ok"],
    ["2026-09-12", "expiring"],
    ["2026-08-14", "expiring"],
    ["2026-08-13", "expiring"],
    ["2026-08-12", "expired"],
  ])("marks %s as %s at the 30-day threshold", (endDate, expected) => {
    expect(resolveAlertLevel(endDate, "active", TODAY)).toBe(expected);
  });

  it("stops warning about periods that were already renewed or terminated", () => {
    expect(resolveAlertLevel("2026-01-01", "renewed", TODAY)).toBe("ok");
    expect(resolveAlertLevel("2026-01-01", "terminated", TODAY)).toBe("ok");
  });

  it("returns expired as the effective status without mutating stored status", () => {
    const stored = contractDoc({ endDate: "2026-08-12", status: "active" });
    const decorated = withAlertLevel(stored as any, TODAY);

    expect(decorated).toMatchObject({ status: "expired", alertLevel: "expired" });
    expect(stored.status).toBe("active");
  });

  it("keeps the previous period untouched when renewing", async () => {
    const current = contractDoc();
    // findOne({_id}).lean() trả kỳ hiện tại; findOne({code}) là bước kiểm tra trùng mã.
    vi.spyOn(WorkerLaborContractModel, "findOne").mockImplementation(
      ((query: any) =>
        query?.code
          ? Promise.resolve(null)
          : ({ lean: () => Promise.resolve(current) } as any)) as any,
    );
    const savedNext = { _id: new Types.ObjectId(), sequence: 2 };
    const save = vi
      .spyOn(WorkerLaborContractModel.prototype, "save")
      .mockResolvedValue(savedNext as any);
    const close = vi
      .spyOn(WorkerLaborContractModel, "findOneAndUpdate")
      .mockResolvedValue({ ...current, status: "renewed" } as any);

    const result = await WorkerLaborContractService.renew(
      { companyCode: "ACME" },
      current._id.toString(),
      {
        code: "HD-02",
        startDate: "2027-01-01",
        endDate: "2027-12-31",
      },
      "user@acme.vn",
    );

    expect(save).toHaveBeenCalledTimes(1);
    const created = (save.mock.instances[0] || {}) as any;
    expect(created.sequence).toBe(2);
    expect(created.previousContractId?.toString()).toBe(current._id.toString());
    expect(created.previousEndDate).toBe("2026-12-31");
    expect(created.rootContractId?.toString()).toBe(current.rootContractId.toString());

    // Kỳ cũ chỉ được đánh dấu đã gia hạn, ngày và điều khoản không bị đụng tới.
    const [, update] = close.mock.calls[0];
    expect(Object.keys((update as any).$set).sort()).toEqual(
      ["lockedAt", "renewedAt", "renewedBy", "status"].sort(),
    );
    expect((update as any).$set.status).toBe("renewed");
    expect(result.current).toBe(savedNext);
    expect(mongoose.startSession).toHaveBeenCalledTimes(1);
    expect(mongoSession.withTransaction).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ session: mongoSession });
    expect((close.mock.calls[0][2] as any).session).toBe(mongoSession);
    expect(mongoSession.endSession).toHaveBeenCalledTimes(1);
  });

  it("refuses to renew a period that was already renewed", async () => {
    const current = contractDoc({ status: "renewed" });
    vi.spyOn(WorkerLaborContractModel, "findOne").mockReturnValue({
      lean: () => Promise.resolve(current),
    } as any);
    const save = vi.spyOn(WorkerLaborContractModel.prototype, "save");

    await expect(
      WorkerLaborContractService.renew({ companyCode: "ACME" }, current._id.toString(), {
        code: "HD-03",
        startDate: "2027-01-01",
        endDate: "2027-12-31",
      }),
    ).rejects.toThrow(/đã được gia hạn/);
    expect(save).not.toHaveBeenCalled();
  });

  it("refuses a renewal that does not extend beyond the current end date", async () => {
    const current = contractDoc();
    vi.spyOn(WorkerLaborContractModel, "findOne").mockReturnValue({
      lean: () => Promise.resolve(current),
    } as any);
    const save = vi.spyOn(WorkerLaborContractModel.prototype, "save");

    await expect(
      WorkerLaborContractService.renew({ companyCode: "ACME" }, current._id.toString(), {
        code: "HD-04",
        startDate: "2026-06-01",
        endDate: "2026-11-30",
      }),
    ).rejects.toThrow(/sau ngày kết thúc kỳ hiện tại/);
    expect(save).not.toHaveBeenCalled();
  });

  it.each(["2026-06-01", "2026-12-31"])(
    "refuses a renewal starting on or before the current end date (%s)",
    async (startDate) => {
      const current = contractDoc();
      vi.spyOn(WorkerLaborContractModel, "findOne").mockReturnValue({
        lean: () => Promise.resolve(current),
      } as any);
      const save = vi.spyOn(WorkerLaborContractModel.prototype, "save");

      await expect(
        WorkerLaborContractService.renew({ companyCode: "ACME" }, current._id.toString(), {
          code: "HD-NEXT",
          startDate,
          endDate: "2027-12-31",
        }),
      ).rejects.toThrow(/ngày bắt đầu kỳ mới phải sau ngày kết thúc kỳ hiện tại/i);
      expect(save).not.toHaveBeenCalled();
    },
  );

  it("refuses to rewrite the dates or terms of a locked period", async () => {
    const current = contractDoc({ lockedAt: new Date(), status: "renewed" });
    vi.spyOn(WorkerLaborContractModel, "findOne").mockReturnValue({
      lean: () => Promise.resolve(current),
    } as any);
    const update = vi.spyOn(WorkerLaborContractModel, "findOneAndUpdate");

    await expect(
      WorkerLaborContractService.update({ companyCode: "ACME" }, current._id.toString(), {
        endDate: "2027-06-30",
      }),
    ).rejects.toThrow(/không thể sửa ngày hoặc điều khoản/);
    expect(update).not.toHaveBeenCalled();
  });

  it("still allows annotating a locked period", async () => {
    const current = contractDoc({ lockedAt: new Date(), status: "renewed" });
    vi.spyOn(WorkerLaborContractModel, "findOne").mockReturnValue({
      lean: () => Promise.resolve(current),
    } as any);
    const update = vi
      .spyOn(WorkerLaborContractModel, "findOneAndUpdate")
      .mockResolvedValue(current as any);

    await WorkerLaborContractService.update({ companyCode: "ACME" }, current._id.toString(), {
      note: "Đã bàn giao bản cứng",
    });

    expect((update.mock.calls[0][1] as any).$set).toEqual({ note: "Đã bàn giao bản cứng" });
  });

  it("refuses to delete a locked historical period", async () => {
    const current = contractDoc({ lockedAt: new Date(), status: "renewed" });
    vi.spyOn(WorkerLaborContractModel, "findOne").mockReturnValue({
      lean: () => Promise.resolve(current),
    } as any);
    const update = vi.spyOn(WorkerLaborContractModel, "findOneAndUpdate");

    await expect(
      WorkerLaborContractService.delete({ companyCode: "ACME" }, current._id.toString()),
    ).rejects.toThrow(/thuộc lịch sử gia hạn.*không thể xóa/i);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a worker outside the scope before writing anything", async () => {
    vi.spyOn(WorkerLaborContractModel, "findOne").mockResolvedValue(null as any);
    const findWorker = vi.spyOn(WorkerModel, "findOne").mockResolvedValue(null as any);
    const save = vi.spyOn(WorkerLaborContractModel.prototype, "save");

    await expect(
      WorkerLaborContractService.create(
        { companyCode: "ACME" },
        {
          workerId: new Types.ObjectId().toString(),
          code: "HD-05",
          clientName: "Công ty B",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
        },
      ),
    ).rejects.toThrow(/Không tìm thấy người lao động/);

    expect(findWorker).toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});

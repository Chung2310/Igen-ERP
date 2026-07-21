import { describe, expect, it, vi } from "vitest";

vi.mock("../service/company-work-calendar.service", () => ({
  toVietnamDate: vi.fn(() => "2026-04-30"),
  getDayContext: vi.fn(async (_companyCode: string, date: string) => ({
    date,
    isWorkingDay: false,
    label: "Giỗ Tổ Hùng Vương",
    dayType: "holiday",
  })),
}));

vi.mock("../model/timekeeping.model", () => ({
  TimekeepingLogModel: {
    findOne: vi.fn(() => ({ lean: vi.fn(async () => null) })),
  },
}));

import { toVietnamDate, getDayContext } from "../service/company-work-calendar.service";
import { timekeepingController } from "./timekeeping.controller";

function createMockRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe("timekeepingController.getTodayStatus calendar context", () => {
  it("uses the Vietnam local date independent of server timezone", async () => {
    const req: any = { user: { id: "u1", companyCode: "IGEN" } };
    const res = createMockRes();

    await timekeepingController.getTodayStatus(req, res);

    expect(toVietnamDate).toHaveBeenCalled();
    expect(getDayContext).toHaveBeenCalledWith("IGEN", "2026-04-30");
  });

  it("includes workCalendar context in the response alongside the log", async () => {
    const req: any = { user: { id: "u1", companyCode: "IGEN" } };
    const res = createMockRes();

    await timekeepingController.getTodayStatus(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.data).toHaveProperty("log", null);
    expect(payload.data.workCalendar).toEqual({
      date: "2026-04-30",
      isWorkingDay: false,
      label: "Giỗ Tổ Hùng Vương",
    });
  });
});

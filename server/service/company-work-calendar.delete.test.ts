import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanyWorkCalendarAuditModel } from "../model/company-work-calendar-audit.model";
import { CompanyWorkCalendarDayModel } from "../model/company-work-calendar.model";
import { CalendarValidationError, deleteAdminDay } from "./company-work-calendar.service";

afterEach(() => vi.restoreAllMocks());

describe("deleteAdminDay", () => {
  it("deletes only an admin day in the company and keeps an audit snapshot", async () => {
    const day = { _id: "day-1", companyCode: "MAIN", source: "admin", date: "2026-01-08", name: "Nghỉ bù" };
    const remove = vi.spyOn(CompanyWorkCalendarDayModel, "findOneAndDelete").mockResolvedValue({ toObject: () => day } as any);
    const audit = vi.spyOn(CompanyWorkCalendarAuditModel, "create").mockResolvedValue({} as any);

    await expect(deleteAdminDay("MAIN", "day-1", "admin-1")).resolves.toEqual(day);
    expect(remove).toHaveBeenCalledWith({ _id: "day-1", companyCode: "MAIN", source: "admin" });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ companyCode: "MAIN", calendarDayId: "day-1", action: "deleted", actorId: "admin-1", before: day }));
  });

  it("rejects a system day even when a delete request reaches the service", async () => {
    vi.spyOn(CompanyWorkCalendarDayModel, "findOneAndDelete").mockResolvedValue(null);
    vi.spyOn(CompanyWorkCalendarDayModel, "findOne").mockReturnValue({ select: () => ({ lean: async () => ({ source: "system" }) }) } as any);
    const audit = vi.spyOn(CompanyWorkCalendarAuditModel, "create");

    await expect(deleteAdminDay("MAIN", "day-2", "admin-1")).rejects.toThrow(CalendarValidationError);
    expect(audit).not.toHaveBeenCalled();
  });
});

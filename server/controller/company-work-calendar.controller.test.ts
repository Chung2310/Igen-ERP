import { describe, expect, it } from "vitest";
import { assertCalendarAdmin, CalendarAuthorizationError } from "./company-work-calendar.controller";

describe("company work calendar authorization", () => {
  it.each(["admin", "superadmin"])("allows %s", (role) => {
    expect(() => assertCalendarAdmin({ id: "actor", companyCode: "IGEN", role })).not.toThrow();
  });

  it.each(["user", "manager", undefined])("rejects role %s", (role) => {
    expect(() => assertCalendarAdmin({ id: "actor", companyCode: "IGEN", role })).toThrow(CalendarAuthorizationError);
  });

  it("rejects missing tenant or actor identity", () => {
    expect(() => assertCalendarAdmin({ id: "", companyCode: "IGEN", role: "admin" })).toThrow(CalendarAuthorizationError);
    expect(() => assertCalendarAdmin({ id: "actor", companyCode: "", role: "admin" })).toThrow(CalendarAuthorizationError);
  });
});

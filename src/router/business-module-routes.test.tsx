import { describe, expect, it } from "vitest";
import { filterEnabledTabs, resolveEnabledTab } from "../config/modules";
import { APP_ROUTES } from "./route-config";

describe("business module routing", () => {
  it("prevents labor tenants from resolving to student", () => {
    expect(resolveEnabledTab("QUẢN LÝ HỌC VIÊN", ["student", "worker"], "labor")).toBe("TỔNG QUAN");
  });

  it("keeps the worker tab for labor tenants", () => {
    expect(filterEnabledTabs(["QUẢN LÝ HỌC VIÊN", "QUẢN LÝ LAO ĐỘNG"], ["student", "worker"], "labor"))
      .toEqual(["QUẢN LÝ LAO ĐỘNG"]);
  });

  it("registers retail and grants route access to either retail permission", () => {
    const route = APP_ROUTES.find((item) => item.tab === "BÁN LẺ");
    expect(route).toBeDefined();
    expect(route?.canAccess?.({ role: "user", permissions: ["retail:read"] } as any)).toBe(true);
    expect(route?.canAccess?.({ role: "user", permissions: ["retail:manage"] } as any)).toBe(true);
    expect(route?.canAccess?.({ role: "user", permissions: [] } as any)).toBe(false);
  });

  it("grants finance route access to either finance permission", () => {
    const route = APP_ROUTES.find((item) => item.tab === "TÀI CHÍNH");
    expect(route).toBeDefined();
    expect(route?.canAccess?.({ role: "user", permissions: ["finance-receivable:read"] } as any)).toBe(true);
    expect(route?.canAccess?.({ role: "user", permissions: ["finance-receivable:manage"] } as any)).toBe(true);
    expect(route?.canAccess?.({ role: "user", permissions: [] } as any)).toBe(false);
  });
});

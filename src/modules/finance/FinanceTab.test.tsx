import { describe, expect, it } from "vitest";
import { APP_ROUTES } from "../../router/route-config";
import { filterEnabledTabs } from "../../config/modules";
import { FINANCE_SUB_TABS, getAllowedFinanceTabSlugs, resolveFinanceSubTab } from "./FinanceWorkspace";

describe("Finance workspace routing and permissions", () => {
  it("registers the Finance application route for every receivable permission", () => {
    const route = APP_ROUTES.find((item) => item.tab === "TÀI CHÍNH");
    expect(route).toBeDefined();
    for (const permission of ["finance:read", "finance:manage", "finance:manage"]) {
      expect(route?.canAccess?.({ role: "user", permissions: [permission] } as any)).toBe(true);
    }
    expect(route?.canAccess?.({ role: "user", permissions: [] } as any)).toBe(false);
  });

  it("shows receivables to readers and reminder operations only to adjusters", () => {
    expect(getAllowedFinanceTabSlugs(["finance:read"])).toEqual(["cong-no", "tuoi-no", "nhac-no"]);
    expect(getAllowedFinanceTabSlugs(["finance:manage"])).toEqual(["cong-no"]);
    expect(getAllowedFinanceTabSlugs(["finance:manage"])).toEqual(["cong-no", "nhac-no"]);
    expect(getAllowedFinanceTabSlugs(["*"])).toEqual(FINANCE_SUB_TABS.map((tab) => tab.slug));
  });

  it("only exposes the application tab when the tenant enables Finance", () => {
    expect(filterEnabledTabs(["TÀI CHÍNH"], [], "general")).toEqual([]);
    expect(filterEnabledTabs(["TÀI CHÍNH"], ["finance"], "general")).toEqual(["TÀI CHÍNH"]);
  });

  it("keeps valid deep links and falls back to the first allowed sub-route", () => {
    expect(resolveFinanceSubTab("?sub=nhac-no", ["cong-no", "nhac-no"])).toBe("NHẮC NỢ");
    expect(resolveFinanceSubTab("?sub=tuoi-no", ["cong-no", "tuoi-no", "nhac-no"])).toBe("TUỔI NỢ");
    expect(resolveFinanceSubTab("?sub=nhac-no", ["cong-no"])).toBe("CÔNG NỢ");
    expect(resolveFinanceSubTab("?sub=unknown", ["nhac-no"])).toBe("NHẮC NỢ");
  });
});

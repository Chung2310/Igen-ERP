import { describe, expect, it } from "vitest";
import { APP_ROUTES } from "../../router/route-config";
import { filterEnabledTabs } from "../../config/modules";
import { FINANCE_SUB_TABS, getAllowedFinanceTabSlugs, resolveFinanceSubTab } from "./FinanceWorkspace";

describe("Finance workspace routing and permissions", () => {
  it("registers the Finance application route for every receivable permission", () => {
    const route = APP_ROUTES.find((item) => item.tab === "TÀI CHÍNH");
    expect(route).toBeDefined();
    for (const permission of ["finance-wallet:read", "finance-wallet:manage", "finance-receivable:read", "finance-receivable:manage"]) {
      expect(route?.canAccess?.({ role: "user", permissions: [permission] } as any)).toBe(true);
    }
    expect(route?.canAccess?.({ role: "user", permissions: [] } as any)).toBe(false);
  });

  it("shows every receivable view to read or manage permissions", () => {
    expect(getAllowedFinanceTabSlugs(["finance-receivable:read"])).toEqual(["cong-no", "tuoi-no", "nhac-no"]);
    expect(getAllowedFinanceTabSlugs(["finance-receivable:manage"])).toEqual(["cong-no", "tuoi-no", "nhac-no"]);
    expect(getAllowedFinanceTabSlugs(["*"])).toEqual(FINANCE_SUB_TABS.map((tab) => tab.slug));
  });

  it("opens the Finance tab for asset-only permissions", () => {
    const route = APP_ROUTES.find((item) => item.tab === "TÀI CHÍNH");
    for (const permission of ["asset:read", "asset:manage"]) {
      expect(route?.canAccess?.({ role: "user", permissions: [permission] } as any)).toBe(true);
    }
  });

  it("separates asset views from receivable views by permission", () => {
    expect(getAllowedFinanceTabSlugs(["asset:read"])).toEqual(["tai-san", "khau-hao", "kiem-ke"]);
    expect(getAllowedFinanceTabSlugs(["asset:manage"])).toEqual(["tai-san", "khau-hao", "kiem-ke"]);
    expect(getAllowedFinanceTabSlugs(["finance-receivable:read"])).not.toContain("tai-san");
    expect(getAllowedFinanceTabSlugs(["finance-receivable:read", "asset:read"])).toEqual([
      "cong-no", "tuoi-no", "nhac-no", "tai-san", "khau-hao", "kiem-ke",
    ]);
  });

  it("falls back to the first asset view for users without receivable access", () => {
    expect(resolveFinanceSubTab("?sub=kiem-ke", ["tai-san", "khau-hao", "kiem-ke"])).toBe("KIỂM KÊ");
    expect(resolveFinanceSubTab("?sub=cong-no", ["tai-san", "khau-hao", "kiem-ke"])).toBe("TÀI SẢN");
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

import { describe, expect, it } from "vitest";
import { HR_SUB_TAB_ROUTES } from "../router/subTabRoutes";
import { canAccessRecruitment } from "./HRTab";

describe("recruitment navigation", () => {
  it("allows users with either recruitment read or manage permission", () => {
    expect(canAccessRecruitment("superadmin", () => false)).toBe(true);
    expect(canAccessRecruitment("admin", () => false)).toBe(true);
    expect(canAccessRecruitment("manager", (code) => code === "recruitment:read")).toBe(true);
    expect(canAccessRecruitment("manager", (code) => code === "recruitment:manage")).toBe(true);
    expect(canAccessRecruitment("manager", () => false)).toBe(false);
  });

  it("defines a stable recruitment deep-link slug", () => {
    expect(HR_SUB_TAB_ROUTES).toContainEqual({ slug: "tuyen-dung", value: "TUYỂN DỤNG" });
  });
});

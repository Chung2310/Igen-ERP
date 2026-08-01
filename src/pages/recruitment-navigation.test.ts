import { describe, expect, it } from "vitest";
import { HR_SUB_TAB_ROUTES } from "../router/subTabRoutes";
import { canAccessRecruitment } from "./HRTab";

describe("recruitment navigation", () => {
  it("allows admins and explicitly authorized roles only", () => {
    expect(canAccessRecruitment("admin", () => false)).toBe(true);
    expect(canAccessRecruitment("manager", (code) => code === "recruitment:manage")).toBe(true);
    expect(canAccessRecruitment("manager", () => false)).toBe(false);
  });

  it("defines a stable recruitment deep-link slug", () => {
    expect(HR_SUB_TAB_ROUTES).toContainEqual({ slug: "tuyen-dung", value: "TUYỂN DỤNG" });
  });
});

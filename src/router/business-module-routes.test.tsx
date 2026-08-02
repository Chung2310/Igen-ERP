import { describe, expect, it } from "vitest";
import { filterEnabledTabs, resolveEnabledTab } from "../config/modules";

describe("business module routing", () => {
  it("prevents labor tenants from resolving to student", () => {
    expect(resolveEnabledTab("QUẢN LÝ HỌC VIÊN", ["student", "worker"], "labor")).toBe("TỔNG QUAN");
  });

  it("keeps the worker tab for labor tenants", () => {
    expect(filterEnabledTabs(["QUẢN LÝ HỌC VIÊN", "QUẢN LÝ LAO ĐỘNG"], ["student", "worker"], "labor"))
      .toEqual(["QUẢN LÝ LAO ĐỘNG"]);
  });
});

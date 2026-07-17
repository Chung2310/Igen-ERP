import { describe, expect, it } from "vitest";
import { isSuperAdminPath } from "./superAdminRoute";

describe("isSuperAdminPath", () => {
  it("recognizes the dedicated control-plane path with optional trailing slash", () => {
    expect(isSuperAdminPath("/super-admin")).toBe(true);
    expect(isSuperAdminPath("/super-admin/")).toBe(true);
    expect(isSuperAdminPath("/SUPER-ADMIN")).toBe(true);
  });

  it("does not intercept normal ERP paths", () => {
    expect(isSuperAdminPath("/")).toBe(false);
    expect(isSuperAdminPath("/dashboard")).toBe(false);
  });
});

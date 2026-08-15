import { describe, expect, it } from "vitest";

import { DEFAULT_ROLE_PERMISSIONS } from "./auth";

describe("access:manage permission defaults", () => {
  it("grants face management to admin and superadmin defaults", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.superadmin).toContain("*");
    expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain("access:manage");
  });

  it("does not grant face management to ordinary roles by default", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.manager).not.toContain("access:manage");
    expect(DEFAULT_ROLE_PERMISSIONS.user).not.toContain("access:manage");
  });
});
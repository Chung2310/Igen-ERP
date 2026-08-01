import { describe, expect, it } from "vitest";
import { getRouteByTab } from "./route-config";
import type { UserProfile } from "../types";

function profileWithRole(role: UserProfile["role"]): UserProfile {
  return { role } as UserProfile;
}

describe("route guard của trang Phân tích & Báo cáo", () => {
  const route = getRouteByTab("PHÂN TÍCH & BÁO CÁO");

  it("có khai báo canAccess (thiếu là user gõ thẳng URL vẫn vào được)", () => {
    expect(route?.canAccess).toBeTypeOf("function");
  });

  it("cho phép admin và superadmin", () => {
    expect(route?.canAccess?.(profileWithRole("admin"))).toBe(true);
    expect(route?.canAccess?.(profileWithRole("superadmin"))).toBe(true);
  });

  it("chặn branch_owner — vai trò này dùng trang Tổng quan chung", () => {
    expect(route?.canAccess?.(profileWithRole("branch_owner"))).toBe(false);
  });

  it("chặn manager và user", () => {
    expect(route?.canAccess?.(profileWithRole("manager"))).toBe(false);
    expect(route?.canAccess?.(profileWithRole("user"))).toBe(false);
  });
});

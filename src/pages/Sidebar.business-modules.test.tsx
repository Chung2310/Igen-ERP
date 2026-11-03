// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Sidebar, { getAvailableMenuItems } from "./Sidebar";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    userProfile: {
      role: "admin",
      enabledModules: ["student", "worker", "hr", "finance"],
      businessType: "labor",
      permissions: ["*"],
    },
    hasPermission: () => true,
  }),
}));

vi.mock("../hooks/useMediaQuery", () => ({ useIsMobile: () => false }));

afterEach(cleanup);

describe("Sidebar business modules", () => {
  it("shows both enabled modules regardless of legacy business type", () => {
    render(<Sidebar activeTab="TỔNG QUAN" setActiveTab={vi.fn()} mobileOpen onMobileClose={vi.fn()} />);

    expect(screen.getByText("Lao động")).toBeTruthy();
    expect(screen.getByText("Học viên")).toBeTruthy();
  });

  it("shows Finance when the tenant enables the module", () => {
    render(<Sidebar activeTab="TỔNG QUAN" setActiveTab={vi.fn()} mobileOpen onMobileClose={vi.fn()} />);
    expect(screen.getByText("Tài chính")).toBeTruthy();
  });

  it("keeps disabled modules visible only for the detailed menu and distinguishes missing permission", () => {
    const profile = { role: "employee", enabledModules: ["hr"], permissions: [] } as unknown as Parameters<typeof getAvailableMenuItems>[0];
    const compact = getAvailableMenuItems(profile, () => false);
    const detailed = getAvailableMenuItems(profile, () => false, true);

    expect(compact.some((item) => item.label === "BÁN LẺ")).toBe(false);
    expect(detailed.find((item) => item.label === "BÁN LẺ")).toMatchObject({ locked: true, lockReason: "module" });
    expect(detailed.find((item) => item.label === "NHÂN SỰ")).toMatchObject({ locked: true, lockReason: "permission" });
  });
});

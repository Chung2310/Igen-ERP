// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Sidebar from "./Sidebar";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    userProfile: {
      role: "admin",
      enabledModules: ["student", "worker", "hr"],
      businessType: "labor",
      permissions: ["*"],
    },
    hasPermission: () => true,
  }),
}));

vi.mock("../hooks/useMediaQuery", () => ({ useIsMobile: () => false }));

afterEach(cleanup);

describe("Sidebar business modules", () => {
  it("shows worker and hides student for labor tenants", () => {
    render(<Sidebar activeTab="TỔNG QUAN" setActiveTab={vi.fn()} mobileOpen onMobileClose={vi.fn()} />);

    expect(screen.getByText("Lao động")).toBeTruthy();
    expect(screen.queryByText("Học viên")).toBeNull();
  });
});

// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardTab from "./DashboardTab";

const mockAuth = vi.hoisted(() => ({ enabledModules: ["hr", "finance", "retail", "student", "worker", "marketing"] }));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    userProfile: {
      uid: "u1",
      companyCode: "ACME",
      role: "admin",
      enabledModules: mockAuth.enabledModules,
      permissions: ["*"],
    },
    hasPermission: () => true,
  }),
}));

vi.mock("../components/dashboard/FinanceOverviewSection", () => ({
  default: () => <div data-testid="finance-section">Finance Dashboard Content</div>,
}));

vi.mock("../components/dashboard/RetailOverviewSection", () => ({
  default: () => <div data-testid="retail-section">Retail Dashboard Content</div>,
}));

vi.mock("../components/dashboard/HrOverviewSection", () => ({
  default: () => <div data-testid="hr-section">HR Dashboard Content</div>,
}));

vi.mock("../components/dashboard/MarketingOverviewSection", () => ({
  default: () => <div data-testid="marketing-section">Marketing Dashboard Content</div>,
}));

describe("DashboardTab consolidated hub", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.history.replaceState(null, "", "/dashboard");
    mockAuth.enabledModules = ["hr", "finance", "retail", "student", "worker", "marketing"];
  });

  it("defaults to the first available overview section", async () => {
    render(<DashboardTab />);
    expect(document.querySelector("#dashboard_sub_tabs_bar")?.getAttribute("data-layout")).toBe("horizontal");
    expect(document.querySelector("#dashboard_tab_wrapper")?.classList.contains("h-full")).toBe(true);
    expect(screen.getByRole("navigation", { name: "Phân hệ Tổng quan" }).textContent).not.toContain("Tổng quan hệ thống");
    expect(screen.queryByRole("button", { name: "Doanh nghiệp" })).toBeNull();
    expect(await screen.findByTestId("finance-section")).toBeTruthy();
    expect(window.location.search).toBe("?sub=tai-chinh");
  });

  it("redirects the removed enterprise overview link to an available section", async () => {
    window.history.replaceState(null, "", "/tong-quan?sub=doanh-nghiep");
    render(<DashboardTab />);
    expect(await screen.findByTestId("finance-section")).toBeTruthy();
    expect(window.location.search).toBe("?sub=tai-chinh");
  });

  it("uses the first enabled section when finance is unavailable", async () => {
    mockAuth.enabledModules = ["hr"];
    render(<DashboardTab />);
    expect(await screen.findByTestId("hr-section")).toBeTruthy();
    expect(window.location.search).toBe("?sub=nhan-su");
  });

  it("shows an empty state when no overview sections are available", () => {
    mockAuth.enabledModules = [];
    render(<DashboardTab />);
    expect(screen.getByText("Chưa có phân hệ tổng quan khả dụng.")).toBeTruthy();
    expect(screen.queryByTestId("finance-section")).toBeNull();
  });

  it("switches to Finance section when clicked", async () => {
    render(<DashboardTab />);
    const financeButtons = screen.getAllByText("Tài chính");
    fireEvent.click(financeButtons[0]);
    expect(await screen.findByTestId("finance-section")).toBeTruthy();
  });

  it("switches to HR section when clicked", async () => {
    render(<DashboardTab />);
    const hrButtons = screen.getAllByText("Nhân sự");
    fireEvent.click(hrButtons[0]);
    expect(await screen.findByTestId("hr-section")).toBeTruthy();
  });

  it("keeps the Marketing dashboard in the consolidated overview", async () => {
    render(<DashboardTab />);
    fireEvent.click(screen.getAllByRole("button", { name: /Marketing & Nội dung/ })[0]);
    expect(await screen.findByTestId("marketing-section")).toBeTruthy();
  });

  it("hides unchecked finance, retail and HR sections even for an admin", () => {
    mockAuth.enabledModules = ["student", "worker"];
    render(<DashboardTab />);
    const navigation = screen.getByRole("navigation", { name: "Phân hệ Tổng quan" });
    expect(navigation.textContent).not.toContain("Tài chính");
    expect(navigation.textContent).not.toContain("Bán lẻ & POS");
    expect(navigation.textContent).not.toContain("Nhân sự");
    expect(navigation.textContent).toContain("Học viên & Đào tạo");
  });
});


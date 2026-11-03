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

vi.mock("./BusinessDashboardTab", () => ({
  default: () => <div data-testid="business-section">Business Dashboard Content</div>,
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

  it("renders the sidebar and defaults to Doanh nghiệp section", async () => {
    render(<DashboardTab />);
    expect(screen.getByRole("navigation", { name: "Phân hệ Tổng quan" }).textContent).not.toContain("Tổng quan hệ thống");
    expect(screen.getAllByText("Doanh nghiệp").length).toBeGreaterThan(0);
    expect(await screen.findByTestId("business-section")).toBeTruthy();
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


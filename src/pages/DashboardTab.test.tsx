// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardTab from "./DashboardTab";

const mockAuth = vi.hoisted(() => ({
  enabledModules: ["hr", "finance", "retail", "student", "worker", "marketing"],
  canReadHealthcare: true,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    userProfile: {
      uid: "u1",
      companyCode: "ACME",
      role: "admin",
      enabledModules: mockAuth.enabledModules,
      permissions: ["*"],
    },
    hasPermission: (code: string) => !code.startsWith("healthcare:") || mockAuth.canReadHealthcare,
  }),
}));

vi.mock("../context/BranchContext", async importOriginal => ({
  ...await importOriginal<typeof import("../context/BranchContext")>(),
  useBranch: () => ({ activeBranchId: "branch-a", activeBranch: { name: "Cơ sở A" }, loading: false }),
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
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    window.history.replaceState(null, "", "/dashboard");
    mockAuth.enabledModules = ["hr", "finance", "retail", "student", "worker", "marketing"];
    mockAuth.canReadHealthcare = true;
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

  it("places the period selector beside the tabs and shows dates only for a custom range", async () => {
    render(<DashboardTab />);
    const navigation = document.querySelector("#dashboard_sub_tabs_bar");
    const period = screen.getByRole("region", { name: "Kỳ thống kê Tổng quan" });
    expect(navigation?.contains(period)).toBe(true);
    expect(document.querySelector("#dashboard_tab_content")?.contains(period)).toBe(false);
    expect(screen.queryByRole("region", { name: "Khoảng ngày tùy chọn" })).toBeNull();
    expect(period.querySelector("#overview-period-comparison")?.textContent).toMatch(/^So với T\d{1,2}\/\d{4}$/);

    fireEvent.click(screen.getByRole("button", { name: "Kỳ thống kê" }));
    fireEvent.click(screen.getByRole("option", { name: "Khoảng ngày" }));
    const customRange = screen.getByRole("region", { name: "Khoảng ngày tùy chọn" });
    expect(customRange.classList.contains("justify-end")).toBe(true);
    expect(customRange.querySelectorAll(".w-36")).toHaveLength(2);
    expect(period.querySelector("#overview-period-comparison")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Từ ngày Tổng quan" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Đến ngày Tổng quan" })).toBeTruthy();
    expect(await screen.findByTestId("finance-section")).toBeTruthy();
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
    const marketingTab = screen.getByRole("button", { name: "Marketing & CRM" });
    expect(marketingTab.querySelector("svg")?.classList.contains("lucide-messages-square")).toBe(true);
    fireEvent.click(marketingTab);
    expect(await screen.findByTestId("marketing-section")).toBeTruthy();
  });

  it("loads Y tế only when selected and uses the shared period and branch", async () => {
    mockAuth.enabledModules = ["finance", "healthcare"];
    const patient = { _id: "1af48015-2b81-4be6-b3b1-d54d489ac78e", name: "Nguyễn An", code: "BN01" };
    const appointment = { _id: "6f045410-0c40-4aaf-80bb-f2ebcc39eb25", patientId: patient._id, startsAt: "2026-11-07T02:00:00Z", status: "confirmed" };
    const request = vi.fn(async (_url: string, _options: RequestInit) => Response.json({
      patients: 1, visitCount: 1, appointmentCount: 1, careCount: null,
      todayAppointments: [appointment], dueCare: [], patientReferences: [patient],
    }));
    vi.stubGlobal("fetch", request);
    render(<DashboardTab />);
    expect(await screen.findByTestId("finance-section")).toBeTruthy();
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Y tế" }));
    expect(await screen.findByText("Lượt khám trong kỳ")).toBeTruthy();
    expect(window.location.search).toBe("?sub=y-te");
    expect(request.mock.calls[0]?.[0]).toMatch(/^\/api\/v1\/healthcare\/overview\?from=\d{4}-\d{2}-01&to=/);
    expect(new Headers(request.mock.calls[0]?.[1].headers).get("x-branch-id")).toBe("branch-a");
    expect(screen.getByRole("link", { name: "BN01 · Nguyễn An" }).getAttribute("href"))
      .toBe(`/quan-ly-y-te?sub=benh-nhan&branch=branch-a&patientId=${patient._id}`);
    expect(screen.queryByText("Việc chăm sóc đến hạn")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Kỳ thống kê" }));
    fireEvent.click(screen.getByRole("option", { name: "Hôm nay" }));
    expect(await screen.findByText("Lượt khám hôm nay")).toBeTruthy();
    expect(request.mock.calls[1]?.[0]).toMatch(/from=(\d{4}-\d{2}-\d{2})&to=\1$/);
  });

  it("hides Y tế for a user without healthcare access even when opening its overview URL", async () => {
    mockAuth.enabledModules = ["finance", "healthcare"];
    mockAuth.canReadHealthcare = false;
    window.history.replaceState(null, "", "/tong-quan?sub=y-te");
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    render(<DashboardTab />);
    expect(await screen.findByTestId("finance-section")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Y tế" })).toBeNull();
    expect(request).not.toHaveBeenCalled();
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


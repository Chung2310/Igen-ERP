// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TabType } from "../types";

const mockLogout = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockModules = vi.hoisted(() => ({ enabled: ["hr", "chat", "social-marketing"] }));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: { uid: "u1", role: "employee", displayName: "Nhân viên", email: "staff@example.com", companyCode: "MAIN", enabledModules: mockModules.enabled, permissions: ["marketing:read", "chat:read"] }, hasPermission: () => true, logout: mockLogout }),
}));
vi.mock("../context/BranchContext", () => ({
  useBranch: () => ({ branches: [], activeBranchId: "", setActiveBranchId: vi.fn(), activeBranch: null }),
}));
vi.mock("../services/authService", () => ({ authService: {} }));
vi.mock("../services/notificationService", () => ({
  notificationService: { getNotifications: vi.fn().mockResolvedValue({ data: [], unreadCount: 0 }) },
}));
vi.mock("../services/socketService", () => ({ socketService: { on: vi.fn(() => vi.fn()) } }));
vi.mock("./Toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../components/attendance/AttendanceCameraModal", () => ({
  default: () => <div data-testid="header-attendance-camera">camera</div>,
}));

import Header from "./Header";

describe("Header attendance with face checking disabled", () => {
  beforeEach(() => {
    mockModules.enabled = ["hr", "chat", "social-marketing"];
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    localStorage.setItem("accessToken", "token");
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) =>
          success({ coords: { latitude: 10.7, longitude: 106.6 } } as GeolocationPosition),
      },
    });
    vi.stubGlobal("fetch", vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => ({
      ok: true,
      json: async () => init?.method === "POST" ? ({ message: "Đã check-in" }) : ({ data: { log: null } }),
    })));
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("posts coordinates without opening the camera or attaching an image", async () => {
    const user = userEvent.setup();
    render(<Header currentTab={"TỔNG QUAN" as never} onSearchSelect={vi.fn()} />);
    expect(screen.queryByTitle("Tiện ích — mở nhanh các chức năng")).toBeNull();
    const checkIn = screen.getAllByRole("button", { name: /Check-In/i })[0];
    await user.click(checkIn);

    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    expect(screen.queryByTestId("header-attendance-camera")).toBeNull();
    const postCall = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "POST");
    const body = postCall?.[1]?.body as FormData;
    expect(body.get("latitude")).toBe("10.7");
    expect(body.get("longitude")).toBe("106.6");
    expect(body.has("file")).toBe(false);
  });

  it("keeps the back link to the feature list without the grid icon", () => {
    render(<Header currentTab="TỔNG QUAN" onSearchSelect={vi.fn()} />);
    expect(screen.queryByRole("textbox", { name: "Tìm kiếm trong ERP" })).toBeNull();
    expect(screen.queryByPlaceholderText("Tìm kiếm trong ERP...")).toBeNull();
    const backLink = screen.getByRole("link", { name: "Về danh sách tính năng" });
    expect(backLink.getAttribute("href")).toBe("/modules");
    expect(backLink.querySelector("circle")).toBeNull();
  });
  it("does not poll attendance or offer the assistant when only quotation is enabled", async () => {
    mockModules.enabled = ["quotation"];
    render(<Header currentTab="BÁO GIÁ" onSearchSelect={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Check-In|Check-Out/i })).toBeNull();
    expect((screen.getByRole("button", { name: "Mở Trợ lý AI" }) as HTMLButtonElement).disabled).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("/timekeeping/"))).toBe(false);
  });

  it("does not offer a dark mode control for a saved dark preference", () => {
    localStorage.setItem("theme", "dark");
    render(<Header currentTab="TỔNG QUAN" onSearchSelect={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Giao diện (sáng|tối)/ })).toBeNull();
  });

  it("opens AI quota, upgrade plans, and the assistant from their header icons", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<Header currentTab="NHÂN SỰ" onSearchSelect={navigate} />);

    await user.click(screen.getByRole("button", { name: "Xem hạn mức AI" }));
    await user.click(screen.getByRole("button", { name: "Mở gói nâng cấp AI" }));
    await user.click(screen.getByRole("button", { name: "Mở Trợ lý AI" }));
    expect(navigate.mock.calls).toEqual([["GÓI AI & LƯỢT SỬ DỤNG", "usage"], ["GÓI AI & LƯỢT SỬ DỤNG", "plans"], ["TRỢ LÝ AI"]]);
  });

  it("opens the compact assistant from the header without navigating to the full page", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const openAssistant = vi.fn();
    render(<Header currentTab="TRỢ LÝ AI" onSearchSelect={navigate} onAssistantOpen={openAssistant} />);

    await user.click(screen.getByRole("button", { name: "Mở Trợ lý AI" }));

    expect(openAssistant).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("restores the three legal links and closes the menu with Escape", async () => {
    const user = userEvent.setup();
    render(<Header currentTab="NHÂN SỰ" onSearchSelect={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Chính sách và quyền" });
    await user.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "Bảo mật" }).getAttribute("href")).toContain("/privacy-policy");
    expect(screen.getByRole("link", { name: "Điều khoản" }).getAttribute("href")).toContain("/terms-of-service");
    expect(screen.getByRole("link", { name: "Xóa dữ liệu" }).getAttribute("href")).toContain("/user-data-deletion");

    await user.keyboard("{Escape}");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it.each([
    ["NHÂN SỰ", "NHÂN SỰ"],
    ["ĐỐI TÁC", "HỌC VIÊN"],
    ["ĐỐI TÁC LAO ĐỘNG", "LAO ĐỘNG"],
    ["ĐỐI TÁC BÁN LẺ", "BÁN LẺ"],
    ["KHO TRI THỨC", "CRM"],
    ["TÍCH HỢP MARKETING", "CRM"],
  ])("shows the parent module for %s", (tab, label) => {
    render(<Header currentTab={tab as TabType} onSearchSelect={vi.fn()} />);
    expect(screen.getByText(label).textContent).toBe(label);
    if (tab !== label) expect(screen.queryByText(tab)).toBeNull();
  });

  it("shows account controls without the removed utility grid on the module launcher", () => {
    render(<Header variant="launcher" currentTab="TỔNG QUAN" onSearchSelect={vi.fn()} />);
    expect(screen.queryByTitle("Tiện ích — mở nhanh các chức năng")).toBeNull();
    expect(screen.queryByPlaceholderText("Tìm kiếm trong ERP...")).toBeNull();
    expect(screen.getByRole("button", { name: "Tài khoản Nhân viên" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Thông báo" })).toBeTruthy();
  });

  it("asks before logging out from the shared account menu", async () => {
    const user = userEvent.setup();
    render(<Header variant="launcher" currentTab="TỔNG QUAN" onSearchSelect={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Tài khoản Nhân viên" }));
    await user.click(screen.getByRole("button", { name: "Đăng xuất hệ thống" }));
    expect(screen.getByRole("dialog", { name: "Bạn có chắc đăng xuất không?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Đăng xuất" }).className).toContain("bg-red-600");
    expect(mockLogout).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Ở lại" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mockLogout).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Tài khoản Nhân viên" }));
    await user.click(screen.getByRole("button", { name: "Đăng xuất hệ thống" }));
    await user.click(screen.getByRole("button", { name: "Đăng xuất" }));
    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TabType } from "../types";

const mockLogout = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: { uid: "u1", role: "employee", displayName: "Nhân viên", email: "staff@example.com" }, hasPermission: () => true, logout: mockLogout }),
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

  it("opens a searchable module menu from the grid icon", async () => {
    const user = userEvent.setup();
    render(<Header currentTab="TỔNG QUAN" onSearchSelect={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Mở danh sách phân hệ" });
    expect(trigger.querySelectorAll("svg circle")).toHaveLength(9);
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Danh sách phân hệ và tính năng" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Nhân sự" }).getAttribute("href")).toBeTruthy();
    await user.type(screen.getByRole("searchbox", { name: "Tìm phân hệ hoặc tính năng" }), "nhân sự");
    expect(screen.getByRole("link", { name: "Nhân sự" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Kho & Sản phẩm" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Đóng danh sách phân hệ" }));
    expect(screen.queryByRole("dialog", { name: "Danh sách phân hệ và tính năng" })).toBeNull();
    expect(screen.queryByTitle("Mở menu")).toBeNull();
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

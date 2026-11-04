// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ModuleLauncher from "./ModuleLauncher";

vi.mock("./Header", () => ({ default: ({ variant }: { variant: string }) => <div data-testid="launcher-controls">{variant}</div> }));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    userProfile: {
      role: "admin",
      companyCode: "TEST",
      enabledModules: ["student", "worker", "hr", "finance", "resource", "chat", "social-marketing", "omni-inbox", "company-knowledge"],
      permissions: ["*"],
    },
    hasPermission: () => true,
    logout: vi.fn(),
  }),
}));

afterEach(cleanup);

describe("ModuleLauncher", () => {
  it("shows every enabled business area and omits disabled tenant modules", () => {
    render(<ModuleLauncher />);
    expect(screen.getByTestId("launcher-controls").textContent).toBe("launcher");
    expect(screen.getByRole("link", { name: "Học viên" }).getAttribute("href")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Lao động" }).getAttribute("href")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Bán lẻ" })).toBeNull();
    expect(screen.getByRole("link", { name: "Tích hợp & cấu hình" })).toBeTruthy();
    expect(screen.queryByText("Chiến dịch")).toBeNull();
    expect(screen.getByRole("link", { name: "Gói AI & lượt sử dụng" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Nhân sự" }).querySelector('.module-launcher-icon-tile')?.className).not.toContain('bg-');
    for (const name of ["Tài nguyên", "Tài khoản", "Hệ thống", "Trò chuyện"]) {
      expect(screen.getByRole("link", { name }).getAttribute("href")).toBeTruthy();
    }
  });
});

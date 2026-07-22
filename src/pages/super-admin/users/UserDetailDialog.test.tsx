// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { superAdminUserAccessService } from "../../../services/superAdminUserAccessService";
import { UserDetailDialog } from "./UserDetailDialog";

vi.mock("../../../services/superAdminUserAccessService", () => ({
  superAdminUserAccessService: {
    detail: vi.fn(),
    lock: vi.fn(),
    unlock: vi.fn(),
    revokeSessions: vi.fn(),
    resetTwoFactor: vi.fn(),
    assignRole: vi.fn(),
    startImpersonation: vi.fn(),
    stopImpersonation: vi.fn(),
    activity: vi.fn(),
  },
}));

const user = {
  _id: "user-1",
  email: "mai@acme.test",
  displayName: "Mai Nguyễn",
  role: "admin",
  status: "active",
  permissions: ["user:read"],
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(superAdminUserAccessService.detail).mockResolvedValue(user);
  vi.mocked(superAdminUserAccessService.activity).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
});

describe("UserDetailDialog", () => {
  it("loads fresh details and closes with Escape", async () => {
    const onClose = vi.fn();
    render(<UserDetailDialog tenantId="SYSTEM" userId="user-1" onClose={onClose} />);

    expect(screen.getByText("Đang tải thông tin người dùng…")).toBeTruthy();
    expect(await screen.findByText("Mai Nguyễn")).toBeTruthy();
    expect(superAdminUserAccessService.detail).toHaveBeenCalledWith("SYSTEM", "user-1");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("locks the account with a reason and refreshes details", async () => {
    vi.mocked(superAdminUserAccessService.lock).mockResolvedValue({ actionId: "action-1" });
    render(<UserDetailDialog tenantId="SYSTEM" userId="user-1" onClose={vi.fn()} />);
    await screen.findByText("Mai Nguyễn");

    fireEvent.change(screen.getByLabelText("Lý do thao tác bảo mật"), { target: { value: "Xử lý sự cố" } });
    fireEvent.click(screen.getByRole("button", { name: "Khóa tài khoản" }));

    await waitFor(() => expect(superAdminUserAccessService.lock).toHaveBeenCalledWith("SYSTEM", "user-1", { reason: "Xử lý sự cố" }));
    await waitFor(() => expect(superAdminUserAccessService.detail).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Đã khóa tài khoản.")).toBeTruthy();
  });

  it("updates the role with a written reason", async () => {
    vi.mocked(superAdminUserAccessService.assignRole).mockResolvedValue({ actionId: "action-2" });
    render(<UserDetailDialog tenantId="SYSTEM" userId="user-1" onClose={vi.fn()} />);
    await screen.findByText("Mai Nguyễn");

    fireEvent.change(screen.getByLabelText("Vai trò"), { target: { value: "user" } });
    fireEvent.change(screen.getByLabelText("Lý do thay đổi quyền"), { target: { value: "Điều chỉnh trách nhiệm" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu quyền truy cập" }));

    await waitFor(() => expect(superAdminUserAccessService.assignRole).toHaveBeenCalledWith(
      "SYSTEM", "user-1", "user", ["user:read"], { reason: "Điều chỉnh trách nhiệm" },
    ));
    expect(await screen.findByText("Đã cập nhật vai trò và quyền.")).toBeTruthy();
  });

  it("does not offer Super Admin and protects the sole Super Admin role", async () => {
    vi.mocked(superAdminUserAccessService.detail).mockResolvedValue({ ...user, role: "superadmin" });
    render(<UserDetailDialog tenantId="SYSTEM" userId="user-1" onClose={vi.fn()} />);
    await screen.findByText("Mai Nguyễn");

    expect(screen.queryByRole("option", { name: "Super Admin" })).toBeNull();
    expect(screen.queryByLabelText("Vai trò")).toBeNull();
    expect(screen.getByText("Role Super Admin duy nhất được hệ thống bảo vệ và không thể thay đổi.")).toBeTruthy();
  });
  it("starts a controlled impersonation session", async () => {
    vi.mocked(superAdminUserAccessService.startImpersonation).mockResolvedValue({ actionId: "action-3" });
    render(<UserDetailDialog tenantId="SYSTEM" userId="user-1" onClose={vi.fn()} />);
    await screen.findByText("Mai Nguyễn");

    fireEvent.change(screen.getByLabelText("Lý do đăng nhập thay"), { target: { value: "Hỗ trợ sự cố" } });
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu phiên 30 phút" }));

    await waitFor(() => expect(superAdminUserAccessService.startImpersonation).toHaveBeenCalledWith(
      "SYSTEM", "user-1", { reason: "Hỗ trợ sự cố", durationMinutes: 30 },
    ));
    expect(await screen.findByText("Đã bắt đầu phiên đăng nhập thay người dùng.")).toBeTruthy();
  });
  it("keeps impersonation inactive when the API fails", async () => {
    vi.mocked(superAdminUserAccessService.startImpersonation).mockRejectedValue(new Error("Không thể đăng nhập thay"));
    render(<UserDetailDialog tenantId="SYSTEM" userId="user-1" onClose={vi.fn()} />);
    await screen.findByText("Mai Nguyễn");

    fireEvent.change(screen.getByLabelText("Lý do đăng nhập thay"), { target: { value: "Hỗ trợ sự cố" } });
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu phiên 30 phút" }));

    expect(await screen.findByText("Không thể đăng nhập thay")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bắt đầu phiên 30 phút" })).toBeTruthy();
  });
});

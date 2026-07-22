// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { superAdminTenantService } from "../../../services/superAdminTenantService";
import { TenantModuleDialog } from "./TenantModuleDialog";

vi.mock("../../../services/superAdminTenantService", () => ({
  superAdminTenantService: {
    detail: vi.fn(),
    updateModules: vi.fn(),
  },
}));

const detail = {
  tenant: {
    code: "ACME",
    name: "Công ty ACME",
    ownerEmail: "owner@acme.test",
    lifecycleStatus: "active",
    enabledModules: ["hr", "chat"],
  },
  summary: { userCount: 3, usersByRole: { admin: 1, user: 2 }, enabledModulesCount: 2 },
  audit: [],
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(superAdminTenantService.detail).mockResolvedValue(detail);
});

describe("TenantModuleDialog", () => {
  it("shows read-only tenant details and reflects enabled modules", async () => {
    render(<TenantModuleDialog code="ACME" onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByText("Đang tải thông tin doanh nghiệp…")).toBeTruthy();
    await screen.findByText("Công ty ACME");

    expect(screen.getByText("ACME")).toBeTruthy();
    expect(screen.getByText("owner@acme.test")).toBeTruthy();
    expect(screen.getByText("active")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Nhân sự" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Trò chuyện" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Kho & Sản phẩm" }) as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByRole("textbox", { name: "Tên doanh nghiệp" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Mã doanh nghiệp" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Email chủ sở hữu" })).toBeNull();
  });

  it("updates selected modules with step-up credentials", async () => {
    vi.mocked(superAdminTenantService.updateModules).mockResolvedValue({ actionId: "a1", result: detail.tenant });
    const onSaved = vi.fn();
    render(<TenantModuleDialog code="ACME" onClose={vi.fn()} onSaved={onSaved} />);
    await screen.findByText("Công ty ACME");

    fireEvent.click(screen.getByRole("checkbox", { name: "Kho & Sản phẩm" }));
    fireEvent.change(screen.getByLabelText("Lý do thay đổi"), { target: { value: "Mở lại module kho" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu xác nhận"), { target: { value: "secret" } });
    fireEvent.change(screen.getByLabelText("Mã TOTP"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(superAdminTenantService.updateModules).toHaveBeenCalledTimes(1));
    expect(superAdminTenantService.updateModules).toHaveBeenCalledWith("ACME", {
      enabledModules: ["hr", "inventory", "chat"],
      reason: "Mở lại module kho",
      password: "secret",
      token: "123456",
      step: 0,
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("prevents saving an empty module selection", async () => {
    render(<TenantModuleDialog code="ACME" onClose={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByText("Công ty ACME");

    fireEvent.click(screen.getByRole("checkbox", { name: "Nhân sự" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Trò chuyện" }));
    fireEvent.change(screen.getByLabelText("Lý do thay đổi"), { target: { value: "Tắt module" } });

    expect(screen.getByText("Doanh nghiệp phải có ít nhất một module.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Lưu thay đổi" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the dialog open and reports API errors", async () => {
    vi.mocked(superAdminTenantService.updateModules).mockRejectedValue(Object.assign(new Error("Không thể cập nhật"), { correlationId: "req-1" }));
    render(<TenantModuleDialog code="ACME" onClose={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByText("Công ty ACME");

    fireEvent.change(screen.getByLabelText("Lý do thay đổi"), { target: { value: "Thay đổi module" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(await screen.findByText("Không thể cập nhật (req-1)")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

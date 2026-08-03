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
    transition: vi.fn(),
  },
}));

const detail = {
  tenant: {
    code: "ACME",
    name: "Công ty ACME",
    ownerEmail: "owner@acme.test",
    lifecycleStatus: "active",
    enabledModules: ["hr", "chat"],
    businessType: "education" as const,
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

  it("updates selected modules without a manually entered reason", async () => {
    vi.mocked(superAdminTenantService.updateModules).mockResolvedValue({ actionId: "a1", result: detail.tenant });
    vi.mocked(superAdminTenantService.detail).mockResolvedValue({
      ...detail,
      tenant: {
        ...detail.tenant,
        enabledModules: ["hr", "inventory", "resource", "chat", "student"],
      },
    });
    const onSaved = vi.fn();
    render(<TenantModuleDialog code="ACME" onClose={vi.fn()} onSaved={onSaved} />);
    await screen.findByText("Công ty ACME");

    fireEvent.click(screen.getByRole("checkbox", { name: "Nhân sự" }));
    expect(screen.queryByLabelText("Lý do thay đổi")).toBeNull();
    expect((screen.getByRole("button", { name: "Lưu thay đổi" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(superAdminTenantService.updateModules).toHaveBeenCalledTimes(1));
    expect(superAdminTenantService.updateModules).toHaveBeenCalledWith("ACME", {
      enabledModules: ["inventory", "resource", "chat", "student"],
      businessType: "education",
      reason: "Cập nhật cấu hình module",
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("auto-selects worker and hides student when business type is labor", async () => {
    render(<TenantModuleDialog code="ACME" onClose={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByText("Thông tin và module");

    fireEvent.change(screen.getByLabelText("Loại hình doanh nghiệp"), { target: { value: "labor" } });

    expect(screen.queryByText("Quản lý học viên")).toBeNull();
    const worker = screen.getByRole("checkbox", { name: "Quản lý lao động" }) as HTMLInputElement;
    expect(worker.checked).toBe(true);
    expect(worker.disabled).toBe(true);
  });

  it("suspends the tenant with a written reason and no step-up fields", async () => {
    vi.mocked(superAdminTenantService.transition).mockResolvedValue({ actionId: "a2", result: { ...detail.tenant, lifecycleStatus: "suspended" } });
    render(<TenantModuleDialog code="ACME" onClose={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByText("Công ty ACME");

    expect(screen.queryByLabelText("Mật khẩu xác nhận")).toBeNull();
    expect(screen.queryByLabelText("Mã TOTP")).toBeNull();

    fireEvent.change(screen.getByLabelText("Lý do đổi trạng thái"), { target: { value: "Vi phạm điều khoản" } });
    fireEvent.click(screen.getByRole("button", { name: "Vô hiệu hoá" }));

    await waitFor(() => expect(superAdminTenantService.transition).toHaveBeenCalledTimes(1));
    expect(superAdminTenantService.transition).toHaveBeenCalledWith("ACME", {
      lifecycleStatus: "suspended",
      reason: "Vi phạm điều khoản",
    });
  });


  it("keeps the dialog open and reports API errors", async () => {
    vi.mocked(superAdminTenantService.updateModules).mockRejectedValue(Object.assign(new Error("Không thể cập nhật"), { correlationId: "req-1" }));
    render(<TenantModuleDialog code="ACME" onClose={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByText("Công ty ACME");

    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(await screen.findByText("Không thể cập nhật (req-1)")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

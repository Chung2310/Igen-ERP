// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ServicePlansPanel from "./ServicePlansPanel";
import { servicePlanAdminService } from "../../../services/servicePlanAdminService";
import { superAdminTenantService } from "../../../services/superAdminTenantService";

vi.mock("../../../services/servicePlanAdminService", () => ({
  servicePlanAdminService: { plans: vi.fn(), current: vi.fn(), save: vi.fn(), assign: vi.fn(), cancel: vi.fn() },
}));
vi.mock("../../../services/superAdminTenantService", () => ({ superAdminTenantService: { list: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("creates a service plan with selected modules and a reason", async () => {
  vi.mocked(servicePlanAdminService.plans).mockResolvedValue([]);
  vi.mocked(superAdminTenantService.list).mockResolvedValue([]);
  vi.mocked(servicePlanAdminService.save).mockResolvedValue({ actionId: "saved" } as any);
  render(<ServicePlansPanel />);
  await screen.findByText("Chưa có gói dịch vụ. Tạo gói đầu tiên để cấp cho doanh nghiệp.");
  fireEvent.click(screen.getByText("Tạo gói dịch vụ"));
  fireEvent.change(screen.getByLabelText("Tên gói"), { target: { value: "Cơ bản" } });
  fireEvent.change(screen.getByLabelText("Mã gói"), { target: { value: "BASIC" } });
  fireEvent.change(screen.getByLabelText("Giá (VND)"), { target: { value: "99000" } });
  fireEvent.click(screen.getByLabelText("Nhân sự"));
  fireEvent.change(screen.getByLabelText("Lý do thay đổi"), { target: { value: "Cấp gói mới" } });
  fireEvent.click(screen.getByText("Lưu gói"));
  await waitFor(() => expect(servicePlanAdminService.save).toHaveBeenCalledWith(expect.objectContaining({
    code: "BASIC", name: "Cơ bản", priceVnd: 99000, modules: ["hr"], reason: "Cấp gói mới",
  }), undefined));
});

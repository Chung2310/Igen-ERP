// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const serviceMocks = vi.hoisted(() => ({ list: vi.fn(), getUsersByCompany: vi.fn() }));

vi.mock("../../services/hrDepartmentService", () => ({
  hrDepartmentService: { list: serviceMocks.list },
}));
vi.mock("../../services/authService", () => ({
  authService: { getUsersByCompany: serviceMocks.getUsersByCompany },
}));
vi.mock("../../pages/Toast", () => ({ toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn() } }));

import HrDepartmentTab from "./HrDepartmentTab";

describe("HrDepartmentTab manager options", () => {
  beforeAll(() => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) { this.setAttribute("open", ""); },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) { this.removeAttribute("open"); },
    });
  });

  beforeEach(() => {
    serviceMocks.list.mockResolvedValue([]);
    serviceMocks.getUsersByCompany.mockResolvedValue([
      { uid: "user-1", companyCode: "ACME", displayName: "Nguyễn An", email: "an@example.com" },
    ]);
  });

  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("loads manager options for the company without limiting the list to the active branch", async () => {
    const user = userEvent.setup();
    render(<HrDepartmentTab companyCode="ACME" fetchUsers={vi.fn().mockResolvedValue(undefined)} />);

    await waitFor(() => expect(serviceMocks.getUsersByCompany).toHaveBeenCalledWith("ACME"));
    await user.click(await screen.findByRole("button", { name: "Thêm phòng ban" }));

    const dialog = screen.getByRole("dialog", { name: "Thêm phòng ban" });
    const managerSelect = within(dialog).getByRole("combobox", { name: "Người quản lý (không bắt buộc)" });
    expect(within(managerSelect).getByRole("option", { name: "Nguyễn An" })).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const serviceMocks = vi.hoisted(() => ({ create: vi.fn(), rename: vi.fn(), remove: vi.fn() }));
const toastMocks = vi.hoisted(() => ({ warning: vi.fn(), success: vi.fn(), error: vi.fn() }));

vi.mock("../../services/hrDepartmentService", () => ({
  hrDepartmentService: {
    create: serviceMocks.create,
    rename: serviceMocks.rename,
    remove: serviceMocks.remove,
  },
}));
vi.mock("../../pages/Toast", () => ({ toast: toastMocks }));

import { HrDepartmentManager } from "./HrDepartmentManager";

function expectDepartmentFields(dialog: HTMLElement) {
  const form = within(dialog);
  expect(form.getByLabelText("Tên phòng ban")).toBeTruthy();
  expect(form.getByLabelText("Mã phòng ban")).toBeTruthy();
  expect(form.getByRole("combobox", { name: "Người quản lý (không bắt buộc)" })).toBeTruthy();
  expect(form.getByLabelText("Mô tả")).toBeTruthy();
  expect(form.getByLabelText("Thứ tự hiển thị")).toBeTruthy();
  expect(form.getByLabelText("Đang hoạt động")).toBeTruthy();
}

describe("HrDepartmentManager inline presentation", () => {
  it("shows summary and filters in read-only mode without edit controls", async () => {
    const user = userEvent.setup();
    render(<HrDepartmentManager presentation="inline" canManage={false} companyCode="ACME" departments={[{ id: "d1", name: "Kinh doanh", employeeCount: 3, isActive: true }, { id: "d2", name: "Nhân sự", employeeCount: 2, isActive: false, managerUid: "u1" }]} managers={[]} onChanged={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByText("Tổng nhân sự")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Thêm phòng ban" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sửa Kinh doanh" })).toBeNull();
    await user.selectOptions(screen.getByRole("combobox", { name: "Lọc trạng thái phòng ban" }), "inactive");
    expect(screen.getByText("Nhân sự")).toBeTruthy();
    expect(screen.queryByText("Kinh doanh")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Xem dạng bảng" }));
    expect(screen.getByRole("table")).toBeTruthy();
  });
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
    serviceMocks.create.mockResolvedValue({});
    serviceMocks.rename.mockResolvedValue({});
    serviceMocks.remove.mockResolvedValue({});
  });

  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("opens the create form in a popup and saves the department", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn().mockResolvedValue(undefined);
    render(
      <HrDepartmentManager
        presentation="inline"
        companyCode="ACME"
        departments={[]}
        managers={[{ id: "manager-1", name: "Nguyễn An" }]}
        onChanged={onChanged}
      />,
    );

    expect(screen.queryByLabelText("Tên phòng ban mới")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Thêm phòng ban" }));
    const dialog = screen.getByRole("dialog", { name: "Thêm phòng ban" });
    expect(dialog.className).toContain("h-full");
    expect(dialog.className).toContain("w-full");
    expectDepartmentFields(dialog);
    expect(within(dialog).getByRole("option", { name: "Nguyễn An" })).toBeTruthy();
    await user.type(within(dialog).getByLabelText("Tên phòng ban"), "Kinh doanh");
    await user.click(within(dialog).getByRole("button", { name: "Thêm phòng ban" }));

    await waitFor(() => expect(serviceMocks.create).toHaveBeenCalledWith("ACME", expect.objectContaining({ name: "Kinh doanh", sortOrder: 0, isActive: true })));
    expect(serviceMocks.create.mock.calls[0][1]).not.toHaveProperty("managerUid");
    expect(onChanged).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Thêm phòng ban" })).toBeNull());
  });

  it("opens department editing in a centered popup", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn().mockResolvedValue(undefined);
    render(
      <HrDepartmentManager
        presentation="inline"
        companyCode="ACME"
        departments={[{ id: "dept-1", name: "Kinh doanh", employeeCount: 1, code: "KD" }]}
        managers={[]}
        onChanged={onChanged}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Sửa Kinh doanh" }));
    const dialog = screen.getByRole("dialog", { name: "Sửa phòng ban" });
    expect(dialog.className).toContain("h-full");
    expectDepartmentFields(dialog);
    await user.clear(within(dialog).getByLabelText("Tên phòng ban"));
    await user.type(within(dialog).getByLabelText("Tên phòng ban"), "Kinh doanh mới");
    await user.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(serviceMocks.rename).toHaveBeenCalledWith("ACME", "dept-1", expect.objectContaining({ name: "Kinh doanh mới" })));
    expect(onChanged).toHaveBeenCalledWith(true);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Sửa phòng ban" })).toBeNull());
  });

  it("lets an admin request deletion of an assigned department after confirmation", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn().mockResolvedValue(undefined);
    render(
      <HrDepartmentManager
        presentation="inline"
        companyCode="ACME"
        departments={[{ id: "dept-1", name: "Kinh doanh", employeeCount: 3 }]}
        managers={[]}
        onChanged={onChanged}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Xóa Kinh doanh" }));
    const dialog = screen.getByRole("dialog", { name: "Xóa phòng ban" });
    expect(dialog.textContent).toContain("3 nhân sự");
    await user.click(within(dialog).getByRole("button", { name: "Xóa phòng ban" }));

    await waitFor(() => expect(serviceMocks.remove).toHaveBeenCalledWith("ACME", "dept-1"));
    expect(onChanged).toHaveBeenCalledWith(true);
  });
});

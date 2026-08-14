// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({ permissions: ["worker:manage", "custom-field:manage"] as string[] }));
vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: { permissions: authMock.permissions } }),
}));

vi.mock("../../../pages/Toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../shared/custom-fields/CustomFieldsSection", () => ({
  CustomFieldsSection: ({ values, onChange, disabled }: any) => (
    <div>
      <label htmlFor="cf-shirt">Cỡ áo</label>
      <input
        id="cf-shirt"
        disabled={disabled}
        value={(values.shirtSize as string) || ""}
        onChange={(event) => onChange({ ...values, shirtSize: event.target.value })}
      />
    </div>
  ),
}));

import { AddWorkerModal } from "./AddWorkerModal";
import { toast } from "../../../pages/Toast";
import type { Worker, WorkerProfileFieldConfig } from "../types";

const existing: Worker = {
  _id: "worker-1",
  fullName: "Nguyễn Văn A",
  phone: "0901 234 567",
  email: "A@Example.com",
  idCard: "001-234",
  status: "active",
};

const baseFields: WorkerProfileFieldConfig[] = [
  { key: "fullName", label: "Họ và tên", isRequired: true, isVisible: true },
  { key: "phone", label: "Số điện thoại", isRequired: true, isVisible: true },
  { key: "email", label: "Email", isRequired: false, isVisible: true },
  { key: "idCard", label: "CCCD / CMND", isRequired: false, isVisible: true },
  { key: "birthday", label: "Ngày sinh", isRequired: false, isVisible: false },
  { key: "registrationDate", label: "Ngày tiếp nhận", isRequired: false, isVisible: true },
  { key: "status", label: "Trạng thái", isRequired: false, isVisible: true },
  { key: "address", label: "Địa chỉ", isRequired: false, isVisible: false },
  { key: "note", label: "Ghi chú", isRequired: false, isVisible: true },
];

function setup(overrides: Record<string, unknown> = {}) {
  const onSubmit = vi.fn().mockResolvedValue({ ...existing, _id: "worker-2" });
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  const props = {
    isOpen: true,
    onClose,
    onSubmit,
    onSuccess,
    workers: [existing],
    profileFields: baseFields,
    projects: [{ id: "project-1", name: "Dự án Bắc Ninh" }],
    ...overrides,
  };
  render(<AddWorkerModal {...(props as any)} />);
  return { onSubmit, onClose, onSuccess };
}

const fill = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const save = () => fireEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));

beforeEach(() => {
  authMock.permissions = ["worker:manage", "custom-field:manage"];
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AddWorkerModal", () => {
  it("renders inside the shared modal shell", () => {
    setup();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Thêm lao động mới" })).toBeTruthy();
  });

  it("honors configurable visible and required standard fields", () => {
    setup();
    expect(screen.getByLabelText("Họ và tên *")).toBeTruthy();
    expect(screen.getByLabelText("Số điện thoại *")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.queryByLabelText(/Ngày sinh/)).toBeNull();
    expect(screen.queryByLabelText(/Địa chỉ/)).toBeNull();
  });

  it("uses the configured label for a renamed standard field", () => {
    setup({
      profileFields: baseFields.map((field) =>
        field.key === "phone" ? { ...field, label: "Điện thoại liên hệ" } : field,
      ),
    });
    expect(screen.getByLabelText("Điện thoại liên hệ *")).toBeTruthy();
  });

  it("blocks submit and reports every missing required field", () => {
    const { onSubmit } = setup();
    save();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Họ và tên");
    expect(screen.getByRole("alert").textContent).toContain("Số điện thoại");
    expect(toast.error).toHaveBeenCalled();
  });

  it("rejects a duplicate phone regardless of formatting", () => {
    const { onSubmit } = setup();
    fill("Họ và tên *", "Trần Thị B");
    fill("Số điện thoại *", "0901-234-567");
    save();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Số điện thoại đã tồn tại");
  });

  it("rejects a duplicate email regardless of casing", () => {
    const { onSubmit } = setup();
    fill("Họ và tên *", "Trần Thị B");
    fill("Số điện thoại *", "0988888888");
    fill("Email", "a@example.com");
    save();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Email đã tồn tại");
  });

  it("rejects a duplicate ID card", () => {
    const { onSubmit } = setup();
    fill("Họ và tên *", "Trần Thị B");
    fill("Số điện thoại *", "0988888888");
    fill("CCCD / CMND", "001234");
    save();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("CCCD/CMND đã tồn tại");
  });

  it("submits standard fields, project assignment, and custom field values", async () => {
    const { onSubmit, onClose, onSuccess } = setup();
    fill("Họ và tên *", "Trần Thị B");
    fill("Số điện thoại *", "0988888888");
    fill("Email", "b@example.com");
    fill("Cỡ áo", "L");
    fireEvent.change(screen.getByLabelText("Dự án"), { target: { value: "project-1" } });
    save();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      fullName: "Trần Thị B",
      phone: "0988888888",
      email: "b@example.com",
      status: "active",
      projectId: "project-1",
      customFields: { shirtSize: "L" },
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ _id: "worker-2" })));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalled();
  });

  it("forwards the selected referral partner separately from the worker profile", async () => {
    const { onSubmit } = setup({
      partners: [{ _id: "partner-1", code: "P-01", name: "Đối tác A", phone: "0900000000", status: "active" }],
    });
    fill("Họ và tên *", "Trần Thị B");
    fill("Số điện thoại *", "0988888888");
    fireEvent.change(screen.getByLabelText("Đối tác giới thiệu"), { target: { value: "Đối tác A" } });
    fireEvent.click(screen.getByRole("option", { name: "P-01 · Đối tác A" }));
    save();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][1]).toBe("partner-1");
  });

  it("surfaces a submit failure in the shared error panel and stays open", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Trùng hồ sơ trên máy chủ"));
    const { onClose } = setup({ onSubmit });
    fill("Họ và tên *", "Trần Thị B");
    fill("Số điện thoại *", "0988888888");
    save();

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Trùng hồ sơ trên máy chủ"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders nothing when closed", () => {
    setup({ isOpen: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers archived standard-field restoration to managers", () => {
    const onRestoreProfileField = vi.fn();
    setup({
      profileFields: [...baseFields, { key: "address", label: "Địa chỉ", isRequired: false, isVisible: true, isArchived: true }],
      onRestoreProfileField,
    });
    fireEvent.click(screen.getByRole("button", { name: "Khôi phục Địa chỉ" }));
    expect(onRestoreProfileField).toHaveBeenCalledWith("address");
  });

  it("hides archived restoration from users without manage permission", () => {
    authMock.permissions = ["worker:read"];
    setup({
      profileFields: [...baseFields, { key: "address", label: "Địa chỉ", isRequired: false, isVisible: true, isArchived: true }],
      onRestoreProfileField: vi.fn(),
    });
    expect(screen.queryByRole("button", { name: "Khôi phục Địa chỉ" })).toBeNull();
  });

  it("never renders an archived standard field as an input", () => {
    setup({
      profileFields: baseFields.map((field) =>
        field.key === "email" ? { ...field, isArchived: true } : field,
      ),
    });
    expect(screen.queryByLabelText("Email")).toBeNull();
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PayrollPolicyFormModal } from "./PayrollPolicyFormModal";

afterEach(cleanup);

describe("PayrollPolicyFormModal", () => {
  it("uses four guided steps and blocks invalid navigation", () => {
    render(<PayrollPolicyFormModal mode="create" saving={false} onCancel={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText("1. Thông tin chung")).toBeTruthy();
    expect(screen.getByText("4. Tăng ca & làm tròn")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(screen.getByText("Vui lòng nhập mã công thức")).toBeTruthy();
    expect(screen.getByLabelText("Mã công thức")).toBeTruthy();
  });

  it("prefills edit data using percentage values", () => {
    render(<PayrollPolicyFormModal mode="edit" saving={false} initialDefinition={{ code: "VN", name: "Việt Nam", effectiveFrom: "2026-01-01", funds: [{ code: "social", employeeRate: .08, employerRate: .175, capBasis: "baseSalary" }] }} onCancel={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByDisplayValue("VN")).toBeTruthy();
  });

  it("shows field-level errors when insurance cap multipliers are zero", () => {
    render(<PayrollPolicyFormModal
      mode="edit"
      saving={false}
      initialDefinition={{ code: "VN", name: "Việt Nam", effectiveFrom: "2026-01-01" }}
      onCancel={vi.fn()}
      onSave={vi.fn()}
    />);

    fireEvent.change(screen.getByLabelText("Hệ số trần BHXH/BHYT"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Hệ số trần BHTN"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));

    expect(screen.getByText("Hệ số trần BHXH/BHYT phải từ 1 trở lên.")).toBeTruthy();
    expect(screen.getByText("Hệ số trần BHTN phải từ 1 trở lên.")).toBeTruthy();
    expect(screen.queryByText("Bảo hiểm xã hội")).toBeNull();
  });

  it("uses the standard dialog before discarding unsaved changes", () => {
    const onCancel = vi.fn();
    render(<PayrollPolicyFormModal
      mode="edit"
      saving={false}
      initialDefinition={{ code: "VN", name: "Việt Nam", effectiveFrom: "2026-01-01" }}
      onCancel={onCancel}
      onSave={vi.fn()}
    />);

    fireEvent.change(screen.getByDisplayValue("Việt Nam"), { target: { value: "Việt Nam mới" } });
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Bỏ các thay đổi chưa lưu?" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục chỉnh sửa" }));
    expect(screen.queryByRole("dialog", { name: "Bỏ các thay đổi chưa lưu?" })).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    fireEvent.click(screen.getByRole("button", { name: "Bỏ thay đổi" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

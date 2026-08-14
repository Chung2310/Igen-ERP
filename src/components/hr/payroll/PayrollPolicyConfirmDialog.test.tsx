// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PayrollPolicyConfirmDialog } from "./PayrollPolicyConfirmDialog";

afterEach(cleanup);

describe("PayrollPolicyConfirmDialog", () => {
  it("renders impact and invokes cancel and confirm", () => {
    const onCancel = vi.fn(); const onConfirm = vi.fn();
    render(<PayrollPolicyConfirmDialog title="Ngưng áp dụng" description="Công thức VN" impact="Không dùng cho kỳ mới" confirmLabel="Ngưng áp dụng" tone="danger" pending={false} onCancel={onCancel} onConfirm={onConfirm}/>);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Không dùng cho kỳ mới")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    fireEvent.click(screen.getByRole("button", { name: "Ngưng áp dụng" }));
    expect(onCancel).toHaveBeenCalledOnce(); expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("keeps errors visible and disables actions while pending", () => {
    render(<PayrollPolicyConfirmDialog title="Xóa" description="Công thức VN" confirmLabel="Xóa công thức" tone="danger" pending error="Không thể xóa" onCancel={vi.fn()} onConfirm={vi.fn()}/>);
    expect(screen.getByRole("alert").textContent).toContain("Không thể xóa");
    expect((screen.getByRole("button", { name: "Đang xử lý..." }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("supports a clear custom label for the cancel action", () => {
    const onCancel = vi.fn();
    render(<PayrollPolicyConfirmDialog title="Bỏ thay đổi?" description="Dữ liệu chưa được lưu" confirmLabel="Bỏ thay đổi" cancelLabel="Tiếp tục chỉnh sửa" tone="warning" pending={false} onCancel={onCancel} onConfirm={vi.fn()}/>);

    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục chỉnh sửa" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

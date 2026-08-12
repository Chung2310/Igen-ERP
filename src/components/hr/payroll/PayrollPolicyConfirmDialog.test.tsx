// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PayrollPolicyConfirmDialog } from "./PayrollPolicyConfirmDialog";

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
});

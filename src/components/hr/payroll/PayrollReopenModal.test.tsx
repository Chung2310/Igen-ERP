// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PayrollReopenModal } from "./PayrollReopenModal";

describe("PayrollReopenModal", () => {
  it("requires and trims the reopen reason", () => {
    const confirm = vi.fn();
    render(<PayrollReopenModal open loading={false} onCancel={vi.fn()} onConfirm={confirm} />);
    const submit = screen.getByRole("button", { name: "Mở lại kỳ" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Lý do mở lại"), { target: { value: "  Sai ngày công  " } });
    fireEvent.click(submit);
    expect(confirm).toHaveBeenCalledWith("Sai ngày công");
  });

  it("renders nothing while closed", () => {
    const { container } = render(<PayrollReopenModal open={false} loading={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });
});

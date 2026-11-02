// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PayrollSalaryAdvanceDialog } from "./PayrollSalaryAdvanceDialog";

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
});

describe("salary advance dialog", () => {
  it("sends a structured pending advance with the selected employee and payment details", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PayrollSalaryAdvanceDialog periodKey="2026-09" employees={[{ employeeId: "e1", employeeName: "Nguyễn An" }]} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Số tiền tạm ứng (đ)" }), { target: { value: "500000" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Lý do tạm ứng" }), { target: { value: "Chi phí sinh hoạt" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Hình thức chi" }), { target: { value: "cash" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu phiếu" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ employeeId: "e1", kind: "advance", amount: 500000, reason: "Chi phí sinh hoạt", advanceDetails: expect.objectContaining({ method: "cash" }) })));
  });
});

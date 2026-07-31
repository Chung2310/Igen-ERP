// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { vi, it, expect } from "vitest";
import { PayrollPaymentsPanel } from "./PayrollPaymentsPanel";

it("shows lifecycle actions for payment states", () => {
  const confirm = vi.fn();
  const cancel = vi.fn();
  const reverse = vi.fn();
  render(<PayrollPaymentsPanel payments={[
    { _id: "p1", amount: 100, status: "draft" },
    { _id: "p2", amount: 200, status: "confirmed" },
  ]} onConfirm={confirm} onCancel={cancel} onReverse={reverse} />);
  fireEvent.click(screen.getByTitle("Xác nhận thanh toán"));
  fireEvent.click(screen.getByTitle("Hủy thanh toán"));
  fireEvent.click(screen.getByTitle("Hoàn tác thanh toán"));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(reverse).toHaveBeenCalledTimes(1);
});


it('submits a new payment amount', () => {
  const create = vi.fn();
  render(<PayrollPaymentsPanel payments={[]} onConfirm={vi.fn()} onCancel={vi.fn()} onReverse={vi.fn()} onCreate={create} />);
  fireEvent.change(screen.getByLabelText('Số tiền thanh toán'), { target: { value: '1500000' } });
  fireEvent.click(screen.getByTitle('Tạo đợt thanh toán'));
  expect(create).toHaveBeenCalledWith(1500000);
});




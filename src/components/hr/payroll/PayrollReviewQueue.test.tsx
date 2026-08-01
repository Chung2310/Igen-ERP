// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PayrollReviewQueue } from "./PayrollReviewQueue";

it("shows pending adjustments and sends approve/reject actions", () => {
  const approve = vi.fn();
  const reject = vi.fn();
  render(<PayrollReviewQueue adjustments={[{ _id: "a1", employeeId: "e1", employeeName: "Nguyen A", kind: "bonus", amount: 500000, reason: "Performance", status: "pending" }]} onApprove={approve} onReject={reject} />);
  expect(screen.getByText("Nguyen A")).toBeTruthy();
  fireEvent.click(screen.getByTitle("Duyệt điều chỉnh"));
  fireEvent.click(screen.getByTitle("Từ chối điều chỉnh"));
  expect(approve).toHaveBeenCalledTimes(1);
  expect(reject).toHaveBeenCalledTimes(1);
});

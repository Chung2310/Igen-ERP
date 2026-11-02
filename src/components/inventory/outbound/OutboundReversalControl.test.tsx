// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OutboundReversalControl } from "./OutboundReversalControl";
vi.mock("../../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const ticket = { id: "s1", status: "Hoàn thành", createdAt: "2026-09-29", purpose: "bán", items: [] };
afterEach(cleanup);

it("offers full internal recovery with the original recipient and a required reason", async () => {
  const reverse = vi.fn().mockResolvedValue({ _id: "return-1" });
  render(<OutboundReversalControl ticket={{ ...ticket, purpose: "nội bộ", customerName: "Phòng kỹ thuật" }} onReverse={reverse} />);
  fireEvent.click(screen.getByRole("button", { name: "Thu hồi toàn bộ hàng nội bộ" }));
  expect(screen.getByText(/Người\/phòng ban nhận: Phòng kỹ thuật/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Lý do đảo phiếu"), { target: { value: "Đã nhận đủ thiết bị" } });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận đảo toàn bộ" }));
  await screen.findByText("return-1");
  expect(reverse).toHaveBeenCalledWith("s1", "Đã nhận đủ thiết bị");
});

it("requires an explicit reason and shows the resulting linked document", async () => {
  const reverse = vi.fn().mockResolvedValue({ _id: "r1" });
  render(<OutboundReversalControl ticket={ticket} onReverse={reverse} />);
  fireEvent.click(screen.getByRole("button", { name: "Đảo phiếu xuất" }));
  expect((screen.getByRole("button", { name: "Xác nhận đảo toàn bộ" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Lý do đảo phiếu"), { target: { value: " Nhầm số lượng " } });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận đảo toàn bộ" }));
  await screen.findByText("r1");
  expect(reverse).toHaveBeenCalledWith("s1", "Nhầm số lượng");
  expect(screen.queryByRole("button", { name: "Đảo phiếu xuất" })).toBeNull();
});

it("retains the reason for retry after an ambiguous failure", async () => {
  const reverse = vi.fn().mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValue({ _id: "r1" });
  render(<OutboundReversalControl ticket={ticket} onReverse={reverse} />);
  fireEvent.click(screen.getByRole("button", { name: "Đảo phiếu xuất" }));
  fireEvent.change(screen.getByLabelText("Lý do đảo phiếu"), { target: { value: "Correction" } });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận đảo toàn bộ" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "Xác nhận đảo toàn bộ" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận đảo toàn bộ" }));
  await screen.findByText("r1");
  expect(reverse.mock.calls).toEqual([["s1", "Correction"], ["s1", "Correction"]]);
});

it("hides reversal without permission or for draft/source-business documents", () => {
  const view = render(<OutboundReversalControl ticket={ticket} />);
  expect(screen.queryByRole("button")).toBeNull();
  for (const extra of [{ status: "Đang chờ" }, { refType: "retail-order" }, { purpose: "chuyển kho" }, { refId: "order" }]) {
    view.rerender(<OutboundReversalControl ticket={{ ...ticket, ...extra }} onReverse={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
  }
});

it("shows an existing reversal to read-only viewers without allowing another", () => {
  render(<OutboundReversalControl ticket={{ ...ticket, reversalId: "r1" }} />);
  expect(screen.getByText("r1")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});

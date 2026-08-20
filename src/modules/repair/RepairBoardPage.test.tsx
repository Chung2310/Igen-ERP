// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("../../services/repairService", async () => {
  const actual = await vi.importActual<typeof import("../../services/repairService")>("../../services/repairService");
  return { ...actual, repairService: { board: vi.fn(async () => ({ received: [ticket] })), quote: vi.fn(async () => ticket), transition: vi.fn(async () => ticket) } };
});

vi.mock("../../services/authService", () => ({
  authService: { getColleagues: vi.fn(async () => [{ uid: "tech-1", displayName: "Nguyễn Văn Kỹ Thuật" }]) },
}));

vi.mock("./RepairTicketExtras", () => ({ default: () => null }));

import RepairBoardPage from "./RepairBoardPage";
import { repairService } from "../../services/repairService";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const ticket = {
  _id: "repair-1", ticketCode: "REP-001", status: "received", customerId: "customer-1", customerName: "Khách hàng", customerPhone: "0900000000",
  device: { name: "Laptop", condition: "Tốt", accessories: [] }, coverage: { customer: { covered: false }, supplier: { covered: false }, costBearer: "customer", checkedAt: "2026-01-01" },
  symptom: "Không lên nguồn", laborFee: 0, partCost: 0, discountAmount: 0, totalAmount: 0, paidAmount: 0, dueAmount: 0, paymentStatus: "unpaid", receivedAt: "2026-01-01",
  statusHistory: [{ to: "diagnosing", at: "2026-01-02", byName: "Quầy tiếp nhận", technicianName: "Nguyễn Văn Kỹ Thuật" }],
};

test("keeps repair workflow columns in a dedicated horizontal scroller on mobile", () => {
  render(<RepairBoardPage />);
  const scroller = screen.getByTestId("repair-board-scroll");
  expect(scroller.className).toContain("overflow-x-auto");
  expect(scroller.className).toContain("-mx-4");
  expect(scroller.firstElementChild?.className).toContain("min-w-[1250px]");
});

test("asks for a technician before advancing a received ticket", async () => {
  const user = userEvent.setup();
  render(<RepairBoardPage />);

  await user.click(await screen.findByRole("button", { name: "Chuyển bước tiếp" }));

  expect(screen.getByLabelText("Kỹ thuật viên tiếp nhận")).not.toBeNull();
  expect((within(screen.getByRole("dialog")).getByRole("button", { name: "Chuyển bước tiếp" }) as HTMLButtonElement).disabled).toBe(true);
});

test("transitions a received ticket with the selected technician", async () => {
  const user = userEvent.setup();
  render(<RepairBoardPage />);

  await user.click(await screen.findByRole("button", { name: "Chuyển bước tiếp" }));
  await user.selectOptions(screen.getByLabelText("Kỹ thuật viên tiếp nhận"), "tech-1");
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Chuyển bước tiếp" }));

  expect(repairService.transition).toHaveBeenCalledWith("repair-1", "diagnosing", { technicianId: "tech-1" });
});

test("handles a rejected quote without leaving an unhandled promise", async () => {
  const diagnosingTicket = { ...ticket, status: "diagnosing" as const };
  vi.mocked(repairService.board).mockResolvedValue({ diagnosing: [diagnosingTicket] } as any);
  vi.mocked(repairService.quote).mockRejectedValueOnce(new Error("Không thể lưu báo giá"));
  const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
  render(<RepairBoardPage />);

  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Chuyển bước tiếp" }));
  await user.type(screen.getByLabelText("Ghi chú báo giá"), "Thay pin");
  await user.click(screen.getByRole("button", { name: "Lưu báo giá" }));

  expect(alert).toHaveBeenCalledWith("Không thể lưu báo giá");
});

test("opens the quote popup and requires a note before quoting", async () => {
  const diagnosingTicket = { ...ticket, status: "diagnosing" as const };
  vi.mocked(repairService.board).mockResolvedValue({ diagnosing: [diagnosingTicket] } as any);
  const user = userEvent.setup();
  render(<RepairBoardPage />);

  await user.click(await screen.findByRole("button", { name: "Chuyển bước tiếp" }));

  const saveQuote = screen.getByRole("button", { name: "Lưu báo giá" }) as HTMLButtonElement;
  expect(screen.getByLabelText("Ghi chú báo giá")).not.toBeNull();
  expect(saveQuote.disabled).toBe(true);
  await user.type(screen.getByLabelText("Ghi chú báo giá"), "Thay pin chính hãng");
  await user.click(saveQuote);

  expect(repairService.quote).toHaveBeenCalledWith("repair-1", 0, "Thay pin chính hãng");
});

test("shows the receiving technician from status history", async () => {
  render(<RepairBoardPage />);

  await userEvent.setup().click(await screen.findByText("REP-001"));

  const history = screen.getByRole("heading", { name: "Lịch sử xử lý" }).parentElement;
  expect(history).not.toBeNull();
  expect(history?.textContent).toContain("KT nhận: Nguyễn Văn Kỹ Thuật");
});

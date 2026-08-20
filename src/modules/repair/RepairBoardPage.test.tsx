// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("../../services/repairService", async () => {
  const actual = await vi.importActual<typeof import("../../services/repairService")>("../../services/repairService");
  return { ...actual, repairService: { board: vi.fn(async () => ({ received: [ticket] })), transition: vi.fn(async () => ticket) } };
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

test("shows the receiving technician from status history", async () => {
  render(<RepairBoardPage />);

  await userEvent.setup().click(await screen.findByText("REP-001"));

  expect(screen.getByText("KT nhận: Nguyễn Văn Kỹ Thuật")).not.toBeNull();
});

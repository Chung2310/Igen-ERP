// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("../../services/repairService", () => ({
  repairService: { parts: vi.fn(async () => []) },
  repairExtras: {
    assignTechnician: vi.fn(),
    notifications: vi.fn(async () => []),
    resendNotification: vi.fn(),
    rate: vi.fn(),
  },
}));

vi.mock("../../services/authService", () => ({
  authService: { getColleagues: vi.fn(async () => []) },
}));

import RepairTicketExtras from "./RepairTicketExtras";
import type { RepairTicket } from "../../services/repairService";

afterEach(cleanup);

const ticket: RepairTicket = {
  _id: "repair-1", ticketCode: "REP-001", status: "diagnosing", customerId: "customer-1", customerName: "Khách hàng", customerPhone: "0900000000",
  device: { name: "Laptop", condition: "Tốt", accessories: [] }, coverage: { customer: { covered: false }, supplier: { covered: false }, costBearer: "customer", checkedAt: "2026-01-01" },
  symptom: "Không lên nguồn", laborFee: 0, partCost: 0, discountAmount: 0, totalAmount: 0, paidAmount: 0, dueAmount: 0, paymentStatus: "unpaid", receivedAt: "2026-01-01",
};

test("keeps notification controls responsive and touch-friendly inside the ticket modal", () => {
  render(<RepairTicketExtras ticket={ticket} onChanged={() => undefined} />);

  const resendReceived = screen.getByRole("button", { name: "Gửi lại tin tiếp nhận" });
  const actionRow = resendReceived.parentElement;
  expect(actionRow).not.toBeNull();
  expect(actionRow?.className).toContain("flex-col");
  expect(actionRow?.className).toContain("sm:flex-row");
  expect(resendReceived.className).toContain("min-h-11");
  expect(resendReceived.className).toContain("w-full");
  expect(resendReceived.className).toContain("sm:w-auto");
  expect(screen.getByRole("button", { name: "Lưu phân công" }).className).toContain("min-h-11");
});

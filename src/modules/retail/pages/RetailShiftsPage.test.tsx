// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailShiftsApi } from "../api/retailShifts.api";
import RetailShiftsPage from "./RetailShiftsPage";

vi.mock("../hooks/useRetailScope", () => ({ useRetailScope: () => ({
  scope: { companyCode: "ACME", branchId: "B1" },
  userProfile: { uid: "manager-1", permissions: ["retail:manage"] },
}) }));
vi.mock("../../../services/socketService", () => ({ socketService: { on: () => vi.fn(), onStatusChange: () => vi.fn() } }));
vi.mock("../api/retailShifts.api", () => ({ retailShiftsApi: { cashiers: vi.fn(), list: vi.fn(), open: vi.fn(), close: vi.fn() } }));
vi.mock("./RetailShiftDetailDialog", () => ({ default: () => null }));

const openShift = {
  _id: "shift-1", shiftCode: "CA-1", cashierId: "cashier-1", cashierName: "Thu ngân",
  openingFloat: 500_000, businessDate: "2026-08-13", status: "open" as const,
};
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(retailShiftsApi.cashiers).mockResolvedValue([{ id: "cashier-1", name: "Thu ngân" }]);
  vi.mocked(retailShiftsApi.list).mockResolvedValue({ items: [openShift], total: 1, page: 1, limit: 20 });
  vi.mocked(retailShiftsApi.open).mockResolvedValue(openShift);
  vi.mocked(retailShiftsApi.close).mockResolvedValue({ ...openShift, status: "closed" });
});

async function openCloseDialog() {
  render(<RetailShiftsPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Đóng phiên" }));
  return screen.getByRole("dialog", { name: "Đóng phiên POS" });
}

describe("RetailShiftsPage POS sessions", () => {
  it("opens an assigned cashier session with zero opening cash", async () => {
    render(<RetailShiftsPage />);
    await userEvent.click(screen.getByRole("button", { name: "Nhân viên bán hàng" }));
    await userEvent.click(await screen.findByRole("option", { name: "Thu ngân" }));
    await userEvent.click(screen.getByRole("button", { name: "Mở phiên" }));
    await waitFor(() => expect(retailShiftsApi.open).toHaveBeenCalledWith(
      { companyCode: "ACME", branchId: "B1" }, { cashierId: "cashier-1", openingFloat: 0 },
    ));
  });

  it("sends formatted counted cash and a variance reason when closing", async () => {
    await openCloseDialog();
    fireEvent.change(screen.getByRole("textbox", { name: "Tiền mặt thực đếm" }), { target: { value: "1.300.000" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Lý do chênh lệch/ }), { target: { value: "Rút tiền nộp két chính" } });
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận đóng phiên" }));
    await waitFor(() => expect(retailShiftsApi.close).toHaveBeenCalledWith(
      { companyCode: "ACME", branchId: "B1" }, "shift-1", { countedCash: 1_300_000, varianceReason: "Rút tiền nộp két chính" },
    ));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("can defer counting when closing a session", async () => {
    await openCloseDialog();
    await userEvent.click(screen.getByRole("checkbox", { name: /Chỉ đóng phiên/ }));
    expect(screen.queryByRole("textbox", { name: "Tiền mặt thực đếm" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận đóng phiên" }));
    await waitFor(() => expect(retailShiftsApi.close).toHaveBeenCalledWith(
      { companyCode: "ACME", branchId: "B1" }, "shift-1", { countedCash: undefined, varianceReason: undefined },
    ));
  });

  it("preserves the count so a rejected close can be corrected", async () => {
    vi.mocked(retailShiftsApi.close).mockRejectedValueOnce(new Error("Vui lòng nhập lý do chênh lệch ca."));
    await openCloseDialog();
    const counted = screen.getByRole("textbox", { name: "Tiền mặt thực đếm" }) as HTMLInputElement;
    fireEvent.change(counted, { target: { value: "1.300.000" } });
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận đóng phiên" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Vui lòng nhập lý do chênh lệch ca.");
    expect(counted.value).toBe("1.300.000");
    expect(screen.getByRole("dialog", { name: "Đóng phiên POS" })).toBeTruthy();
  });

  it("allows closing an expired open session", async () => {
    vi.mocked(retailShiftsApi.list).mockResolvedValue({ items: [{ ...openShift, operationalEndsAt: "2020-01-01T00:00:00.000Z" }], total: 1, page: 1, limit: 20 });
    await openCloseDialog();
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận đóng phiên" }));
    await waitFor(() => expect(retailShiftsApi.close).toHaveBeenCalledOnce());
  });

  it("forwards the selected date range to session history", async () => {
    render(<RetailShiftsPage />);
    await screen.findByText("Thu ngân");
    fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2026-08-12" } });
    fireEvent.change(screen.getByLabelText("Đến ngày"), { target: { value: "2026-08-13" } });
    await waitFor(() => expect(retailShiftsApi.list).toHaveBeenLastCalledWith(
      { companyCode: "ACME", branchId: "B1" }, expect.objectContaining({ from: "2026-08-12", to: "2026-08-13", page: 1, limit: 20 }),
    ));
  });
});

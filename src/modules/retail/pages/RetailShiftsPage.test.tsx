// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailShiftsApi } from "../api/retailShifts.api";
import RetailShiftsPage from "./RetailShiftsPage";

vi.mock("../hooks/useRetailScope", () => ({
  useRetailScope: () => ({
    scope: { companyCode: "ACME", branchId: "B1" },
    userProfile: { uid: "user-1", permissions: ["retail:manager"] },
  }),
}));

vi.mock("../api/retailShifts.api", () => ({
  retailShiftsApi: {
    current: vi.fn(),
    list: vi.fn(),
    open: vi.fn(),
    movement: vi.fn(),
    close: vi.fn(),
    approve: vi.fn(),
  },
}));

const openShift = {
  _id: "shift-1",
  shiftCode: "CA-1",
  cashierId: "user-1",
  cashierName: "Thu ngân",
  openingFloat: 500_000,
  businessDate: "2026-08-13",
  openedAt: "2026-08-13T01:00:00.000Z",
  operationalEndsAt: "2026-08-13T16:59:59.999Z",
  status: "open" as const,
};

const closedShift = {
  ...openShift,
  status: "closed" as const,
  closedAt: "2026-08-13T10:00:00.000Z",
  collectedAmount: 1_200_000,
  refundedAmount: 100_000,
  netCollectedAmount: 1_100_000,
  methodTotals: [{ method: "cash" as const, collectedAmount: 900_000, refundedAmount: 50_000 }],
  expectedCash: 1_350_000,
  countedCash: 1_300_000,
  varianceAmount: -50_000,
  varianceReason: "Rút tiền nộp két chính",
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(retailShiftsApi.list).mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
});

describe("RetailShiftsPage currency inputs", () => {
  it("accepts zero opening cash", async () => {
    vi.mocked(retailShiftsApi.current).mockResolvedValue(null);
    vi.mocked(retailShiftsApi.open).mockResolvedValue(openShift);
    render(<RetailShiftsPage />);

    const input = await screen.findByRole("textbox", { name: "Tiền đầu ca" }) as HTMLInputElement;
    const button = screen.getByRole("button", { name: "Mở ca" }) as HTMLButtonElement;
    expect(input.value).toBe("");
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(retailShiftsApi.open).toHaveBeenCalledWith(
      { companyCode: "ACME", branchId: "B1" },
      { openingFloat: 0, terminalId: undefined },
    ));
  });

  it("keeps formatted counted cash without movement or approval controls", async () => {
    vi.mocked(retailShiftsApi.current).mockResolvedValue(openShift);
    render(<RetailShiftsPage />);

    const countedInput = await screen.findByRole("textbox", { name: "Tiền thực đếm" }) as HTMLInputElement;

    fireEvent.change(countedInput, { target: { value: "1.500.000 ₫" } });
    expect(countedInput.value).toBe("1.500.000");
    expect(screen.queryByText("Thu/rút tiền trong ca")).toBeNull();
    expect(screen.queryByText("Ca chờ duyệt")).toBeNull();
  });

  it("shows the completed closing result until the cashier starts a new shift", async () => {
    vi.mocked(retailShiftsApi.current).mockResolvedValue(openShift);
    vi.mocked(retailShiftsApi.close).mockResolvedValue(closedShift);
    render(<RetailShiftsPage />);

    fireEvent.change(await screen.findByRole("textbox", { name: "Tiền thực đếm" }), { target: { value: "1.300.000" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Lý do chênh lệch (nếu có)" }), { target: { value: "Rút tiền nộp két chính" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi kiểm đếm và đóng ca" }));

    expect(await screen.findByRole("heading", { name: "Kết quả đóng ca" })).toBeTruthy();
    expect(screen.getByText("1.350.000 ₫")).toBeTruthy();
    expect(screen.getByText("1.300.000 ₫")).toBeTruthy();
    expect(screen.getByText("-50.000 ₫")).toBeTruthy();
    expect(screen.getByText("Rút tiền nộp két chính")).toBeTruthy();
    expect(retailShiftsApi.current).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Mở ca mới" }));
    expect(screen.getByRole("heading", { name: "Mở ca mới" })).toBeTruthy();
  });

  it("preserves the blind count and focuses the reason after a variance error", async () => {
    vi.mocked(retailShiftsApi.current).mockResolvedValue(openShift);
    vi.mocked(retailShiftsApi.close).mockRejectedValue(new Error("Vui lòng nhập lý do chênh lệch ca."));
    render(<RetailShiftsPage />);

    const counted = await screen.findByRole("textbox", { name: "Tiền thực đếm" }) as HTMLInputElement;
    fireEvent.change(counted, { target: { value: "1.300.000" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi kiểm đếm và đóng ca" }));

    const reason = await screen.findByRole("textbox", { name: "Lý do chênh lệch (nếu có)" }) as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(reason));
    expect(counted.value).toBe("1.300.000");
  });

  it("marks an expired shift but still allows closing it", async () => {
    vi.mocked(retailShiftsApi.current).mockResolvedValue({ ...openShift, operationalEndsAt: "2020-01-01T00:00:00.000Z" });
    render(<RetailShiftsPage />);
    expect(await screen.findByText("Ca đã hết thời gian hoạt động")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Gửi kiểm đếm và đóng ca" })).toBeTruthy();
  });

  it("loads read-only history and forwards filters", async () => {
    vi.mocked(retailShiftsApi.current).mockResolvedValue(null);
    vi.mocked(retailShiftsApi.list).mockResolvedValue({ items: [closedShift], total: 1, page: 1, limit: 20 });
    render(<RetailShiftsPage />);

    expect(await screen.findByRole("heading", { name: "Lịch sử ca" })).toBeTruthy();
    expect(await screen.findByText("CA-1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /duyệt|sửa|mở lại/i })).toBeNull();

    fireEvent.change(screen.getByLabelText("Ngày kinh doanh"), { target: { value: "2026-08-13" } });
    fireEvent.change(screen.getByLabelText("Trạng thái ca"), { target: { value: "closed" } });
    await waitFor(() => expect(retailShiftsApi.list).toHaveBeenLastCalledWith(
      { companyCode: "ACME", branchId: "B1" },
      expect.objectContaining({ businessDate: "2026-08-13", status: "closed", page: 1, limit: 20 }),
    ));
  });
});

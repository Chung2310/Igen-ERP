// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  status: "open" as const,
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(retailShiftsApi.list).mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
});

describe("RetailShiftsPage currency inputs", () => {
  it("formats opening cash and disables opening until it is positive", async () => {
    vi.mocked(retailShiftsApi.current).mockResolvedValue(null);
    render(<RetailShiftsPage />);

    const input = await screen.findByRole("textbox", { name: "Tiền đầu ca" }) as HTMLInputElement;
    const button = screen.getByRole("button", { name: "Mở ca" }) as HTMLButtonElement;
    expect(input.value).toBe("");
    expect(button.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "1.250.000 ₫" } });
    expect(input.value).toBe("1.250.000");
    expect(button.disabled).toBe(false);
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
});

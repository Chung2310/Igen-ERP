// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { retailShiftsApi } from "../api/retailShifts.api";
import { authService } from "../../../services/authService";
import RetailShiftWorkspace from "./RetailShiftWorkspace";

vi.mock("../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "ACME", branchId: "B1" }, userProfile: { uid: "manager-1", permissions: ["retail:manage"] } }) }));
vi.mock("../../../services/authService", () => ({ authService: { getUsersByCompany: vi.fn().mockRejectedValue(new Error("HR access denied")) } }));
vi.mock("../../../services/socketService", () => ({ socketService: { on: () => vi.fn(), onStatusChange: () => vi.fn() } }));
vi.mock("../api/retailShifts.api", () => ({ retailShiftsApi: { cashiers: vi.fn(), list: vi.fn(), open: vi.fn() } }));
vi.mock("./RetailShiftDetailDialog", () => ({ default: () => null }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(retailShiftsApi.cashiers).mockResolvedValue([{ id: "cashier-1", name: "Cashier A" }]);
  vi.mocked(retailShiftsApi.list).mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
  vi.mocked(retailShiftsApi.open).mockResolvedValue({ _id: "session-1" } as any);
});

it("allows a retail manager to select a branch cashier and open a session without HR access", async () => {
  render(<RetailShiftWorkspace />);
  await waitFor(() => expect(retailShiftsApi.cashiers).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }));
  await userEvent.click(screen.getByRole("button", { name: "Nhân viên bán hàng" }));
  await userEvent.click(await screen.findByRole("option", { name: "Cashier A" }));
  await userEvent.click(screen.getByRole("button", { name: "Mở phiên" }));
  await waitFor(() => expect(retailShiftsApi.open).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, { cashierId: "cashier-1", openingFloat: 0 }));
  expect(authService.getUsersByCompany).not.toHaveBeenCalled();
  expect(screen.queryByText("HR access denied")).toBeNull();
});

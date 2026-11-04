// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import RetailPosEntry from "./RetailPosEntry";

vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: { uid: "manager-1", displayName: "Quản lý", role: "admin" }, logout: vi.fn() }),
}));
vi.mock("../hooks/useRetailScope", () => ({
  useRetailScope: () => ({ scope: { companyCode: "MAIN", branchId: "branch-1", terminalId: "terminal-1" }, branchName: "Trụ sở chính" }),
}));
vi.mock("../api/retailShifts.api", () => ({ retailShiftsApi: { current: vi.fn().mockResolvedValue(null) } }));
vi.mock("../../../services/socketService", () => ({
  socketService: { isConnected: () => true, on: () => () => {}, onStatusChange: () => () => {} },
}));
vi.mock("./RetailPosPage", () => ({ default: () => null }));

afterEach(cleanup);

describe("RetailPosEntry", () => {
  it("explains a missing session instead of silently returning managers to retail", async () => {
    window.history.replaceState(null, "", "/pos");
    render(<RetailPosEntry />);

    expect(await screen.findByRole("heading", { name: "Chưa có phiên bán hàng" })).toBeTruthy();
    expect(window.location.pathname).toBe("/pos");

    await userEvent.click(screen.getByRole("button", { name: "Đến Phiên POS" }));
    expect(window.location.pathname + window.location.search).toBe("/ban-le?sub=ca-pos");
  });
});

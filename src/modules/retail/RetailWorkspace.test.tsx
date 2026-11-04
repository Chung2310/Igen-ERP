// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RetailWorkspace from "./RetailWorkspace";
import { retailShiftsApi } from "./api/retailShifts.api";
import { toast } from "../../pages/Toast";

afterEach(() => { cleanup(); vi.clearAllMocks(); });
beforeEach(() => { window.history.replaceState(null, "", "/ban-le?sub=ca-pos"); });

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: { role: "admin", permissions: ["*"] } }),
}));

vi.mock("../../hooks/useSubTabRouter", () => ({
  useSubTabRouter: (tabs: Array<{ value: string }>, fallback: string) => React.useState(tabs[0]?.value || fallback),
}));
vi.mock("./hooks/useRetailScope", () => ({
  useRetailScope: () => ({ scope: { companyCode: "MAIN", branchId: "branch-1", terminalId: "terminal-1" } }),
}));
vi.mock("./api/retailShifts.api", () => ({ retailShiftsApi: { current: vi.fn() } }));
vi.mock("../../pages/Toast", () => ({ toast: { info: vi.fn(), error: vi.fn() } }));

vi.mock("./pages/RetailPosPage", () => ({ default: ({ onLeavePos }: { onLeavePos: () => void }) => <div>POS page<button type="button" onClick={onLeavePos}>Rời POS</button></div> }));
vi.mock("./pages/RetailSettingsPage", () => ({ default: () => <div>Settings page</div> }));
vi.mock("./pages/RetailOrdersPageV2", () => ({ default: () => <div>Orders page</div> }));
vi.mock("./pages/RetailReturnsPage", () => ({ default: () => <div>Returns page</div> }));
vi.mock("./pages/RetailShiftsPage", () => ({ default: () => <div>Shifts page</div> }));
vi.mock("./pages/RetailInvoicesPageContent", () => ({ default: () => <div>Invoices page</div> }));
vi.mock("./pages/RetailReportsPage", () => ({ default: () => <div>Reports page</div> }));
vi.mock("./pages/OrderWarrantyPage", () => ({ default: () => <div>Order warranty page</div> }));

describe("RetailWorkspace", () => {
  it("does not render the retail customer management tab", () => {
    render(<RetailWorkspace />);

    expect(screen.queryByRole("button", { name: "Khách hàng" })).toBeNull();
    expect(screen.getByRole("button", { name: "Đổi trả" })).toBeTruthy();
  });

  it("uses order warranty in ERP sales", async () => {
    render(<RetailWorkspace />);
    expect(await screen.findByText("Order warranty page")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tổng quan" })).toBeNull();
    expect(screen.queryByText("Tổng quan bán hàng")).toBeNull();
    expect(screen.queryByText(/IMEI/)).toBeNull();
  });

  it("opens the dedicated POS route from retail management", async () => {
    vi.mocked(retailShiftsApi.current).mockResolvedValue({ _id: "shift-1" } as Awaited<ReturnType<typeof retailShiftsApi.current>>);
    render(<RetailWorkspace />);
    await userEvent.click(screen.getByRole("button", { name: "Vào quầy POS" }));
    await waitFor(() => expect(window.location.pathname).toBe("/pos"));
  });

  it("keeps managers in retail when only another employee has an open session", async () => {
    vi.mocked(retailShiftsApi.current).mockResolvedValue(null);
    render(<RetailWorkspace />);
    await userEvent.click(screen.getByRole("button", { name: "Vào quầy POS" }));
    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    expect(window.location.pathname).toBe("/ban-le");
  });
});

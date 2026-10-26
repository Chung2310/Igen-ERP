// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import RetailWorkspace from "./RetailWorkspace";

afterEach(cleanup);

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: { role: "admin", permissions: ["*"] } }),
}));

vi.mock("../../hooks/useSubTabRouter", () => ({
  useSubTabRouter: (tabs: Array<{ value: string }>, fallback: string) => React.useState(tabs[0]?.value || fallback),
}));

vi.mock("./pages/RetailPosPage", () => ({ default: ({ onLeavePos }: { onLeavePos: () => void }) => <div>POS page<button type="button" onClick={onLeavePos}>Rời POS</button></div> }));
vi.mock("./pages/RetailSettingsPage", () => ({ default: () => <div>Settings page</div> }));
vi.mock("./pages/RetailOrdersPageV2", () => ({ default: () => <div>Orders page</div> }));
vi.mock("./pages/RetailReturnsPage", () => ({ default: () => <div>Returns page</div> }));
vi.mock("./pages/RetailShiftsPage", () => ({ default: () => <div>Shifts page</div> }));
vi.mock("./pages/RetailInvoicesPageContent", () => ({ default: () => <div>Invoices page</div> }));
vi.mock("./pages/RetailReportsPage", () => ({ default: () => <div>Reports page</div> }));
vi.mock("./pages/WarrantyLookupPage", () => ({ default: ({ onCreateRepair }: { onCreateRepair?: (prefill: unknown) => void }) => <div>Warranty page{onCreateRepair && <button type="button" onClick={() => onCreateRepair({ productName: "Điện thoại", coverage: { customer: { covered: true }, supplier: { covered: false }, costBearer: "shop", checkedAt: "2026-01-01" } })}>Tạo phiếu sửa chữa/bảo hành</button>}</div> }));
vi.mock("../repair/RepairBoardPage", () => ({ default: ({ createPrefill }: { createPrefill?: { productName?: string } | null }) => <div>Repair board {createPrefill?.productName}</div> }));

describe("RetailWorkspace", () => {
  it("does not render the retail customer management tab", () => {
    render(<RetailWorkspace />);

    expect(screen.queryByRole("button", { name: "Khách hàng" })).toBeNull();
    expect(screen.getByRole("button", { name: "Đổi trả" })).toBeTruthy();
  });

  it("opens a repair ticket from retail warranty lookup", async () => {
    render(<RetailWorkspace />);
    await userEvent.click(screen.getByRole("button", { name: "Bảo hành" }));
    await userEvent.click(await screen.findByRole("button", { name: "Tạo phiếu sửa chữa/bảo hành" }));
    expect(await screen.findByText("Repair board Điện thoại")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Quay lại tra cứu bảo hành" }));
    expect(await screen.findByText("Warranty page")).toBeTruthy();
  });

  it("opens the dedicated POS route from retail management", async () => {
    render(<RetailWorkspace />);
    await userEvent.click(screen.getByRole("button", { name: "Mở quầy POS" }));
    expect(window.location.pathname).toBe("/pos");
  });
});

// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RetailWorkspace from "./RetailWorkspace";

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: { role: "admin", permissions: ["*"] } }),
}));

vi.mock("../../hooks/useSubTabRouter", () => ({
  useSubTabRouter: (tabs: Array<{ value: string }>, fallback: string) => [tabs[0]?.value || fallback, vi.fn()],
}));

vi.mock("./pages/RetailPosPage", () => ({ default: () => <div>POS page</div> }));
vi.mock("./pages/RetailSettingsPage", () => ({ default: () => <div>Settings page</div> }));
vi.mock("./pages/RetailOrdersPageV2", () => ({ default: () => <div>Orders page</div> }));
vi.mock("./pages/RetailShiftsPage", () => ({ default: () => <div>Shifts page</div> }));
vi.mock("./pages/RetailInvoicesPageContent", () => ({ default: () => <div>Invoices page</div> }));
vi.mock("./pages/RetailReportsPage", () => ({ default: () => <div>Reports page</div> }));
vi.mock("./pages/WarrantyLookupPage", () => ({ default: () => <div>Warranty page</div> }));

describe("RetailWorkspace", () => {
  it("does not render the retail customer management tab", () => {
    render(<RetailWorkspace />);

    expect(screen.queryByRole("button", { name: "Khách hàng" })).toBeNull();
  });
});

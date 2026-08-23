// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const apiMocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), downloadPdf: vi.fn() }));
const toastMocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() }));

vi.mock("../api/retailInvoices.api", () => ({ retailInvoicesApi: apiMocks }));
vi.mock("../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "ACME", branchId: "branch-1" } }) }));
vi.mock("../../../pages/Toast", () => ({ toast: toastMocks }));

import RetailInvoicesPageContent from "./RetailInvoicesPageContent";

describe("RetailInvoicesPageContent", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("reports an API load failure through a toast instead of rendering it in the page", async () => {
    apiMocks.list.mockRejectedValue(new Error("Không tải được hóa đơn."));

    render(<RetailInvoicesPageContent />);

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith("Không tải được hóa đơn."));
    expect(screen.queryByText("Không tải được hóa đơn.")).toBeNull();
  });
});

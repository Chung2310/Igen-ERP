// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailReceivablesApi } from "../../api/retailReceivables.api";
import RetailReceivableHistory from "./RetailReceivableHistory";

vi.mock("../../api/retailReceivables.api", () => ({ retailReceivablesApi: { history: vi.fn(), adjust: vi.fn(), reverse: vi.fn() } }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(retailReceivablesApi.history).mockResolvedValue({ items: [{ _id: "e1", type: "charge", amount: 100000, signedAmount: 100000, runningBalance: 100000, reason: "Credit sale", createdAt: "2026-08-12T00:00:00Z" }], total: 1, page: 1, limit: 20, currentBalance: 100000 });
  vi.mocked(retailReceivablesApi.adjust).mockResolvedValue({ _id: "e2" } as any);
});

describe("RetailReceivableHistory", () => {
  it("loads history, filters type and submits a decrease with an idempotency key", async () => {
    render(<RetailReceivableHistory scope={{ companyCode: "ACME", branchId: "B1" }} customerId="c1" canManage />);
    expect(await screen.findByText("Credit sale")).toBeTruthy();
    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], "payment");
    await waitFor(() => expect(retailReceivablesApi.history).toHaveBeenLastCalledWith({ companyCode: "ACME", branchId: "B1" }, "c1", expect.objectContaining({ type: "payment" })));

    await userEvent.click(screen.getAllByRole("button")[0]);
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "decrease");
    await userEvent.type(screen.getByRole("spinbutton"), "50000");
    await userEvent.type(screen.getAllByRole("textbox")[0], "Reconciliation fix");
    await userEvent.click(screen.getAllByRole("button")[1]);

    await waitFor(() => expect(retailReceivablesApi.adjust).toHaveBeenCalledWith(
      { companyCode: "ACME", branchId: "B1" },
      expect.objectContaining({ customerId: "c1", direction: "decrease", amount: 50000, reason: "Reconciliation fix", idempotencyKey: expect.stringMatching(/^adjustment:/) }),
    ));
  });
});

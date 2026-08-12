// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { retailReceivablesApi } from "../../api/retailReceivables.api";
import RetailReceivableReconciliation from "./RetailReceivableReconciliation";
vi.mock("../../api/retailReceivables.api", () => ({ retailReceivablesApi: { latestReconciliation: vi.fn().mockResolvedValue(null), reconcile: vi.fn().mockResolvedValue({ _id: "r1", orderTotal: 100, ledgerTotal: 80, differenceTotal: 20, createdAt: "2026-08-12", differences: [{ orderId: "o1", snapshotDue: 100, ledgerDue: 80, difference: 20 }] }) } }));
afterEach(cleanup);
it("runs reconciliation and renders its read-only differences", async () => {
  render(<RetailReceivableReconciliation scope={{ companyCode: "ACME", branchId: "B1" }} />);
  await userEvent.click(screen.getByRole("button"));
  expect(await screen.findByText("o1")).toBeTruthy();
  await waitFor(() => expect(retailReceivablesApi.reconcile).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }));
  expect(screen.getAllByText("20 ₫")).toHaveLength(2);
});

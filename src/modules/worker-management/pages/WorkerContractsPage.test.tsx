// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const contractHooks = vi.hoisted(() => ({ useWorkerLaborContracts: vi.fn() }));
const workerHooks = vi.hoisted(() => ({ useWorkers: vi.fn() }));
vi.mock("../hooks/useWorkerLaborContracts", () => contractHooks);
vi.mock("../hooks/useWorkers", () => workerHooks);

import WorkerContractsPage from "./WorkerContractsPage";

const baseContract = {
  _id: "c1",
  workerId: "w1",
  code: "HD-01",
  clientName: "Công ty A",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  status: "active" as const,
  rootContractId: "c1",
  sequence: 1,
};

const renderPage = (contracts: any[], extra: Record<string, unknown> = {}) => {
  contractHooks.useWorkerLaborContracts.mockReturnValue({
    contracts,
    loading: false,
    error: null,
    createContract: vi.fn(),
    updateContract: vi.fn(),
    renewContract: vi.fn(),
    deleteContract: vi.fn(),
    reload: vi.fn(),
    ...extra,
  });
  workerHooks.useWorkers.mockReturnValue({
    workers: [{ _id: "w1", fullName: "Nguyễn Văn A", status: "active" }],
  });
  return render(<WorkerContractsPage selectedCenter="ACME" canManage />);
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WorkerContractsPage", () => {
  it("marks an expired contract in red and an expiring one in amber", () => {
    renderPage([
      { ...baseContract, alertLevel: "expired" },
      {
        ...baseContract,
        _id: "c2",
        rootContractId: "c2",
        code: "HD-02",
        alertLevel: "expiring",
        endDate: "2026-09-01",
      },
    ]);

    const expiredRow = screen.getByText("HD-01").closest("tr")!;
    expect(expiredRow.className).toContain("rose");
    expect(within(expiredRow).getAllByText("Đã hết hạn")).toHaveLength(2);

    const expiringRow = screen.getByText("HD-02").closest("tr")!;
    expect(expiringRow.className).toContain("amber");
  });

  it("keeps quiet when nothing needs attention", () => {
    renderPage([{ ...baseContract, alertLevel: "ok" }]);

    expect(screen.queryByText(/sẽ hết hạn trong 30 ngày tới/)).toBeNull();
  });

  it("narrows the table to contracts needing attention", () => {
    renderPage([
      { ...baseContract, alertLevel: "expiring", endDate: "2026-09-01" },
      {
        ...baseContract,
        _id: "c2",
        rootContractId: "c2",
        code: "HD-99",
        alertLevel: "ok",
      },
    ]);

    expect(screen.getByText("HD-99")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Chỉ xem hợp đồng cảnh báo" }));

    expect(screen.getByText("HD-01")).toBeTruthy();
    expect(screen.queryByText("HD-99")).toBeNull();
  });

  it("does not offer renewal on a period that is already closed", () => {
    renderPage([{ ...baseContract, status: "renewed", alertLevel: "ok" }]);

    const renewButton = screen.getByRole<HTMLButtonElement>("button", {
      name: "Gia hạn hợp đồng HD-01",
    });
    expect(renewButton.disabled).toBe(true);
    expect(
      screen.queryByRole("button", { name: "Xóa hợp đồng HD-01" }),
    ).toBeNull();
  });
});

// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const contractHooks = vi.hoisted(() => ({ useWorkerLaborContracts: vi.fn() }));
const workerHooks = vi.hoisted(() => ({ useWorkers: vi.fn() }));
const contractApi = vi.hoisted(() => ({
  workerLaborContractApi: { expiringSummary: vi.fn().mockResolvedValue({ expiringCount: 1, expiredCount: 0 }) },
}));
vi.mock("../hooks/useWorkerLaborContracts", () => contractHooks);
vi.mock("../hooks/useWorkers", () => workerHooks);
vi.mock("../api/workerLaborContracts.api", () => contractApi);

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
    page: 1,
    setPage: vi.fn(),
    limit: 10,
    total: contracts.length,
    search: "",
    setSearch: vi.fn(),
    status: "all",
    setStatus: vi.fn(),
    client: "all",
    setClient: vi.fn(),
    alertOnly: false,
    setAlertOnly: vi.fn(),
    clients: [],
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

  it("toggles the attention-only contract filter", async () => {
    const setAlertOnly = vi.fn();
    renderPage([
      { ...baseContract, alertLevel: "expiring", endDate: "2026-09-01" },
      {
        ...baseContract,
        _id: "c2",
        rootContractId: "c2",
        code: "HD-99",
        alertLevel: "ok",
      },
    ], { setAlertOnly });

    expect(screen.getByText("HD-99")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Chỉ xem hợp đồng cảnh báo" }));

    expect(setAlertOnly).toHaveBeenCalledOnce();
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

  it("uses a visible cyan background for the selected desktop page", () => {
    renderPage([{ ...baseContract, alertLevel: "ok" }], {
      page: 2,
      limit: 10,
      total: 11,
    });

    expect(screen.getByRole("button", { name: "2" }).className).toContain("bg-cyan-600");
  });
});

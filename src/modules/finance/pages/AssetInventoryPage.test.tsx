// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { financeAssetInventoriesApi } from "../api/financeAssets.api";
import AssetInventoryPage from "./AssetInventoryPage";

vi.mock("../api/financeAssets.api", () => ({
  financeAssetInventoriesApi: { list: vi.fn(), detail: vi.fn(), variance: vi.fn(), open: vi.fn(), count: vi.fn(), finalize: vi.fn() },
}));

const SESSION = {
  _id: "s1", sessionCode: "KK-2026-01", name: "Kiểm kê quý 1", scope: "branch" as const, branchIds: ["B1"],
  inventoryDate: "2026-03-31T00:00:00.000Z", status: "open" as const, openedAt: "2026-03-31T01:00:00.000Z",
  items: [
    { assetId: "a1", assetCode: "TS-001", barcode: "BC1", name: "Máy in", expectedBranchId: "B1", result: "pending" as const },
    { assetId: "a2", assetCode: "TS-002", barcode: "BC2", name: "Máy chiếu", expectedBranchId: "B1", result: "pending" as const },
  ],
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(financeAssetInventoriesApi.list).mockResolvedValue([SESSION]);
  vi.mocked(financeAssetInventoriesApi.detail).mockResolvedValue(SESSION);
  vi.mocked(financeAssetInventoriesApi.variance).mockResolvedValue({ total: 2, counts: { pending: 2 }, variances: [] });
  vi.mocked(financeAssetInventoriesApi.count).mockResolvedValue(SESSION);
});

describe("AssetInventoryPage", () => {
  it("opens a session with its items and variance summary", async () => {
    render(<AssetInventoryPage permissions={["asset:read"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Phiên KK-2026-01" }));
    expect(await screen.findByText("TS-001")).toBeTruthy();
    expect(screen.getByText("Tổng: 2")).toBeTruthy();
    expect(screen.getByText("Chưa kiểm: 2")).toBeTruthy();
  });

  it("hides scanning and finalizing from read-only users", async () => {
    render(<AssetInventoryPage permissions={["asset:read"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Phiên KK-2026-01" }));
    await screen.findByText("TS-001");
    expect(screen.queryByLabelText("Mã vạch")).toBeNull();
    expect(screen.queryByRole("button", { name: "Chốt phiên" })).toBeNull();
  });

  it("records a scan with the chosen result and clears the input", async () => {
    render(<AssetInventoryPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Phiên KK-2026-01" }));
    const input = await screen.findByLabelText("Mã vạch");
    fireEvent.change(input, { target: { value: " BC1 " } });
    fireEvent.change(screen.getByLabelText("Kết quả kiểm kê"), { target: { value: "damaged" } });
    fireEvent.click(screen.getByRole("button", { name: "Ghi nhận" }));
    await vi.waitFor(() => expect(financeAssetInventoriesApi.count).toHaveBeenCalled());
    expect(vi.mocked(financeAssetInventoriesApi.count).mock.calls[0][1]).toEqual({ barcode: "BC1", result: "damaged" });
    await vi.waitFor(() => expect((input as HTMLInputElement).value).toBe(""));
  });

  it("ignores an empty scan", async () => {
    render(<AssetInventoryPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Phiên KK-2026-01" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ghi nhận" }));
    expect(financeAssetInventoriesApi.count).not.toHaveBeenCalled();
  });

  it("shows the closing variance after finalizing and hides further scanning", async () => {
    const finalized = {
      ...SESSION,
      status: "finalized" as const,
      items: [{ ...SESSION.items[0], result: "present" as const }, { ...SESSION.items[1], result: "missing" as const }],
    };
    vi.mocked(financeAssetInventoriesApi.finalize).mockResolvedValue({
      session: finalized,
      variance: { total: 2, counts: { present: 1, missing: 1 }, variances: [finalized.items[1]] },
    });
    render(<AssetInventoryPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Phiên KK-2026-01" }));
    fireEvent.click(await screen.findByRole("button", { name: "Chốt phiên" }));
    expect(await screen.findByText("Thiếu: 1")).toBeTruthy();
    expect(screen.queryByLabelText("Mã vạch")).toBeNull();
  });

  it("surfaces a rejected scan", async () => {
    vi.mocked(financeAssetInventoriesApi.count).mockRejectedValue(new Error("Phiên kiểm kê đã chốt."));
    render(<AssetInventoryPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Phiên KK-2026-01" }));
    fireEvent.change(await screen.findByLabelText("Mã vạch"), { target: { value: "BC1" } });
    fireEvent.click(screen.getByRole("button", { name: "Ghi nhận" }));
    expect(await screen.findByText("Phiên kiểm kê đã chốt.")).toBeTruthy();
  });
});

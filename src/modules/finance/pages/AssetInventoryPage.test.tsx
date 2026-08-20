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
  vi.mocked(financeAssetInventoriesApi.open).mockResolvedValue(SESSION);
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

  it("hides the open-session form from read-only users", async () => {
    render(<AssetInventoryPage permissions={["asset:read"]} />);
    await screen.findByRole("button", { name: "Phiên KK-2026-01" });
    expect(screen.queryByRole("button", { name: "Mở phiên kiểm kê" })).toBeNull();
  });

  it("opens a branch-scoped session and jumps straight into it", async () => {
    render(<AssetInventoryPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở phiên kiểm kê" }));
    fireEvent.change(screen.getByLabelText("Mã phiên"), { target: { value: " KK-2026-02 " } });
    fireEvent.change(screen.getByLabelText("Tên phiên"), { target: { value: " Kiểm kê quý 2 " } });
    fireEvent.change(screen.getByLabelText("Chi nhánh (để trống = toàn công ty)"), { target: { value: "B1, B2 " } });
    fireEvent.change(screen.getByLabelText("Ngày kiểm kê"), { target: { value: "2026-06-30" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiên" }));
    await vi.waitFor(() => expect(financeAssetInventoriesApi.open).toHaveBeenCalled());
    expect(vi.mocked(financeAssetInventoriesApi.open).mock.calls[0][0]).toEqual({
      sessionCode: "KK-2026-02", name: "Kiểm kê quý 2", scope: "branch", branchIds: ["B1", "B2"],
      inventoryDate: "2026-06-30T00:00:00.000Z",
    });
    expect(await screen.findByText("TS-001")).toBeTruthy();
  });

  it("treats an empty branch list as a company-wide session", async () => {
    render(<AssetInventoryPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở phiên kiểm kê" }));
    fireEvent.change(screen.getByLabelText("Mã phiên"), { target: { value: "KK-2026-03" } });
    fireEvent.change(screen.getByLabelText("Tên phiên"), { target: { value: "Toàn công ty" } });
    fireEvent.change(screen.getByLabelText("Ngày kiểm kê"), { target: { value: "2026-06-30" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiên" }));
    await vi.waitFor(() => expect(financeAssetInventoriesApi.open).toHaveBeenCalled());
    expect(vi.mocked(financeAssetInventoriesApi.open).mock.calls[0][0]).toMatchObject({ scope: "company", branchIds: [] });
  });

  it("refuses to open a session with missing required fields", async () => {
    render(<AssetInventoryPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở phiên kiểm kê" }));
    fireEvent.change(screen.getByLabelText("Mã phiên"), { target: { value: "KK-2026-04" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiên" }));
    expect(await screen.findByText("Cần nhập mã phiên, tên phiên và ngày kiểm kê.")).toBeTruthy();
    expect(financeAssetInventoriesApi.open).not.toHaveBeenCalled();
  });

  it("surfaces a rejected open", async () => {
    vi.mocked(financeAssetInventoriesApi.open).mockRejectedValue(new Error("Mã phiên kiểm kê đã tồn tại."));
    render(<AssetInventoryPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở phiên kiểm kê" }));
    fireEvent.change(screen.getByLabelText("Mã phiên"), { target: { value: "KK-2026-01" } });
    fireEvent.change(screen.getByLabelText("Tên phiên"), { target: { value: "Trùng" } });
    fireEvent.change(screen.getByLabelText("Ngày kiểm kê"), { target: { value: "2026-06-30" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiên" }));
    expect(await screen.findByText("Mã phiên kiểm kê đã tồn tại.")).toBeTruthy();
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

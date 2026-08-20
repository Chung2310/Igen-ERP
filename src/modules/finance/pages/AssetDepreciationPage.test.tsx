// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { financeAssetsApi } from "../api/financeAssets.api";
import AssetDepreciationPage from "./AssetDepreciationPage";

vi.mock("../api/financeAssets.api", () => ({
  financeAssetsApi: { listDepreciations: vi.fn(), runDepreciation: vi.fn(), postDepreciation: vi.fn() },
}));

const line = (status: "planned" | "posted") => ({
  _id: "d1", assetId: "a1", period: "2026-03", amount: 1000000, accumulatedAfter: 3000000, netBookValueAfter: 9000000, status,
});

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(financeAssetsApi.listDepreciations).mockResolvedValue([line("planned")]);
  vi.mocked(financeAssetsApi.runDepreciation).mockResolvedValue({ period: "2026-03", planned: 1, lines: [line("planned")] });
  vi.mocked(financeAssetsApi.postDepreciation).mockResolvedValue({ period: "2026-03", posted: 1, lines: [line("posted")] });
});

describe("AssetDepreciationPage", () => {
  it("loads the chosen period and totals the planned amounts", async () => {
    render(<AssetDepreciationPage permissions={["asset:read"]} />);
    fireEvent.change(screen.getByLabelText("Kỳ khấu hao"), { target: { value: "2026-03" } });
    await vi.waitFor(() => expect(financeAssetsApi.listDepreciations).toHaveBeenCalledWith("2026-03"));
    expect(await screen.findByText(/Tổng khấu hao/)).toBeTruthy();
  });

  it("hides plan and post commands from read-only users", async () => {
    render(<AssetDepreciationPage permissions={["asset:read"]} />);
    await screen.findByText(/Tổng khấu hao/);
    expect(screen.queryByRole("button", { name: "Lập kế hoạch" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ghi sổ" })).toBeNull();
  });

  it("plans then posts a period and reports the outcome", async () => {
    render(<AssetDepreciationPage permissions={["asset:manage"]} />);
    fireEvent.change(screen.getByLabelText("Kỳ khấu hao"), { target: { value: "2026-03" } });
    fireEvent.click(await screen.findByRole("button", { name: "Lập kế hoạch" }));
    expect(await screen.findByText("Đã lập kế hoạch 1 dòng.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ghi sổ" }));
    expect(await screen.findByText("Đã ghi sổ 1 dòng.")).toBeTruthy();
    expect(financeAssetsApi.postDepreciation).toHaveBeenCalledWith("2026-03");
  });

  it("disables posting for a period that is already posted", async () => {
    vi.mocked(financeAssetsApi.listDepreciations).mockResolvedValue([line("posted")]);
    render(<AssetDepreciationPage permissions={["asset:manage"]} />);
    expect(await screen.findByText(/đã ghi sổ/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ghi sổ" }).hasAttribute("disabled")).toBe(true);
  });

  it("disables posting when the period has no planned lines", async () => {
    vi.mocked(financeAssetsApi.listDepreciations).mockResolvedValue([]);
    render(<AssetDepreciationPage permissions={["asset:manage"]} />);
    expect(await screen.findByText("Kỳ này chưa có dòng khấu hao nào.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ghi sổ" }).hasAttribute("disabled")).toBe(true);
  });

  it("surfaces a rejected post instead of showing a success notice", async () => {
    vi.mocked(financeAssetsApi.postDepreciation).mockRejectedValue(new Error("Kỳ khấu hao đã được ghi sổ."));
    render(<AssetDepreciationPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ghi sổ" }));
    expect(await screen.findByText("Kỳ khấu hao đã được ghi sổ.")).toBeTruthy();
  });
});

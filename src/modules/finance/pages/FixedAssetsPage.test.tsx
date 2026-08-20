// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { financeAssetsApi } from "../api/financeAssets.api";
import FixedAssetsPage from "./FixedAssetsPage";

vi.mock("../api/financeAssets.api", () => ({
  financeAssetsApi: { list: vi.fn(), detail: vi.fn(), schedule: vi.fn(), create: vi.fn(), update: vi.fn(), transfer: vi.fn(), dispose: vi.fn() },
}));

const ASSET = {
  _id: "a1", branchId: "B1", assetCode: "TS-001", barcode: "BC1", name: "Máy in", group: "Thiết bị",
  originalCost: 12000000, salvageValue: 0, inServiceDate: "2026-01-10T00:00:00.000Z", usefulLifeMonths: 12,
  status: "in_use" as const, accumulatedDepreciation: 2000000, netBookValue: 10000000, lifecycleEvents: [],
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(financeAssetsApi.list).mockResolvedValue([ASSET]);
  vi.mocked(financeAssetsApi.schedule).mockResolvedValue([
    { period: "2026-01", amount: 1000000, accumulatedAfter: 1000000, netBookValueAfter: 11000000 },
  ]);
  vi.mocked(financeAssetsApi.create).mockResolvedValue(ASSET);
  vi.mocked(financeAssetsApi.detail).mockResolvedValue(ASSET);
  vi.mocked(financeAssetsApi.update).mockResolvedValue(ASSET);
  vi.mocked(financeAssetsApi.transfer).mockResolvedValue(ASSET);
  vi.mocked(financeAssetsApi.dispose).mockResolvedValue({ ...ASSET, status: "disposed" });
});

describe("FixedAssetsPage", () => {
  it("lists assets and opens the depreciation schedule on selection", async () => {
    render(<FixedAssetsPage permissions={["asset:read"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tài sản TS-001" }));
    expect(await screen.findByText("2026-01")).toBeTruthy();
    expect(financeAssetsApi.schedule).toHaveBeenCalledWith("a1");
  });

  it("keeps write commands hidden for read-only users", async () => {
    render(<FixedAssetsPage permissions={["asset:read"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tài sản TS-001" }));
    expect(screen.queryByRole("button", { name: "Thêm tài sản" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Thanh lý" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sửa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Điều chuyển" })).toBeNull();
  });

  it("hides edit and transfer for an already disposed asset", async () => {
    vi.mocked(financeAssetsApi.list).mockResolvedValue([{ ...ASSET, status: "disposed" as const }]);
    render(<FixedAssetsPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tài sản TS-001" }));
    expect(screen.queryByRole("button", { name: "Sửa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Điều chuyển" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Thanh lý" })).toBeNull();
  });

  it("sends only the changed fields when editing", async () => {
    render(<FixedAssetsPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tài sản TS-001" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sửa" }));
    fireEvent.change(screen.getByLabelText("Vị trí"), { target: { value: "Kho B" } });
    fireEvent.change(screen.getByLabelText("Ghi chú thay đổi"), { target: { value: "Dời kho" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await vi.waitFor(() => expect(financeAssetsApi.update).toHaveBeenCalled());
    expect(vi.mocked(financeAssetsApi.update).mock.calls[0][1]).toEqual({ location: "Kho B", note: "Dời kho" });
  });

  it("refuses an edit that changes nothing", async () => {
    render(<FixedAssetsPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tài sản TS-001" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sửa" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(await screen.findByText("Chưa có thay đổi nào để lưu.")).toBeTruthy();
    expect(financeAssetsApi.update).not.toHaveBeenCalled();
  });

  it("requires a destination branch and a reason before transferring", async () => {
    render(<FixedAssetsPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tài sản TS-001" }));
    fireEvent.click(await screen.findByRole("button", { name: "Điều chuyển" }));
    fireEvent.change(screen.getByLabelText("Chi nhánh đến"), { target: { value: "B2" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận điều chuyển" }));
    expect(await screen.findByText("Cần chọn chi nhánh đến và nhập lý do điều chuyển.")).toBeTruthy();
    expect(financeAssetsApi.transfer).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Lý do điều chuyển"), { target: { value: " Dời chi nhánh " } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận điều chuyển" }));
    await vi.waitFor(() => expect(financeAssetsApi.transfer).toHaveBeenCalled());
    expect(vi.mocked(financeAssetsApi.transfer).mock.calls[0][1]).toEqual({ branchId: "B2", reason: "Dời chi nhánh" });
  });

  it("submits a new asset with the date normalized to an ISO instant", async () => {
    render(<FixedAssetsPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Thêm tài sản" }));
    const fill = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fill("Mã tài sản", "TS-002");
    fill("Mã vạch", "BC2");
    fill("Tên tài sản", "Máy chiếu");
    fill("Nhóm", "Thiết bị");
    fill("Nguyên giá", "6000000");
    fill("Ngày đưa vào dùng", "2026-02-01");
    fill("Số tháng khấu hao", "24");
    fireEvent.click(screen.getByRole("button", { name: "Lưu tài sản" }));
    await vi.waitFor(() => expect(financeAssetsApi.create).toHaveBeenCalled());
    expect(vi.mocked(financeAssetsApi.create).mock.calls[0][0]).toMatchObject({
      assetCode: "TS-002", barcode: "BC2", originalCost: 6000000, salvageValue: 0,
      usefulLifeMonths: 24, inServiceDate: "2026-02-01T00:00:00.000Z",
    });
  });

  it("requires a reason before disposing and reloads the list afterwards", async () => {
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("");
    render(<FixedAssetsPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tài sản TS-001" }));
    fireEvent.click(await screen.findByRole("button", { name: "Thanh lý" }));
    expect(financeAssetsApi.dispose).not.toHaveBeenCalled();

    prompt.mockReturnValue("Hỏng nặng");
    fireEvent.click(screen.getByRole("button", { name: "Thanh lý" }));
    await vi.waitFor(() => expect(financeAssetsApi.dispose).toHaveBeenCalled());
    expect(vi.mocked(financeAssetsApi.dispose).mock.calls[0][1]).toMatchObject({ reason: "Hỏng nặng", disposalAmount: 0 });
    prompt.mockRestore();
  });

  it("surfaces server errors instead of failing silently", async () => {
    vi.mocked(financeAssetsApi.list).mockRejectedValue(new Error("Mã tài sản đã tồn tại."));
    render(<FixedAssetsPage permissions={["asset:manage"]} />);
    expect(await screen.findByText("Mã tài sản đã tồn tại.")).toBeTruthy();
  });
});

// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { financeAssetsApi } from "../api/financeAssets.api";
import FixedAssetsPage from "./FixedAssetsPage";

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

vi.mock("../../../pages/Toast", () => ({ toast: toastMocks }));

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
  it("opens the create form in an accessible dialog", async () => {
    render(<FixedAssetsPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Thêm tài sản" }));

    expect(screen.getByRole("dialog", { name: "Thêm tài sản cố định" })).toBeTruthy();
  });

  it("closes and resets the create dialog with its controls", async () => {
    render(<FixedAssetsPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Thêm tài sản" }));
    fireEvent.change(screen.getByLabelText("Mã tài sản"), { target: { value: "TS-DRAFT" } });
    fireEvent.click(screen.getByRole("button", { name: "Đóng popup" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Thêm tài sản" }));
    expect((screen.getByLabelText("Mã tài sản") as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the create dialog with Escape but not with a backdrop click", async () => {
    render(<FixedAssetsPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Thêm tài sản" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.parentElement!);
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows a Vietnamese toast and does not call the API when the create form is empty", async () => {
    render(<FixedAssetsPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Thêm tài sản" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu tài sản" }));

    expect(toastMocks.warning).toHaveBeenCalledWith("Vui lòng nhập mã tài sản.");
    expect(financeAssetsApi.create).not.toHaveBeenCalled();
    for (const label of [
      "Mã tài sản",
      "Mã vạch",
      "Tên tài sản",
      "Nhóm",
      "Nguyên giá",
      "Ngày đưa vào dùng",
      "Số tháng khấu hao",
    ]) {
      expect(screen.getByLabelText(label).getAttribute("aria-invalid")).toBe("true");
      expect(screen.getByLabelText(label).className).toContain("border-red-500");
    }
  });

  it("clears only the edited field validation state", async () => {
    render(<FixedAssetsPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Thêm tài sản" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu tài sản" }));

    const assetCode = screen.getByLabelText("Mã tài sản");
    const barcode = screen.getByLabelText("Mã vạch");
    expect(assetCode.getAttribute("aria-invalid")).toBe("true");
    expect(barcode.getAttribute("aria-invalid")).toBe("true");

    fireEvent.change(assetCode, { target: { value: "TS-NEW" } });

    expect(assetCode.getAttribute("aria-invalid")).toBe("false");
    expect(assetCode.className).not.toContain("border-red-500");
    expect(barcode.getAttribute("aria-invalid")).toBe("true");
  });

  it.each([
    ["Nguyên giá", "0", "Nguyên giá phải là số nguyên lớn hơn 0."],
    ["Giá trị thu hồi", "-1", "Giá trị thu hồi phải là số nguyên không âm."],
    ["Giá trị thu hồi", "101", "Giá trị thu hồi không được lớn hơn nguyên giá."],
    ["Ngày đưa vào dùng", "", "Vui lòng chọn ngày đưa vào sử dụng."],
    ["Số tháng khấu hao", "1.5", "Số tháng khấu hao phải là số nguyên lớn hơn 0."],
  ])("rejects invalid create value for %s", async (label, value, expectedMessage) => {
    render(<FixedAssetsPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Thêm tài sản" }));
    const fill = (fieldLabel: string, fieldValue: string) =>
      fireEvent.change(screen.getByLabelText(fieldLabel), { target: { value: fieldValue } });
    fill("Mã tài sản", "TS-002");
    fill("Mã vạch", "BC2");
    fill("Tên tài sản", "Máy chiếu");
    fill("Nhóm", "Thiết bị");
    fill("Nguyên giá", "100");
    fill("Giá trị thu hồi", "0");
    fill("Ngày đưa vào dùng", "2026-02-01");
    fill("Số tháng khấu hao", "24");
    fill(label, value);

    fireEvent.click(screen.getByRole("button", { name: "Lưu tài sản" }));

    expect(toastMocks.warning).toHaveBeenCalledWith(expectedMessage);
    expect(financeAssetsApi.create).not.toHaveBeenCalled();
  });

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
    await vi.waitFor(() => expect(toastMocks.success).toHaveBeenCalledWith("Đã cập nhật tài sản thành công."));
  });

  it("refuses an edit that changes nothing", async () => {
    render(<FixedAssetsPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tài sản TS-001" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sửa" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(toastMocks.warning).toHaveBeenCalledWith("Chưa có thay đổi nào để lưu.");
    expect(financeAssetsApi.update).not.toHaveBeenCalled();
  });

  it("requires a destination branch and a reason before transferring", async () => {
    render(<FixedAssetsPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tài sản TS-001" }));
    fireEvent.click(await screen.findByRole("button", { name: "Điều chuyển" }));
    fireEvent.change(screen.getByLabelText("Chi nhánh đến"), { target: { value: "B2" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận điều chuyển" }));
    expect(toastMocks.warning).toHaveBeenCalledWith("Vui lòng nhập chi nhánh đến và lý do điều chuyển.");
    expect(financeAssetsApi.transfer).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Lý do điều chuyển"), { target: { value: " Dời chi nhánh " } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận điều chuyển" }));
    await vi.waitFor(() => expect(financeAssetsApi.transfer).toHaveBeenCalled());
    expect(vi.mocked(financeAssetsApi.transfer).mock.calls[0][1]).toEqual({ branchId: "B2", reason: "Dời chi nhánh" });
    await vi.waitFor(() => expect(toastMocks.success).toHaveBeenCalledWith("Đã điều chuyển tài sản thành công."));
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
    await vi.waitFor(() => expect(toastMocks.success).toHaveBeenCalledWith("Đã thêm tài sản cố định thành công."));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the create dialog and entered values when the API rejects the request", async () => {
    vi.mocked(financeAssetsApi.create).mockRejectedValueOnce(new Error("Mã tài sản đã tồn tại."));
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

    await vi.waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith("Mã tài sản đã tồn tại."));
    expect(screen.getByRole("dialog", { name: "Thêm tài sản cố định" })).toBeTruthy();
    expect((screen.getByLabelText("Mã tài sản") as HTMLInputElement).value).toBe("TS-002");
  });

  it("requires a reason before disposing and reloads the list afterwards", async () => {
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("");
    render(<FixedAssetsPage permissions={["asset:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tài sản TS-001" }));
    fireEvent.click(await screen.findByRole("button", { name: "Thanh lý" }));
    expect(financeAssetsApi.dispose).not.toHaveBeenCalled();

    prompt.mockReturnValue("   ");
    fireEvent.click(screen.getByRole("button", { name: "Thanh lý" }));
    expect(toastMocks.warning).toHaveBeenCalledWith("Vui lòng nhập lý do thanh lý.");
    expect(financeAssetsApi.dispose).not.toHaveBeenCalled();

    prompt.mockReturnValue("Hỏng nặng");
    fireEvent.click(screen.getByRole("button", { name: "Thanh lý" }));
    await vi.waitFor(() => expect(financeAssetsApi.dispose).toHaveBeenCalled());
    expect(vi.mocked(financeAssetsApi.dispose).mock.calls[0][1]).toMatchObject({ reason: "Hỏng nặng", disposalAmount: 0 });
    await vi.waitFor(() => expect(toastMocks.success).toHaveBeenCalledWith("Đã thanh lý tài sản thành công."));
    prompt.mockRestore();
  });

  it("surfaces server errors through a toast", async () => {
    vi.mocked(financeAssetsApi.list).mockRejectedValue(new Error("Mã tài sản đã tồn tại."));
    render(<FixedAssetsPage permissions={["asset:manage"]} />);
    await vi.waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith("Mã tài sản đã tồn tại."));
    expect(screen.queryByText("Mã tài sản đã tồn tại.")).toBeNull();
  });
});

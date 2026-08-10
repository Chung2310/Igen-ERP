// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailReportsApi } from "../api/retailReports.api";
import type { RetailReport } from "../types";
import RetailReportsPage from "./RetailReportsPage";

const retailScopeState = vi.hoisted(() => ({
  scope: { companyCode: "ACME", branchId: "B1" } as { companyCode: string; branchId: string } | null,
}));

vi.mock("../hooks/useRetailScope", () => ({
  useRetailScope: () => ({ scope: retailScopeState.scope }),
}));

vi.mock("../api/retailReports.api", () => ({
  retailReportsApi: { summary: vi.fn(), export: vi.fn() },
}));

function report(overrides: Partial<RetailReport> = {}): RetailReport {
  return {
    range: { from: "2026-08-04", to: "2026-08-10" },
    summary: {
      grossSales: 1_400_000,
      refunds: 200_000,
      netSales: 1_200_000,
      orderCount: 4,
      averageOrderValue: 350_000,
      collectedAmount: 1_100_000,
      dueAmount: 100_000,
    },
    timeSeries: [
      { businessDate: "2026-08-09", grossSales: 600_000, refunds: 0, netSales: 600_000, collectedAmount: 550_000, orderCount: 2 },
      { businessDate: "2026-08-10", grossSales: 800_000, refunds: 200_000, netSales: 600_000, collectedAmount: 550_000, orderCount: 2 },
    ],
    paymentMix: [
      { method: "cash", amount: 700_000 },
      { method: "transfer", amount: 400_000 },
    ],
    cashiers: [{
      cashierId: "u1",
      cashierName: "Nguyễn An",
      orderCount: 4,
      grossSales: 1_400_000,
      refunds: 200_000,
      netSales: 1_200_000,
      averageOrderValue: 350_000,
    }],
    shifts: [{
      shiftId: "s1",
      shiftCode: "CA-001",
      businessDate: "2026-08-10",
      cashierId: "u1",
      cashierName: "Nguyễn An",
      status: "closed",
      grossSales: 1_400_000,
      collectedAmount: 1_100_000,
      refundedAmount: 200_000,
      varianceAmount: -20_000,
    }],
    debt: {
      totalDebt: 100_000,
      overdueDebt: 60_000,
      dueTodayDebt: 20_000,
      upcomingDebt: 20_000,
      customers: [{
        customerId: "c1",
        customerName: "Trần Bình",
        customerPhone: "0901000000",
        totalDebt: 100_000,
        overdueDebt: 60_000,
        nearestDueDate: "2026-08-08",
        orderCount: 2,
      }],
    },
    ...overrides,
  };
}

const emptyReport = report({
  range: { from: "2026-08-10", to: "2026-08-10" },
  summary: {
    grossSales: 0,
    refunds: 0,
    netSales: 0,
    orderCount: 0,
    averageOrderValue: 0,
    collectedAmount: 0,
    dueAmount: 0,
  },
  timeSeries: [{ businessDate: "2026-08-10", grossSales: 0, refunds: 0, netSales: 0, collectedAmount: 0, orderCount: 0 }],
  paymentMix: [],
  cashiers: [],
  shifts: [],
  debt: { totalDebt: 0, overdueDebt: 0, dueTodayDebt: 0, upcomingDebt: 0, customers: [] },
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  retailScopeState.scope = { companyCode: "ACME", branchId: "B1" };
  window.history.replaceState(null, "", "/erp?sub=bao-cao");
  vi.mocked(retailReportsApi.summary).mockResolvedValue(report());
  vi.mocked(retailReportsApi.export).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("RetailReportsPage", () => {
  it("loads today by default and keeps preset and custom filters across reloads", async () => {
    const firstView = render(<RetailReportsPage />);

    await waitFor(() => expect(retailReportsApi.summary).toHaveBeenCalledWith(
      { companyCode: "ACME", branchId: "B1" },
      {},
    ));
    expect(screen.getByRole("button", { name: "Hôm nay" }).getAttribute("aria-pressed")).toBe("true");

    await userEvent.click(screen.getByRole("button", { name: "7 ngày" }));
    await waitFor(() => expect(retailReportsApi.summary).toHaveBeenLastCalledWith(
      { companyCode: "ACME", branchId: "B1" },
      { preset: "7d" },
    ));
    expect(new URLSearchParams(window.location.search).get("reportPreset")).toBe("7d");

    firstView.unmount();
    vi.mocked(retailReportsApi.summary).mockClear();
    render(<RetailReportsPage />);
    await waitFor(() => expect(retailReportsApi.summary).toHaveBeenCalledWith(
      { companyCode: "ACME", branchId: "B1" },
      { preset: "7d" },
    ));
    expect(screen.getByRole("button", { name: "7 ngày" }).getAttribute("aria-pressed")).toBe("true");

    await userEvent.click(screen.getByRole("button", { name: "30 ngày" }));
    await waitFor(() => expect(retailReportsApi.summary).toHaveBeenLastCalledWith(
      { companyCode: "ACME", branchId: "B1" },
      { preset: "30d" },
    ));

    await userEvent.click(screen.getByRole("button", { name: "Tùy chọn" }));
    fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2026-07-01" } });
    fireEvent.change(screen.getByLabelText("Đến ngày"), { target: { value: "2026-08-10" } });
    await userEvent.click(screen.getByRole("button", { name: "Áp dụng khoảng ngày" }));
    await waitFor(() => expect(retailReportsApi.summary).toHaveBeenLastCalledWith(
      { companyCode: "ACME", branchId: "B1" },
      { from: "2026-07-01", to: "2026-08-10" },
    ));
    const params = new URLSearchParams(window.location.search);
    expect(params.get("reportPreset")).toBeNull();
    expect(params.get("reportFrom")).toBe("2026-07-01");
    expect(params.get("reportTo")).toBe("2026-08-10");
    expect(params.get("companyCode")).toBeNull();
    expect(params.get("branchId")).toBeNull();

    cleanup();
    vi.mocked(retailReportsApi.summary).mockClear();
    render(<RetailReportsPage />);
    await waitFor(() => expect(retailReportsApi.summary).toHaveBeenCalledWith(
      { companyCode: "ACME", branchId: "B1" },
      { from: "2026-07-01", to: "2026-08-10" },
    ));
    expect(screen.getByRole("button", { name: "Tùy chọn" }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByLabelText("Từ ngày") as HTMLInputElement).value).toBe("2026-07-01");
    expect((screen.getByLabelText("Đến ngày") as HTMLInputElement).value).toBe("2026-08-10");
  });

  it("validates reversed and over-366-day custom ranges before fetching", async () => {
    render(<RetailReportsPage />);
    await screen.findAllByText("Nguyễn An");
    const callsBeforeCustom = vi.mocked(retailReportsApi.summary).mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: "Tùy chọn" }));
    fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2026-08-11" } });
    fireEvent.change(screen.getByLabelText("Đến ngày"), { target: { value: "2026-08-10" } });
    await userEvent.click(screen.getByRole("button", { name: "Áp dụng khoảng ngày" }));
    expect(await screen.findByText("Ngày bắt đầu không được sau ngày kết thúc.")).toBeTruthy();
    expect(retailReportsApi.summary).toHaveBeenCalledTimes(callsBeforeCustom);

    fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2025-08-09" } });
    await userEvent.click(screen.getByRole("button", { name: "Áp dụng khoảng ngày" }));
    expect(await screen.findByText("Khoảng báo cáo tối đa 366 ngày.")).toBeTruthy();
    expect(retailReportsApi.summary).toHaveBeenCalledTimes(callsBeforeCustom);

    fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2025-08-10" } });
    await userEvent.click(screen.getByRole("button", { name: "Áp dụng khoảng ngày" }));
    await waitFor(() => expect(retailReportsApi.summary).toHaveBeenLastCalledWith(
      { companyCode: "ACME", branchId: "B1" },
      { from: "2025-08-10", to: "2026-08-10" },
    ));
  });

  it("renders backend metrics, charts and tables without exposing absent profit fields", async () => {
    render(<RetailReportsPage />);

    expect((await screen.findAllByText("Nguyễn An")).length).toBe(2);
    const kpis = screen.getByLabelText("Chỉ số tổng quan");
    expect(within(kpis).getByText("Doanh thu thuần")).toBeTruthy();
    expect(within(kpis).getByText(/1\.200\.000/)).toBeTruthy();
    expect(within(kpis).queryByText("Giá vốn")).toBeNull();
    expect(within(kpis).queryByText("Lợi nhuận gộp")).toBeNull();
    expect(within(kpis).queryByText("Tỷ suất lợi nhuận")).toBeNull();

    expect(screen.getByRole("img", { name: "Xu hướng doanh thu theo ngày" })).toBeTruthy();
    expect(screen.getByText("Tiền mặt")).toBeTruthy();
    expect(screen.getByText("Chuyển khoản")).toBeTruthy();
    expect(screen.getByRole("table", { name: "Hiệu suất thu ngân" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Ca bán hàng" })).toBeTruthy();
    expect(screen.getByText("CA-001")).toBeTruthy();
    expect(screen.getByRole("table", { name: "Công nợ khách hàng" })).toBeTruthy();
    expect(screen.getByText("Trần Bình")).toBeTruthy();
  });

  it("renders optional cost and profit KPIs only when the backend supplies them", async () => {
    vi.mocked(retailReportsApi.summary).mockResolvedValue(report({
      summary: {
        ...report().summary,
        totalCost: 700_000,
        grossProfit: 500_000,
        grossMarginPercent: 41.7,
      },
    }));

    render(<RetailReportsPage />);

    const kpis = await screen.findByLabelText("Chỉ số tổng quan");
    expect(within(kpis).getByText("Giá vốn")).toBeTruthy();
    expect(within(kpis).getByText("Lợi nhuận gộp")).toBeTruthy();
    expect(within(kpis).getByText("Tỷ suất lợi nhuận")).toBeTruthy();
    expect(within(kpis).getByText("41,7%")).toBeTruthy();
  });

  it("shows zero KPIs and explicit empty rows when the report has no activity", async () => {
    vi.mocked(retailReportsApi.summary).mockResolvedValue(emptyReport);

    render(<RetailReportsPage />);

    const kpis = await screen.findByLabelText("Chỉ số tổng quan");
    expect(within(kpis).getAllByText(/0/).length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText("Chưa có dữ liệu thu ngân trong khoảng này.")).toBeTruthy();
    expect(screen.getByText("Chưa có ca bán hàng trong khoảng này.")).toBeTruthy();
    expect(screen.getByText("Không có khách hàng đang nợ trong khoảng này.")).toBeTruthy();
  });

  it("keeps the last successful dashboard when refresh or export fails and allows retry", async () => {
    render(<RetailReportsPage />);
    expect((await screen.findAllByText("Nguyễn An")).length).toBe(2);

    vi.mocked(retailReportsApi.summary).mockRejectedValueOnce(new Error("Mất kết nối báo cáo"));
    await userEvent.click(screen.getByRole("button", { name: "Tải lại báo cáo" }));
    expect(await screen.findByText("Mất kết nối báo cáo")).toBeTruthy();
    expect(screen.getAllByText("Nguyễn An").length).toBe(2);

    vi.mocked(retailReportsApi.export).mockRejectedValueOnce(new Error("Không xuất được Excel"));
    await userEvent.click(screen.getByRole("button", { name: "Xuất Excel" }));
    expect(await screen.findByText("Không xuất được Excel")).toBeTruthy();
    expect(retailReportsApi.export).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, {});
    expect(screen.getAllByText("Nguyễn An").length).toBe(2);

    vi.mocked(retailReportsApi.summary).mockResolvedValueOnce(emptyReport);
    await userEvent.click(screen.getByRole("button", { name: "Thử tải lại" }));
    expect(await screen.findByText("Chưa có dữ liệu thu ngân trong khoảng này.")).toBeTruthy();
  });

  it("ignores an older response that resolves after a newer filter request", async () => {
    render(<RetailReportsPage />);
    expect((await screen.findAllByText("Nguyễn An")).length).toBe(2);

    const oldRequest = deferred<RetailReport>();
    const newRequest = deferred<RetailReport>();
    vi.mocked(retailReportsApi.summary)
      .mockImplementationOnce(() => oldRequest.promise)
      .mockImplementationOnce(() => newRequest.promise);

    await userEvent.click(screen.getByRole("button", { name: "7 ngày" }));
    await waitFor(() => expect(retailReportsApi.summary).toHaveBeenLastCalledWith(
      { companyCode: "ACME", branchId: "B1" },
      { preset: "7d" },
    ));
    await userEvent.click(screen.getByRole("button", { name: "30 ngày" }));
    await waitFor(() => expect(retailReportsApi.summary).toHaveBeenLastCalledWith(
      { companyCode: "ACME", branchId: "B1" },
      { preset: "30d" },
    ));

    newRequest.resolve(report({ cashiers: [{ ...report().cashiers[0], cashierName: "Dữ liệu mới" }] }));
    expect(await screen.findByText("Dữ liệu mới")).toBeTruthy();
    oldRequest.resolve(report({ cashiers: [{ ...report().cashiers[0], cashierName: "Dữ liệu cũ" }] }));
    await Promise.resolve();
    expect(screen.queryByText("Dữ liệu cũ")).toBeNull();
    expect(screen.getByText("Dữ liệu mới")).toBeTruthy();
  });

  it("does not display or restore data from the previously active branch", async () => {
    const firstView = render(<RetailReportsPage />);
    expect((await screen.findAllByText("Nguyễn An")).length).toBe(2);

    const branchRequest = deferred<RetailReport>();
    vi.mocked(retailReportsApi.summary).mockImplementationOnce(() => branchRequest.promise);
    retailScopeState.scope = { companyCode: "ACME", branchId: "B2" };
    firstView.rerender(<RetailReportsPage />);

    expect(screen.queryAllByText("Nguyễn An")).toHaveLength(0);
    expect(screen.getByLabelText("Đang tải báo cáo")).toBeTruthy();
    branchRequest.resolve(report({ cashiers: [{ ...report().cashiers[0], cashierName: "Thu ngân B2" }] }));
    expect(await screen.findByText("Thu ngân B2")).toBeTruthy();
  });

  it("shows a branch prompt without issuing unscoped requests", () => {
    retailScopeState.scope = null;

    render(<RetailReportsPage />);

    expect(screen.getByText("Vui lòng chọn chi nhánh để xem báo cáo.")).toBeTruthy();
    expect(retailReportsApi.summary).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiClientError } from "../../../services/apiClientError";
import { apiFetch, getAccessToken } from "../../shared/lib/apiFetch";
import type { RetailReportFilters } from "../types";
import { retailReportsApi } from "./retailReports.api";

vi.mock("../../shared/lib/apiFetch", () => ({
  apiFetch: vi.fn(),
  getAccessToken: vi.fn(),
}));

const scope = { companyCode: "ACME", branchId: "B1" };
const report = {
  range: { from: "2026-08-04", to: "2026-08-10" },
  summary: {
    grossSales: 100,
    refunds: 0,
    netSales: 100,
    orderCount: 1,
    averageOrderValue: 100,
    collectedAmount: 100,
    dueAmount: 0,
  },
  timeSeries: [],
  paymentMix: [],
  cashiers: [],
  shifts: [],
  debt: { totalDebt: 0, overdueDebt: 0, dueTodayDebt: 0, upcomingDebt: 0, customers: [] },
};

describe("retailReportsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAccessToken).mockReturnValue("access-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("loads a summary with branch scope and date filters without includeProfit", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true, data: report });

    await expect(retailReportsApi.summary(scope, { from: "2026-08-04", to: "2026-08-10" })).resolves.toEqual(report);

    expect(apiFetch).toHaveBeenCalledWith("/retail/reports/summary", {
      params: { companyCode: "ACME", branchId: "B1", from: "2026-08-04", to: "2026-08-10" },
    });
    expect(vi.mocked(apiFetch).mock.calls[0]?.[1]?.params).not.toHaveProperty("includeProfit");
  });

  it("whitelists product dimensions for summary URLs", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true, data: report });
    const filters = { from: "2026-08-04", to: "2026-08-10", salespersonId: "u1", productId: "p1", sku: "S-1", category: "Drinks", brand: "North" };
    await retailReportsApi.summary(scope, filters);
    expect(apiFetch).toHaveBeenCalledWith("/retail/reports/summary", { params: { companyCode: "ACME", branchId: "B1", ...filters } });
  });

  it("does not let extra summary filter keys override scope or request profit", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true, data: report });
    const unsafeFilters = {
      preset: "7d",
      includeProfit: true,
      companyCode: "OTHER",
      branchId: "B2",
    } as unknown as RetailReportFilters;

    await retailReportsApi.summary(scope, unsafeFilters);

    expect(apiFetch).toHaveBeenCalledWith("/retail/reports/summary", {
      params: { companyCode: "ACME", branchId: "B1", preset: "7d" },
    });
  });

  it("exports a preset with authentication and cleans up its object URL", async () => {
    const blob = new Blob(["workbook"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const fetchMock = vi.fn().mockResolvedValue(new Response(blob, {
      status: 200,
      headers: { "Content-Disposition": "attachment; filename*=UTF-8''bao-cao%20HCM.xlsx" },
    }));
    const createObjectURL = vi.fn().mockReturnValue("blob:retail-report");
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));

    await retailReportsApi.export(scope, { preset: "7d" });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/retail/reports/export?companyCode=ACME&branchId=B1&preset=7d");
    expect(new Headers(options.headers).get("Authorization")).toBe("Bearer access-token");
    expect(click).toHaveBeenCalledOnce();
    expect((click.mock.instances[0] as HTMLAnchorElement | undefined)?.download).toBe("bao-cao HCM.xlsx");
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:retail-report");
    expect(document.querySelector("a")).toBeNull();
  });

  it("passes an abort signal to fetch and does not download a superseded export", async () => {
    let resolveBlob!: (blob: Blob) => void;
    const blobPromise = new Promise<Blob>((resolve) => { resolveBlob = resolve; });
    const response = {
      ok: true,
      headers: new Headers({ "Content-Disposition": "attachment; filename=stale.xlsx" }),
      blob: vi.fn(() => blobPromise),
    } as unknown as Response;
    const fetchMock = vi.fn().mockResolvedValue(response);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const createObjectURL = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const controller = new AbortController();

    const exportPromise = retailReportsApi.export(scope, { preset: "7d" }, controller.signal);
    await vi.waitFor(() => expect(response.blob).toHaveBeenCalledOnce());
    controller.abort();
    resolveBlob(new Blob(["stale workbook"]));

    await expect(exportPromise).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ signal: controller.signal });
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it("does not let extra export filter keys override scope or request profit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(["workbook"]), { status: 200 }));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", Object.assign(URL, {
      createObjectURL: vi.fn().mockReturnValue("blob:retail-report"),
      revokeObjectURL: vi.fn(),
    }));
    const unsafeFilters = {
      preset: "30d",
      includeProfit: true,
      companyCode: "OTHER",
      branchId: "B2",
    } as unknown as RetailReportFilters;

    await retailReportsApi.export(scope, unsafeFilters);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/retail/reports/export?companyCode=ACME&branchId=B1&preset=30d",
      expect.any(Object),
    );
  });

  it("sanitizes an unsafe attachment filename", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(["workbook"]), {
      status: 200,
      headers: { "Content-Disposition": 'attachment; filename="../bao-cao\\r\\n.xlsx"' },
    }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", Object.assign(URL, {
      createObjectURL: vi.fn().mockReturnValue("blob:retail-report"),
      revokeObjectURL: vi.fn(),
    }));

    await retailReportsApi.export(scope, { from: "2026-08-10", to: "2026-08-10" });

    expect((click.mock.instances[0] as HTMLAnchorElement | undefined)?.download).toBe("bao-cao-r-n.xlsx");
  });

  it("surfaces the API error envelope without creating a download", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false,
      error: { code: "BAD_REPORT_RANGE", message: "Khoảng ngày không hợp lệ.", requestId: "req-1" },
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }));
    const createObjectURL = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));

    await expect(retailReportsApi.export(scope, { preset: "30d" })).rejects.toMatchObject({
      status: 400,
      code: "BAD_REPORT_RANGE",
      message: "Khoảng ngày không hợp lệ.",
      requestId: "req-1",
    } satisfies Partial<ApiClientError>);
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiClientError } from "../../../services/apiClientError";
import { apiFetch, getAccessToken } from "../../shared/lib/apiFetch";
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

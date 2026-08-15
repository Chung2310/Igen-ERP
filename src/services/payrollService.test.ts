// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAccessToken = vi.hoisted(() => vi.fn(() => "access-token"));

vi.mock("./authService", () => ({ getAccessToken }));

import { payrollService } from "./payrollService";

describe("payrollService requests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getAccessToken.mockReturnValue("access-token");
  });

  it("bypasses the browser cache when reloading a payroll run", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { _id: "run-a", status: "review" } }),
    } as any);

    await payrollService.getRun("2026-08");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/payroll/periods/2026-08/run",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});

describe("payrollService.printPayslip", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getAccessToken.mockReturnValue("access-token");
  });

  it("downloads protected payslip HTML with the bearer token", async () => {
    const html = new Blob(["<html>payslip</html>"], { type: "text/html" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(html),
    } as any);

    await expect(payrollService.printPayslip("run-a", "employee-a")).resolves.toBe(html);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/payroll/runs/run-a/payslips/employee-a/print",
      { headers: { Authorization: "Bearer access-token" } },
    );
  });
});

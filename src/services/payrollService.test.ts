// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAccessToken = vi.hoisted(() => vi.fn(() => "access-token"));

vi.mock("./authService", () => ({ getAccessToken }));

import { payrollService } from "./payrollService";

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

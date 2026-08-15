import { describe, expect, it } from "vitest";
import { parseSettlementImportFile, parseSettlementImportRows } from "./settlement-input";
import type { WorkerReferral } from "../types";

const referral = (id: string, workerId: string, commissionScheme: WorkerReferral["commissionScheme"]): WorkerReferral => ({
  _id: id, workerId, partnerId: "partner", policyId: "policy", commissionScheme,
  referredAt: "2026-08-01", employmentStartDate: "2026-08-01", effectiveFrom: "2026-08-01", status: "active", confirmationSource: "manual",
});

describe("settlement input import", () => {
  it("maps hours and months by worker id to the matching referral scheme", () => {
    const result = parseSettlementImportRows([
      { "Mã lao động": "worker-1", "Số giờ trong tháng": "170,5" },
      { "Mã lao động": "worker-2", "Số tháng đạt được": 2 },
    ], [referral("ref-1", "worker-1", "seasonal_hourly"), referral("ref-2", "worker-2", "official_monthly")], [{ _id: "worker-1", fullName: "A" }, { _id: "worker-2", fullName: "B" }]);

    expect(result.errors).toEqual([]);
    expect(result.matchedCount).toBe(2);
    expect(result.values).toEqual({ "ref-1": { officialMonths: "", seasonalHours: "170.5" }, "ref-2": { officialMonths: "2", seasonalHours: "" } });
  });

  it("reports unknown and duplicate worker ids instead of silently overwriting", () => {
    const result = parseSettlementImportRows([
      { "Mã lao động": "missing", "Số giờ trong tháng": 10 },
      { "Mã lao động": "worker-1", "Số giờ trong tháng": 10 },
      { "Mã lao động": "worker-1", "Số giờ trong tháng": 12 },
    ], [referral("ref-1", "worker-1", "seasonal_hourly")], [{ _id: "worker-1", fullName: "A" }]);

    expect(result.matchedCount).toBe(1);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("missing không thuộc"),
      expect.stringContaining("worker-1 bị trùng"),
    ]));
  });

  it("reads UTF-8 Vietnamese headers from CSV files", async () => {
    const file = new File([
      "Mã lao động,Số giờ trong tháng\nworker-1,170",
    ], "input.csv", { type: "text/csv" });
    const result = await parseSettlementImportFile(
      file,
      [referral("ref-1", "worker-1", "seasonal_hourly")],
      [{ _id: "worker-1", fullName: "A" }],
    );

    expect(result.errors).toEqual([]);
    expect(result.matchedCount).toBe(1);
    expect(result.values["ref-1"]?.seasonalHours).toBe("170");
  });
});

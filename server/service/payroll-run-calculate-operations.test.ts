import { describe, expect, it, vi } from "vitest";
import { calculateDetailedPayrollBatch, calculateRun } from "./payroll-run-calculation.service";
import { projectPayrollRevisionWithOverrides } from "./payroll-run-calculate-operations.service";

const employee = (employeeId: string, monthlySalary: number) => ({
  employeeId,
  segments: [{ sourceId: `contract:${employeeId}`, start: "2026-07-01", end: "2026-07-31", monthlySalary }],
  standardDays: 23,
  standardHours: 184,
  workedMinutes: 184 * 60,
  shortageMinutes: 0,
  paidLeaveMinutesByRate: [],
  overtime: [],
  allowances: 0,
  bonuses: 0,
  deductions: 0,
  adjustments: 0,
  issues: [],
});

describe("calculateDetailedPayrollBatch", () => {
  it("aggregates lines and totals across every employee in the run", () => {
    const result = calculateDetailedPayrollBatch([employee("emp-1", 10_000_000), employee("emp-2", 20_000_000)]);

    expect(result.lines).toHaveLength(2);
    expect(result.lines.map((line) => line.employeeId)).toEqual(["emp-1", "emp-2"]);
    expect(result.totals.netPay).toBeGreaterThan(0);
    expect(result.totals.grossPay).toBe(
      calculateDetailedPayrollBatch([employee("emp-1", 10_000_000)]).totals.grossPay
      + calculateDetailedPayrollBatch([employee("emp-2", 20_000_000)]).totals.grossPay,
    );
  });

  it("collects effective-input issues from every employee", () => {
    const withIssue = { ...employee("emp-3", 0), issues: [{ code: "SALARY_TERM_MISSING", message: "missing", employeeId: "emp-3", severity: "blocking" as const }] };
    const result = calculateDetailedPayrollBatch([employee("emp-1", 10_000_000), withIssue]);
    expect(result.issues).toEqual([{ code: "SALARY_TERM_MISSING", message: "missing", employeeId: "emp-3", severity: "blocking" }]);
  });
});

describe("calculateRun for a whole run", () => {
  const repositories = (overrides: any = {}) => ({
    run: {
      get: async () => ({ id: "run-1", status: "draft", version: 1 }),
      activateRevision: vi.fn(async () => ({ version: 2 })),
      ...overrides.run,
    },
    revision: {
      nextRevision: async () => 1,
      create: async (value: any) => ({ id: "revision-1", ...value }),
      update: async (_id: string, value: any) => ({ id: "revision-1", ...value }),
      ...overrides.revision,
    },
  });

  it("stores one line per employee of the locked snapshot", async () => {
    const repos = repositories();
    const result: any = await calculateRun({
      ...repos,
      input: async () => [employee("emp-1", 10_000_000), employee("emp-2", 12_000_000)],
      expectedVersion: 1,
    });

    expect(result.status).toBe("completed");
    expect(result.lines.map((line: any) => line.employeeId)).toEqual(["emp-1", "emp-2"]);
    expect(repos.run.activateRevision).toHaveBeenCalledWith("revision-1", 1, expect.stringMatching(/^[0-9a-f]{64}$/));
  });

  it("keeps the previous active revision when the run version moved during calculation", async () => {
    const repos = repositories({ run: { activateRevision: vi.fn(async () => null) } });
    const result: any = await calculateRun({
      ...repos,
      input: async () => [employee("emp-1", 10_000_000)],
      expectedVersion: 1,
    });

    expect(result).toEqual({ code: "PAYROLL_VERSION_CONFLICT", currentVersion: 1 });
  });

  it("refuses to calculate a run whose attendance is not locked yet", async () => {
    const repos = repositories({ run: { get: async () => ({ id: "run-1", status: "finalized", version: 1 }) } });
    const result: any = await calculateRun({
      ...repos,
      input: async () => { throw new Error("must not load"); },
      expectedVersion: 1,
    });

    expect(result).toEqual({ code: "PAYROLL_RUN_STATE_INVALID", status: "finalized" });
  });

  it("records the idempotency result only after a successful calculation", async () => {
    const saved: any[] = [];
    const repos = repositories();
    await calculateRun({
      ...repos,
      idempotencyKey: "key-1",
      idempotency: { get: async () => null, save: async (key: string, value: any) => { saved.push({ key, value }); } },
      input: async () => [employee("emp-1", 10_000_000)],
      expectedVersion: 1,
    });

    expect(saved).toHaveLength(1);
    expect(saved[0].key).toBe("key-1");
    expect(saved[0].value.status).toBe("completed");
  });

  it("keeps recalculated system lines immutable while applying an existing override to the returned revision", async () => {
    const repos = repositories();
    const completed: any = await calculateRun({
      ...repos,
      input: async () => [{
        ...employee("emp-1", 10_000_000),
        allowances: 700_000,
        bonuses: 500_000,
        deductions: 25_000,
      }],
      expectedVersion: 1,
    });
    const storedSystemLine = structuredClone(completed.lines[0]);
    const storedChecksum = completed.checksum;

    const projected: any = projectPayrollRevisionWithOverrides(completed, [{
      employeeId: "emp-1",
      adjustedBase: 8_000_000,
      bonusTotal: 0,
      version: 4,
    }]);

    expect(completed.lines[0]).toEqual(storedSystemLine);
    expect(completed.checksum).toBe(storedChecksum);
    expect(projected.checksum).toBe(storedChecksum);
    expect(projected.lines).toEqual(completed.lines);
    expect(projected.effectiveLines[0]).toMatchObject({
      overrideVersion: 4,
      overrideValues: { adjustedBase: 8_000_000, bonusTotal: 0 },
      effectiveValues: { adjustedBase: 8_000_000, bonusTotal: 0 },
    });
    expect(projected.effectiveLines[0].systemValues.adjustedBase).toBe(storedSystemLine.calculation.adjustedBase);
    expect(projected.effectiveLines[0].net).toBeLessThan(storedSystemLine.calculation.net);
    expect(projected.effectiveLines[0]).toMatchObject({
      calculation: {
        adjustedBase: 8_000_000,
        bonusTotal: 0,
        net: projected.effectiveLines[0].net,
      },
      vietnam: storedSystemLine.vietnam,
    });
  });

  it("applies an employee override once to aggregated system values across salary segments", () => {
    const segmentLines = [{
      employeeId: "emp-1",
      employeeName: "Employee One",
      calculation: {
        monthlySalary: 6_000_000, adjustedBase: 5_000_000, overtime: 500_000,
        bonuses: 200_000, allowances: 300_000, adjustments: 0,
        otherDeductions: 100_000, gross: 6_000_000, deductions: 100_000, net: 5_900_000,
      },
      vietnam: { income: { totalIncome: 6_000_000 }, deductions: { other: 100_000, total: 100_000 }, netPay: 5_900_000 },
    }, {
      employeeId: "emp-1",
      employeeName: "Employee One",
      calculation: {
        monthlySalary: 4_000_000, adjustedBase: 3_000_000, overtime: 200_000,
        bonuses: 100_000, allowances: 200_000, adjustments: 0,
        otherDeductions: 50_000, gross: 3_500_000, deductions: 50_000, net: 3_450_000,
      },
      vietnam: { income: { totalIncome: 3_500_000 }, deductions: { other: 50_000, total: 50_000 }, netPay: 3_450_000 },
    }];
    const storedSegments = structuredClone(segmentLines);

    const projected: any = projectPayrollRevisionWithOverrides({ lines: segmentLines, checksum: "system-only" }, [{
      employeeId: "emp-1", adjustedBase: 7_000_000, bonusTotal: 0, version: 2,
    }]);

    expect(projected.lines).toEqual(storedSegments);
    expect(projected.effectiveLines).toHaveLength(1);
    expect(projected.effectiveLines[0]).toMatchObject({
      employeeId: "emp-1",
      segmentLines: storedSegments,
      systemValues: {
        baseSalary: 10_000_000,
        adjustedBase: 8_000_000,
        overtime: 700_000,
        bonusTotal: 300_000,
        hiddenIncome: 500_000,
        otherDeductions: 150_000,
      },
      overrideValues: { adjustedBase: 7_000_000, bonusTotal: 0 },
      effectiveValues: { adjustedBase: 7_000_000, bonusTotal: 0, hiddenIncome: 500_000 },
      deductionTotal: 150_000,
      net: 8_050_000,
      overrideVersion: 2,
    });
    expect(projected.checksum).toBe("system-only");
  });

  it("aggregates the full Vietnam money breakdown across salary segments", () => {
    const segmentLines = [{
      employeeId: "emp-1",
      employeeName: "Employee One",
      calculation: {
        monthlySalary: 6_000_000, adjustedBase: 5_000_000, overtime: 500_000,
        bonuses: 200_000, otherDeductions: 100_000, gross: 6_100_000, net: 5_280_000,
      },
      vietnam: {
        workPay: 5_000_000,
        overtime: { details: [{ category: "weekday", night: false, minutes: 60, multiplier: 1.5, amount: 500_000 }], total: 500_000 },
        income: { taxableAllowances: 300_000, exemptAllowances: 100_000, bonuses: 200_000, totalIncome: 6_100_000, taxableIncome: 6_000_000 },
        insurance: {
          funds: [
            { code: "social", base: 6_000_000, employeeRate: 0.08, employerRate: 0.175, employeeAmount: 480_000, employerAmount: 1_050_000 },
            { code: "health", base: 6_000_000, employeeRate: 0.015, employerRate: 0.03, employeeAmount: 90_000, employerAmount: 180_000 },
          ],
          employeeTotal: 570_000,
          employerTotal: 1_230_000,
        },
        tax: {
          method: "progressive",
          deductions: { personal: 1_000_000, dependents: 100_000, insurance: 570_000, other: 30_000, total: 1_700_000 },
          assessableIncome: 2_000_000,
          brackets: [{ upTo: 5_000_000, rate: 0.05, taxableAmount: 2_000_000, tax: 100_000 }],
          tax: 100_000,
        },
        deductions: { other: 100_000, advances: 50_000, total: 820_000 },
        netPay: 5_280_000,
        carryForward: 0,
        employerCost: 7_330_000,
        warnings: [],
      },
    }, {
      employeeId: "emp-1",
      employeeName: "Employee One",
      calculation: {
        monthlySalary: 4_000_000, adjustedBase: 3_000_000, overtime: 200_000,
        bonuses: 100_000, otherDeductions: 50_000, gross: 3_550_000, net: 3_045_000,
      },
      vietnam: {
        workPay: 3_000_000,
        overtime: { details: [{ category: "weekday", night: false, minutes: 30, multiplier: 1.5, amount: 200_000 }], total: 200_000 },
        income: { taxableAllowances: 200_000, exemptAllowances: 50_000, bonuses: 100_000, totalIncome: 3_550_000, taxableIncome: 3_500_000 },
        insurance: {
          funds: [
            { code: "social", base: 4_000_000, employeeRate: 0.08, employerRate: 0.175, employeeAmount: 320_000, employerAmount: 700_000 },
            { code: "health", base: 4_000_000, employeeRate: 0.015, employerRate: 0.03, employeeAmount: 60_000, employerAmount: 120_000 },
          ],
          employeeTotal: 380_000,
          employerTotal: 820_000,
        },
        tax: {
          method: "progressive",
          deductions: { personal: 1_000_000, dependents: 100_000, insurance: 380_000, other: 20_000, total: 1_500_000 },
          assessableIncome: 1_000_000,
          brackets: [{ upTo: 5_000_000, rate: 0.05, taxableAmount: 1_000_000, tax: 50_000 }],
          tax: 50_000,
        },
        deductions: { other: 50_000, advances: 25_000, total: 505_000 },
        netPay: 3_045_000,
        carryForward: 0,
        employerCost: 4_370_000,
        warnings: [],
      },
    }];

    const line: any = projectPayrollRevisionWithOverrides({ lines: segmentLines }, []).effectiveLines[0];

    expect(line.vietnam).toMatchObject({
      workPay: 8_000_000,
      overtime: { total: 700_000 },
      income: {
        taxableAllowances: 500_000,
        exemptAllowances: 150_000,
        bonuses: 300_000,
        totalIncome: 9_650_000,
        taxableIncome: 9_500_000,
      },
      insurance: {
        employeeTotal: 950_000,
        employerTotal: 2_050_000,
      },
      tax: {
        deductions: { personal: 2_000_000, dependents: 200_000, insurance: 950_000, other: 50_000, total: 3_200_000 },
        assessableIncome: 3_000_000,
        tax: 150_000,
      },
      deductions: { other: 150_000, advances: 75_000, total: 1_325_000 },
      netPay: 8_325_000,
      carryForward: 0,
      employerCost: 11_700_000,
    });
    expect(line.vietnam.overtime.details).toHaveLength(2);
    expect(line.vietnam.insurance.funds).toEqual([
      expect.objectContaining({ code: "social", base: 10_000_000, employeeAmount: 800_000, employerAmount: 1_750_000 }),
      expect.objectContaining({ code: "health", base: 10_000_000, employeeAmount: 150_000, employerAmount: 300_000 }),
    ]);
    expect(line.vietnam.tax.brackets).toEqual([
      expect.objectContaining({ upTo: 5_000_000, rate: 0.05, taxableAmount: 3_000_000, tax: 150_000 }),
    ]);
  });

  it("deduplicates system custom values across segments and restores the highest-version snapshot value", () => {
    const segmentLines = [{
      employeeId: "emp-1",
      sourceIds: ["contract-b"],
      calculation: { monthlySalary: 5_000, adjustedBase: 5_000, gross: 5_000, net: 5_000 },
      periodInput: { version: 2, values: { agreedSalary: 5_000, sales: 125 }, provenance: {} },
    }, {
      employeeId: "emp-1",
      sourceIds: ["contract-a"],
      calculation: { monthlySalary: 5_000, adjustedBase: 5_000, gross: 5_000, net: 5_000 },
      periodInput: { version: 3, values: { agreedSalary: 5_000, sales: 275 }, provenance: {} },
    }];

    const overridden: any = projectPayrollRevisionWithOverrides({ lines: segmentLines }, [{
      employeeId: "emp-1", customValues: { sales: 900 }, version: 4,
    }]).effectiveLines[0];
    const restored: any = projectPayrollRevisionWithOverrides({ lines: [...segmentLines].reverse() }, []).effectiveLines[0];

    expect(overridden.systemValues.customValues).toEqual({ sales: 275 });
    expect(overridden.effectiveValues.customValues).toEqual({ sales: 900 });
    expect(overridden.provenance.customValues).toEqual({ sales: "manual_override" });
    expect(restored.systemValues.customValues).toEqual({ sales: 275 });
    expect(restored.effectiveValues.customValues).toEqual({ sales: 275 });
    expect(restored.provenance.customValues).toEqual({ sales: "system" });
  });
});

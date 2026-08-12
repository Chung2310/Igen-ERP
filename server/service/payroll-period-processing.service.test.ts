import { describe, expect, it, vi } from "vitest";
import { PayrollPeriodProcessingError, processPayrollPeriod } from "./payroll-period-processing.service";

describe("processPayrollPeriod", () => {
  it("synchronizes, locks, then calculates payroll", async () => {
    const order: string[] = [];
    const result = await processPayrollPeriod({
      syncAttendance: async () => { order.push("sync"); },
      lockAttendance: async () => { order.push("lock"); },
      calculatePayroll: async () => { order.push("calculate"); return { _id: "run-a", status: "draft" }; },
    });

    expect(order).toEqual(["sync", "lock", "calculate"]);
    expect(result).toEqual({ _id: "run-a", status: "draft" });
  });

  it.each([
    ["sync_attendance", "syncAttendance", []],
    ["lock_attendance", "lockAttendance", ["syncAttendance"]],
    ["calculate_payroll", "calculatePayroll", ["syncAttendance", "lockAttendance"]],
  ] as const)("stops after a %s failure", async (stage, failingOperation, completed) => {
    const calls: string[] = [];
    const operation = (name: string) => vi.fn(async () => {
      if (name === failingOperation) throw new Error(`${name} failed`);
      calls.push(name);
      return name === "calculatePayroll" ? { status: "draft" } : undefined;
    });

    const promise = processPayrollPeriod({
      syncAttendance: operation("syncAttendance"),
      lockAttendance: operation("lockAttendance"),
      calculatePayroll: operation("calculatePayroll"),
    });

    await expect(promise).rejects.toMatchObject({ stage, message: `${failingOperation} failed` } satisfies Partial<PayrollPeriodProcessingError>);
    expect(calls).toEqual(completed);
  });
});

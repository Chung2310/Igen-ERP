export type PayrollProcessingStage = "sync_attendance" | "lock_attendance" | "calculate_payroll";

export class PayrollPeriodProcessingError extends Error {
  constructor(
    public readonly stage: PayrollProcessingStage,
    message: string,
    public readonly status = 500,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "PayrollPeriodProcessingError";
  }
}

type PayrollPeriodOperations<T> = {
  syncAttendance: () => Promise<unknown>;
  lockAttendance: () => Promise<unknown>;
  calculatePayroll: () => Promise<T>;
};

const runStage = async <T>(stage: PayrollProcessingStage, operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payroll period processing failed";
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    throw new PayrollPeriodProcessingError(stage, message, status, { cause: error });
  }
};

export async function processPayrollPeriod<T>(operations: PayrollPeriodOperations<T>): Promise<T> {
  await runStage("sync_attendance", operations.syncAttendance);
  await runStage("lock_attendance", operations.lockAttendance);
  return runStage("calculate_payroll", operations.calculatePayroll);
}

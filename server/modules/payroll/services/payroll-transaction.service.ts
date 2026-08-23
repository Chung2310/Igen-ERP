import mongoose, { type ClientSession } from "mongoose";

export type PayrollTransactionRunner = <T>(
  operation: (session?: ClientSession) => Promise<T>,
) => Promise<T>;

type PayrollTransactionRunnerDependencies = {
  getDatabase: () => {
    admin: () => { command: (command: { hello: 1 }) => Promise<Record<string, unknown>> };
  } | undefined;
  startSession: () => Promise<ClientSession>;
  environment?: string;
  allowNonAtomicDevelopment?: boolean;
  warn?: (message: string) => void;
};

const unavailable = (message = "Atomic payroll writes require a transaction-capable MongoDB topology") => (
  Object.assign(new Error(message), {
    code: "PAYROLL_TRANSACTION_UNAVAILABLE",
    status: 503,
  })
);

export function createPayrollAtomicTransactionRunner(
  dependencies: PayrollTransactionRunnerDependencies,
): PayrollTransactionRunner {
  return async <T>(operation: (session?: ClientSession) => Promise<T>) => {
    const database = dependencies.getDatabase();
    if (!database) throw unavailable("Payroll database is not connected");

    let topology: Record<string, unknown>;
    try {
      topology = await database.admin().command({ hello: 1 });
    } catch {
      throw unavailable("Unable to verify payroll transaction capability");
    }
    const supportsTransactions = Boolean(topology.setName) || topology.msg === "isdbgrid";
    if (!supportsTransactions) {
      const mayRunExplicitlyNonAtomic = dependencies.environment === "development"
        && dependencies.allowNonAtomicDevelopment === true;
      if (!mayRunExplicitlyNonAtomic) throw unavailable();
      dependencies.warn?.(
        "[Payroll] MongoDB standalone development mode: executing an explicitly non-atomic operation",
      );
      return operation(undefined);
    }

    let session: ClientSession;
    try {
      session = await dependencies.startSession();
    } catch {
      throw unavailable("Unable to start an atomic payroll transaction");
    }

    let result!: T;
    let transactionFailure: unknown;
    let operationFailure: unknown;
    let operationFailed = false;
    let transactionFailed = false;
    try {
      await session.withTransaction(async () => {
        try {
          result = await operation(session);
        } catch (error) {
          operationFailed = true;
          operationFailure = error;
          throw error;
        }
      });
    } catch (error) {
      transactionFailed = true;
      transactionFailure = operationFailed && error === operationFailure
        ? error
        : unavailable("Atomic payroll transaction execution failed");
    } finally {
      try {
        await session.endSession();
      } catch {
        dependencies.warn?.(
          "[Payroll] Transaction session cleanup failed after the transaction outcome was known",
        );
      }
    }
    if (transactionFailed) throw transactionFailure;
    return result;
  };
}

export const runPayrollAtomicTransaction = createPayrollAtomicTransactionRunner({
  getDatabase: () => mongoose.connection.db as any,
  startSession: () => mongoose.startSession(),
  environment: process.env.NODE_ENV,
  allowNonAtomicDevelopment: process.env.PAYROLL_ALLOW_NON_ATOMIC_DEVELOPMENT === "true",
  warn: (message) => console.warn(message),
});

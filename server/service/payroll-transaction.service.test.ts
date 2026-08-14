import { describe, expect, it, vi } from "vitest";
import { createPayrollAtomicTransactionRunner } from "./payroll-transaction.service";

describe("payroll atomic transaction runner", () => {
  it.each([
    { hello: { setName: "rs0" }, label: "replica set" },
    { hello: { msg: "isdbgrid" }, label: "sharded cluster" },
  ])("runs the operation in a session transaction on a $label", async ({ hello }) => {
    const session = {
      withTransaction: vi.fn(async (operation: () => Promise<unknown>) => operation()),
      endSession: vi.fn(async () => undefined),
    };
    const command = vi.fn(async () => hello);
    const startSession = vi.fn(async () => session);
    const runner = createPayrollAtomicTransactionRunner({
      getDatabase: () => ({ admin: () => ({ command }) }),
      startSession: startSession as any,
    });
    const operation = vi.fn(async (receivedSession) => receivedSession === session ? "saved" : "wrong");

    await expect(runner(operation)).resolves.toBe("saved");

    expect(command).toHaveBeenCalledWith({ hello: 1 });
    expect(session.withTransaction).toHaveBeenCalledOnce();
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it.each([
    { database: undefined, label: "disconnected database" },
    { database: { admin: () => ({ command: async () => ({ isWritablePrimary: true }) }) }, label: "standalone database" },
  ])("fails closed without running writes on a $label", async ({ database }) => {
    const operation = vi.fn();
    const startSession = vi.fn();
    const runner = createPayrollAtomicTransactionRunner({
      getDatabase: () => database as any,
      startSession,
    });

    await expect(runner(operation)).rejects.toMatchObject({
      code: "PAYROLL_TRANSACTION_UNAVAILABLE",
      status: 503,
    });
    expect(operation).not.toHaveBeenCalled();
    expect(startSession).not.toHaveBeenCalled();
  });

  it("supports standalone development explicitly and warns before non-atomic execution", async () => {
    const warn = vi.fn();
    const operation = vi.fn(async (session) => session === undefined ? "development-only" : "wrong");
    const runner = createPayrollAtomicTransactionRunner({
      environment: "development",
      allowNonAtomicDevelopment: true,
      warn,
      getDatabase: () => ({
        admin: () => ({ command: async () => ({ isWritablePrimary: true }) }),
      }) as any,
      startSession: vi.fn(),
    });

    await expect(runner(operation)).resolves.toBe("development-only");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("non-atomic"));
    expect(operation).toHaveBeenCalledWith(undefined);
  });

  it("fails closed in production even when non-atomic development was requested", async () => {
    const operation = vi.fn();
    const runner = createPayrollAtomicTransactionRunner({
      environment: "production",
      allowNonAtomicDevelopment: true,
      getDatabase: () => ({
        admin: () => ({ command: async () => ({ isWritablePrimary: true }) }),
      }) as any,
      startSession: vi.fn(),
    });

    await expect(runner(operation)).rejects.toMatchObject({
      code: "PAYROLL_TRANSACTION_UNAVAILABLE",
      status: 503,
    });
    expect(operation).not.toHaveBeenCalled();
  });

  it.each(["staging", "test", undefined])(
    "fails closed outside explicit development when NODE_ENV is %s",
    async (environment) => {
      const operation = vi.fn();
      const runner = createPayrollAtomicTransactionRunner({
        environment,
        allowNonAtomicDevelopment: true,
        getDatabase: () => ({
          admin: () => ({ command: async () => ({ isWritablePrimary: true }) }),
        }) as any,
        startSession: vi.fn(),
      });

      await expect(runner(operation)).rejects.toMatchObject({
        code: "PAYROLL_TRANSACTION_UNAVAILABLE",
        status: 503,
      });
      expect(operation).not.toHaveBeenCalled();
    },
  );

  it.each(["staging", "test", undefined])(
    "fails closed in %s when the development-only non-atomic flag is present",
    async (environment) => {
      const operation = vi.fn();
      const runner = createPayrollAtomicTransactionRunner({
        environment,
        allowNonAtomicDevelopment: true,
        getDatabase: () => ({
          admin: () => ({ command: async () => ({ isWritablePrimary: true }) }),
        }) as any,
        startSession: vi.fn(),
      });

      await expect(runner(operation)).rejects.toMatchObject({
        code: "PAYROLL_TRANSACTION_UNAVAILABLE",
        status: 503,
      });
      expect(operation).not.toHaveBeenCalled();
    },
  );

  it("fails closed when the topology probe fails", async () => {
    const operation = vi.fn();
    const runner = createPayrollAtomicTransactionRunner({
      environment: "development",
      allowNonAtomicDevelopment: true,
      getDatabase: () => ({
        admin: () => ({ command: async () => { throw new Error("probe failed"); } }),
      }) as any,
      startSession: vi.fn(),
    });

    await expect(runner(operation)).rejects.toMatchObject({
      code: "PAYROLL_TRANSACTION_UNAVAILABLE",
      status: 503,
    });
    expect(operation).not.toHaveBeenCalled();
  });

  it("never retries outside the transaction and always ends its session", async () => {
    const failure = new Error("transaction aborted");
    const operation = vi.fn(async () => { throw failure; });
    const session = {
      withTransaction: vi.fn(async (callback: () => Promise<unknown>) => callback()),
      endSession: vi.fn(async () => undefined),
    };
    const runner = createPayrollAtomicTransactionRunner({
      getDatabase: () => ({
        admin: () => ({ command: async () => ({ setName: "rs0" }) }),
      }) as any,
      startSession: async () => session as any,
    });

    await expect(runner(operation)).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledWith(session);
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it("returns a stable unavailable error when a transaction session cannot start", async () => {
    const operation = vi.fn();
    const runner = createPayrollAtomicTransactionRunner({
      getDatabase: () => ({
        admin: () => ({ command: async () => ({ setName: "rs0" }) }),
      }) as any,
      startSession: async () => { throw new Error("session pool unavailable"); },
    });

    await expect(runner(operation)).rejects.toMatchObject({
      code: "PAYROLL_TRANSACTION_UNAVAILABLE",
      status: 503,
    });
    expect(operation).not.toHaveBeenCalled();
  });

  it("maps transaction infrastructure failure without retrying the operation outside a session", async () => {
    const operation = vi.fn();
    const session = {
      withTransaction: vi.fn(async () => { throw new Error("transaction command rejected"); }),
      endSession: vi.fn(async () => undefined),
    };
    const runner = createPayrollAtomicTransactionRunner({
      getDatabase: () => ({
        admin: () => ({ command: async () => ({ setName: "rs0" }) }),
      }) as any,
      startSession: async () => session as any,
    });

    await expect(runner(operation)).rejects.toMatchObject({
      code: "PAYROLL_TRANSACTION_UNAVAILABLE",
      status: 503,
    });
    expect(operation).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it("does not report a committed write as failed when session cleanup rejects", async () => {
    const operation = vi.fn(async () => "committed");
    const session = {
      withTransaction: vi.fn(async (callback: () => Promise<unknown>) => callback()),
      endSession: vi.fn(async () => { throw new Error("cleanup failed"); }),
    };
    const runner = createPayrollAtomicTransactionRunner({
      getDatabase: () => ({
        admin: () => ({ command: async () => ({ setName: "rs0" }) }),
      }) as any,
      startSession: async () => session as any,
    });

    await expect(runner(operation)).resolves.toBe("committed");
    expect(operation).toHaveBeenCalledOnce();
    expect(session.endSession).toHaveBeenCalledOnce();
  });
});

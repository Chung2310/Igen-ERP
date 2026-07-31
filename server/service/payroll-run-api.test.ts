import { describe, expect, it } from "vitest";
import { calculateRun } from "./payroll-run-calculation.service";

describe("calculateRun", () => {
  it("rejects a stale run version before creating a revision", async () => {
    const result = await calculateRun({
      run: { get: async () => ({ id: "run-1", status: "attendance_locked", version: 3 }) },
      revision: { nextRevision: async () => 1, create: async () => { throw new Error("must not create"); }, update: async () => undefined },
      input: async () => { throw new Error("must not load"); },
      expectedVersion: 2,
    });

    expect(result).toEqual({ code: "PAYROLL_VERSION_CONFLICT", currentVersion: 3 });
  });

  it("replays the existing result for the same idempotency key", async () => {
    const result = await calculateRun({
      idempotencyKey: "key-1",
      run: { get: async () => ({ id: "run-1", status: "calculated", version: 3 }) },
      idempotency: { get: async () => ({ result: { id: "revision-1", status: "completed" } }), save: async () => { throw new Error("must not save"); } },
      revision: { nextRevision: async () => { throw new Error("must not create"); }, create: async () => { throw new Error("must not create"); }, update: async () => undefined },
      input: async () => { throw new Error("must not load"); },
      expectedVersion: 3,
    });
    expect(result).toEqual({ id: "revision-1", status: "completed" });
  });
  it("marks the revision failed and does not activate when input loading fails", async () => {
    const updates: any[] = [];
    let activated = false;
    const result = await calculateRun({
      run: { get: async () => ({ id: "run-1", status: "attendance_locked", version: 1 }), activateRevision: async () => { activated = true; } },
      revision: { nextRevision: async () => 1, create: async (value: any) => ({ id: "revision-1", ...value }), update: async (_id: string, value: any) => { updates.push(value); return value; } },
      input: async () => { throw new Error("missing payroll policy"); },
      expectedVersion: 1,
    });
    expect(result).toEqual(expect.objectContaining({ code: "PAYROLL_CALCULATION_FAILED" }));
    expect(updates.at(-1)).toEqual(expect.objectContaining({ status: "failed" }));
    expect(activated).toBe(false);
  });});

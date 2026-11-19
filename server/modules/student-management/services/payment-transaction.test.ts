import { afterEach, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { runStudentPaymentTransaction } from "./payment-transaction";
afterEach(() => vi.restoreAllMocks());
it("keeps a known committed result when session cleanup fails", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const session = { withTransaction: async (work: () => Promise<unknown>) => work(), endSession: async () => { throw new Error("cleanup unavailable"); } };
  vi.spyOn(mongoose, "startSession").mockResolvedValue(session as any);
  await expect(runStudentPaymentTransaction(async () => ({ receipt: "saved" }))).resolves.toEqual({ receipt: "saved" });
});
it("does not run a non-atomic fallback on a standalone server", async () => {
  const work = vi.fn();
  vi.spyOn(mongoose, "startSession").mockResolvedValue({ withTransaction: async () => { throw Object.assign(new Error("unsupported"), { code: 20 }); }, endSession: async () => {} } as any);
  await expect(runStudentPaymentTransaction(work)).rejects.toMatchObject({ status: 503 });
  expect(work).not.toHaveBeenCalled();
});

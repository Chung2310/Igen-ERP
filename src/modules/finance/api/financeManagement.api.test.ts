import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../../services/authService", () => ({ getAccessToken: () => "test" }));
import { financeManagement } from "./financeManagement.api";
afterEach(() => vi.unstubAllGlobals());
it("shows the actionable transaction configuration error", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ code: "FINANCE_TRANSACTIONS_REQUIRED", message: "Configure MongoDB replica set" }) }));
  await expect(financeManagement("/vouchers", {})).rejects.toThrow("Configure MongoDB replica set");
});
it("does not expose arbitrary server failures", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ message: "private database error" }) }));
  await expect(financeManagement("/vouchers", {})).rejects.not.toThrow("private database error");
});

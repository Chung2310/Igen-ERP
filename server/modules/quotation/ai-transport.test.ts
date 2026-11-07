import { afterEach, describe, expect, it, vi } from "vitest";
const ledger = vi.hoisted(() => ({ available: vi.fn(), bill: vi.fn() }));
vi.mock("../../service/ai-usage.service", () => ({ aiSubscriptionService: { available: ledger.available }, withAiUsage: (_context: unknown, action: () => unknown) => action(), billAiCall: ledger.bill }));
import { quotationContexts, quotationScopeId, type QuotationContext } from "./context";
import { quotationFetch, runQuotationAi } from "./ai-transport";
const scope = (allowed = true): QuotationContext => ({ companyCode: "QA", branchId: "branch-a", scopeId: quotationScopeId("QA", "branch-a"), actorId: "qa", actorName: "QA", companyName: "QA", companyEmail: "qa@example.test", user: { id: "qa", email: "qa@example.test", name: "QA", role: "user", companyId: "scope" }, permissions: new Set(allowed ? ["quotation-ai:manage"] : ["quotation:read"]) });
describe("quotation AI uses the ERP ledger", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
  it("rejects missing capabilities before contacting the provider", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await quotationContexts.run(scope(false), async () => { await expect(quotationFetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", body: "{}" })).rejects.toMatchObject({ statusCode: 403 }); });
    expect(fetch).not.toHaveBeenCalled(); expect(ledger.bill).not.toHaveBeenCalled();
  });
  it("bills chat and direct document model operations but not file uploads or downloads", async () => {
    ledger.bill.mockImplementation((_kind, _model, action) => action());
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('{"ok":true}'))); vi.stubGlobal("fetch", fetch);
    await quotationContexts.run(scope(), async () => {
      await runQuotationAi("customer_suggest", async () => {
        await quotationFetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", body: JSON.stringify({ model: "qa-model" }) });
        await quotationFetch("https://openrouter.ai/api/v1/responses", { method: "POST", body: JSON.stringify({ model: "qa-document" }) });
        await quotationFetch("https://openrouter.ai/api/v1/files", { method: "POST" });
      });
    });
    expect(ledger.available).toHaveBeenCalledWith("QA", 1, "qa");
    expect(ledger.bill).toHaveBeenCalledTimes(2);
    expect(ledger.bill.mock.calls.map(call => call.slice(0, 2))).toEqual([["quotation.customer_suggest", "qa-model"], ["quotation.customer_suggest", "qa-document"]]);
  });
  it("checks available quota before executing an AI workflow", async () => {
    ledger.available.mockRejectedValueOnce(Object.assign(new Error("Hết lượt"), { statusCode: 402 }));
    const action = vi.fn();
    await quotationContexts.run(scope(), async () => { await expect(runQuotationAi("test", action)).rejects.toMatchObject({ statusCode: 402 }); });
    expect(action).not.toHaveBeenCalled();
  });
  it("preserves provider rejection details after releasing a failed billable operation", async () => {
    ledger.bill.mockImplementation((_kind, _model, action) => action());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"error":{"message":"Insufficient credits"}}', { status: 402 })));
    await quotationContexts.run(scope(), async () => {
      const response = await quotationFetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", body: "{}" });
      expect(response.status).toBe(402);
      expect((await response.json()).error.message).toBe("Insufficient credits");
    });
  });
});

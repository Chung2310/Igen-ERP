import { aiSubscriptionService, billAiCall, withAiUsage } from "../../service/ai-usage.service";
import { assertQuotationPermission, quotationContexts, quotationContext } from "./context";
import { connectDatabase } from "./db";

/** Sandbox cleanup is platform overhead, separate from the user's AI allowance. */
export async function runQuotationMaintenance<T>(work: () => Promise<T>): Promise<T> {
  const context = quotationContexts.getStore();
  if (!context) return work();
  let succeeded = false;
  try {
    const result = await quotationContexts.run({ ...context, aiMaintenance: true }, work);
    succeeded = true;
    return result;
  } finally {
    try { await (await connectDatabase()).collection("auditLogs").insertOne({ companyId: context.scopeId, actorId: context.actorId, action: "ai_sandbox_cleanup", succeeded, createdAt: new Date() }); } catch { /* Cleanup must not change the business operation's result. */ }
  }
}

export async function runQuotationAi<T>(kind: string, work: () => Promise<T>): Promise<T> {
  const context = quotationContext();
  assertQuotationPermission("quotation-ai:manage");
  await aiSubscriptionService.available(context.companyCode, 1, context.actorId);
  return quotationContexts.run({ ...context, aiKind: kind }, work);
}

/** Meter provider operations, not downloads or retries of ledger writes. Unit fixtures may inject fetch without a request scope. */
export async function quotationFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const context = quotationContexts.getStore();
  if (!context || url.hostname !== "openrouter.ai" || !/\/v1\/(?:chat\/completions|responses)$/.test(url.pathname)) return globalThis.fetch(input, init);
  assertQuotationPermission("quotation-ai:manage");
  if (context.aiMaintenance) return globalThis.fetch(input, init);
  let model = "";
  try { model = JSON.parse(typeof init?.body === "string" ? init.body : "{}").model || ""; } catch { /* Provider validation handles malformed JSON. */ }
  return withAiUsage({ companyCode: context.companyCode, userId: context.actorId }, async () => {
    let rejectedResponse: Response | undefined;
    try {
      return await billAiCall(`quotation.${context.aiKind || "document"}`, model, async () => {
        const response = await globalThis.fetch(input, init);
        if (!response.ok) {
          rejectedResponse = response;
          throw Object.assign(new Error(`Dịch vụ AI báo giá tạm thời không khả dụng (HTTP ${response.status}).`), { statusCode: 502 });
        }
        // Read inside the billable operation, including a possible stream failure.
        const body = await response.arrayBuffer();
        return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
      });
    } catch (error) {
      // Release the hold on a rejected call while preserving provider status/body for the engine's retry policy.
      if (rejectedResponse) return rejectedResponse;
      throw error;
    }
  });
}

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { defaultWorkflow, operationById } from "../../catalog";
import { assistantFunctionKey } from "../../function-context";
export interface Ledger { capUSD: number; maxRequests: number; spentUSD: number; reservedUSD: number; stopReason?: string; calls: any[]; }
export const resumeRun = process.env.ASSISTANT_WORKER_LIVE_RESUME === "1";
export const previousRun = resumeRun ? JSON.parse(readFileSync(new URL('./live-observations.json', import.meta.url), 'utf8')) : null;
if (previousRun && previousRun.ledger.stopReason !== 'COST_RESERVE_LIMIT') throw new Error('Resume is allowed only for a known unspent cost-reserve stop');
const capUSD = Number(process.env.ASSISTANT_WORKER_LIVE_CAP_USD || 1);
if (!Number.isFinite(capUSD) || capUSD <= 0 || capUSD > 1) throw new Error('Invalid live evaluation cost cap');
export const ledger: Ledger = { capUSD, maxRequests: 100, spentUSD: previousRun?.ledger.spentUSD || 0, reservedUSD: 0, calls: previousRun?.ledger.calls || [] };
// Provider max_price is denominated in USD per million tokens, enforced remotely.
// Explicit cache mode without cache_control markers avoids separate cache-write charges.
export const pricingGuard = { prompt: 0.2, completion: 0.75, cacheMode: 'explicit-no-markers' };
let inputRate = 0, outputRate = 0;
export const dryRun = process.env.ASSISTANT_WORKER_LIVE_DRY_RUN === "1";
export const replayRun = process.env.ASSISTANT_WORKER_LIVE_REPLAY === "1";
const replaySource = replayRun ? JSON.parse(readFileSync(process.env.ASSISTANT_WORKER_LIVE_REPLAY_INPUT || new URL("./live-observations.json", import.meta.url), "utf8")) : null;
const replayPositions = new Map<string, number>();
export const safety = (globalThis as any).__workerPreviewSafety;
const secret = process.env.OPENROUTER_API_KEY || "";
export const sanitize = (value: string) => secret ? value.split(secret).join("[redacted]") : value;
export async function providerPreflight() {
  if (dryRun || replayRun) return;
  if (!secret) throw new Error("No provider key; no inference sent");
  const response = await safety.nativeFetch("https://openrouter.ai/api/v1/models/openai/gpt-6-luna/endpoints", { signal: AbortSignal.timeout(20000) });
  const metadata = await response.json();
  if (!response.ok || metadata.data?.id !== "openai/gpt-6-luna") throw new Error("Model metadata unavailable");
  const tiers = metadata.data.endpoints.flatMap((e: any) => [e.pricing, ...(e.pricing.overrides || [])]);
  inputRate = Math.max(...tiers.flatMap((p: any) => [Number(p.prompt || 0), Number(p.input_cache_write || 0)]));
  outputRate = Math.max(...tiers.map((p: any) => Number(p.completion || 0)));
  if (!Number.isFinite(inputRate) || inputRate <= 0 || !Number.isFinite(outputRate) || outputRate <= 0) throw new Error("Cannot reserve inference cost");
  inputRate = Math.min(inputRate, pricingGuard.prompt / 1_000_000);
  outputRate = Math.min(outputRate, pricingGuard.completion / 1_000_000);
}
export async function providerFetch(input: string, init: RequestInit, caseId: string, scripted: Record<string, unknown>, persist: () => void, requestText: string): Promise<Response> {
  if (String(input) !== "https://openrouter.ai/api/v1/chat/completions" || init.method !== "POST") throw new Error("Unexpected provider endpoint");
  if (ledger.calls.length >= ledger.maxRequests) ledger.stopReason ||= "REQUEST_COUNT_LIMIT";
  if (ledger.stopReason) throw new Error("LIVE_AI_STOP_LIMIT");
  const body = JSON.parse(String(init.body));
  if (body.model !== "openai/gpt-6-luna" || body.tools) throw new Error("Unexpected model/tool");
  body.max_tokens = Math.min(body.max_tokens || 4096, 4096);
  if (JSON.stringify(body.messages).includes('cache_control')) throw new Error('Unexpected cache markers outside price guard');
  body.provider = { only: ["openai"], allow_fallbacks: false, max_price: { prompt: pricingGuard.prompt, completion: pricingGuard.completion } };
  body.prompt_cache_options = { mode: "explicit" };
  const wire = JSON.stringify(body);
  const reserved = (Buffer.byteLength(wire) + 2048) * inputRate + body.max_tokens * outputRate;
  if (!dryRun && ledger.spentUSD + ledger.reservedUSD + reserved > ledger.capUSD) { ledger.stopReason = "COST_RESERVE_LIMIT"; throw new Error(ledger.stopReason); }
  const prompt = body.messages[0].content;
  const schemaMarker = 'Respond ONLY with a valid JSON object matching this schema (no markdown, no explanation):\n';
  let schema = body.response_format?.json_schema?.schema;
  if (!schema && prompt.includes(schemaMarker)) {
    try { schema = JSON.parse(prompt.slice(prompt.lastIndexOf(schemaMarker) + schemaMarker.length)); } catch { /* trace falls back to prompt markers */ }
  }
  const stage = prompt.startsWith('BƯỚC 1') || schema?.properties?.modules ? "discovery" : prompt.startsWith('BƯỚC 2') || schema?.properties?.featureKeys ? "function-selection"
    : schema?.properties?.actionIds ? "capability-check" : schema?.properties?.summary ? "synthesis"
    : prompt.includes("Bạn chỉ biên tập câu chữ") ? "rewrite" : "interpretation";
  if (replayRun) {
    const calls = replaySource.ledger.calls.filter((call: any) => call.caseId === caseId);
    const position = replayPositions.get(caseId) || 0, source = calls[position];
    if (!source || source.stage !== stage || source.status !== 200 || !source.output) throw new Error(`REPLAY_CALL_MISMATCH:${caseId}:${stage}:${position}`);
    replayPositions.set(caseId, position + 1);
    ledger.calls.push({ caseId, stage, output: source.output, replay: true, sourcePromptHash: source.sha256 }); persist();
    return Response.json({ model: "openai/gpt-6-luna", choices: [{ message: { content: JSON.stringify(source.output) }, finish_reason: "stop" }], usage: { cost: 0 } });
  }
  const trace: any = { caseId, stage, bytes: Buffer.byteLength(wire), sha256: createHash("sha256").update(wire).digest("hex"), reservedUSD: reserved };
  ledger.calls.push(trace); ledger.reservedUSD += reserved; persist();
  if (dryRun) {
    const scriptedIds = typeof scripted.actionId==='string' ? [scripted.actionId] : Array.isArray(scripted.queryPlan) ? scripted.queryPlan.map((query:any)=>query.actionId) : [];
    const operation = scriptedIds.length ? operationById(scriptedIds[0]) : undefined;
    const feature = operation && assistantFunctionKey(defaultWorkflow(operation));
    const keys = schema?.properties?.featureKeys?.items?.enum || [];
    const result = stage === "discovery" ? { modules: operation ? [operation.module] : ["worker", "hr"] }
      : stage === "function-selection" ? caseId === 'C01' ? { featureKeys: [], ambiguous: true, clarification: 'Dự án thuộc Nhân sự hay quản lý lao động?' }
        : { featureKeys: caseId === 'L11' ? keys.filter((key: string) => ['worker:workers', 'worker:labor'].includes(key)) : keys.includes(feature) ? [feature] : keys.slice(0, 1), ambiguous: false, clarification: "" }
      : stage === "capability-check" ? { actionIds: scriptedIds.filter((id:string)=>schema?.properties?.actionIds?.items?.enum?.includes(id)) } : stage === "rewrite" ? { reply: "" }
      : { ...scripted, actionIntent: scripted.actionIntent || operation?.assistantMetadata?.intent || "unknown", requestCoverage: scripted.requestCoverage || [{ evidence: requestText, requirement: "Fixture plumbing only", mappedTo: ["action", ...Object.keys(scripted.values || {}).map(key => `values.${key}`)] }] };
    trace.output = result; ledger.reservedUSD -= reserved;
    return Response.json({ model: body.model, choices: [{ message: { content: JSON.stringify(result) }, finish_reason: "stop" }], usage: { cost: 0 } });
  }
  const started = Date.now();
  try {
    const response = await safety.nativeFetch(input, { ...init, body: wire, signal: AbortSignal.any([...(init.signal ? [init.signal] : []), AbortSignal.timeout(stage === "interpretation" ? 85_000 : 24_000)]) });
    const data = await response.clone().json();
    trace.status = response.status; trace.elapsedMs = Date.now() - started;
    trace.model = data.model; trace.provider = data.provider; trace.usage = data.usage; trace.finishReason = data.choices?.[0]?.finish_reason;
    try { trace.output = JSON.parse(data.choices?.[0]?.message?.content || "null"); } catch { trace.outputText = data.choices?.[0]?.message?.content; }
    if (typeof data.usage?.cost !== "number" || !Number.isFinite(data.usage.cost)) ledger.stopReason = "USAGE_COST_UNAVAILABLE";
    else { ledger.spentUSD += data.usage.cost; ledger.reservedUSD -= reserved; }
    if (!response.ok) { trace.error = sanitize(JSON.stringify(data.error || {})); ledger.stopReason ||= "PROVIDER_REJECTED"; }
    persist(); return response;
  } catch (error) {
    ledger.stopReason ||= "TRANSPORT_OR_USAGE_UNCERTAIN"; trace.error = sanitize(String(error)); trace.elapsedMs = Date.now() - started; persist(); throw error;
  }
}

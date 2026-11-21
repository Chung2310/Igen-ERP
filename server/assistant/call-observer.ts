import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";

type Phase = "prepare" | "execute" | "unknown";
type Purpose = "primary" | "reference" | "verification" | "unknown";
type Classification = "pure_read" | "mutation" | "unreviewed";
export interface ObservedAssistantCall {
  call: number;
  parentCall: number | null;
  logicalStep: number | null;
  ownerAction: string;
  actualAction: string;
  phase: Phase;
  purpose: Purpose;
  method: string;
  classification: Classification;
  attempt: number;
  status: number | null;
  outcome: "response" | "transport_error";
  durationMs: number;
}
export interface AssistantCallObservation {
  version: 1;
  operationInvocations: number;
  fetchInvocations: number;
  readFetches: number;
  mutationFetches: number;
  unreviewedFetches: number;
  responsesReceived: number;
  transportErrors: number;
  chargedReads: number;
  chargedWrites: number;
  logicalSteps: number;
  unknownOwners: number;
  unknownPurposes: number;
  droppedEvents: number;
  durationMs: number;
  events: ObservedAssistantCall[];
}
type Sink = (observation: AssistantCallObservation) => void | Promise<void>;
interface Frame {
  summary: AssistantCallObservation;
  startedAt: number;
  owner: string;
  phase: Phase;
  purpose: Purpose;
  logicalStep: number | null;
  operationCall: number | null;
  parentCall: number | null;
  attempt: number;
}
const context = new AsyncLocalStorage<Frame>();
const EVENT_LIMIT = 256;
const reviewedPureReads = new Set(["product.list", "inventory.product.detail"]);
const metadataAction = (action: string) => /^[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+$/.test(action) && action.length <= 128 ? action : "unknown";
const bestEffort = (work: () => void) => { try { work(); } catch { /* New telemetry must never affect business execution. */ } };

export function assistantCallObservationEnabled() {
  return ["test", "development"].includes(process.env.NODE_ENV || "")
    && process.env.ASSISTANT_CALL_OBSERVATION === "true";
}

// One bounded summary per turn; no payloads, URLs, record/user/request IDs, DB writes or provider calls.
export function observeAssistantTurn<T>(work: () => Promise<T>, sink: Sink = summary => {
  console.info("[assistant-call-observation]", JSON.stringify(summary));
}): Promise<T> {
  if (!assistantCallObservationEnabled() || context.getStore()) return work();
  const summary: AssistantCallObservation = {
    version: 1, operationInvocations: 0, fetchInvocations: 0, readFetches: 0,
    mutationFetches: 0, unreviewedFetches: 0, responsesReceived: 0, transportErrors: 0,
    chargedReads: 0, chargedWrites: 0, logicalSteps: 0, unknownOwners: 0,
    unknownPurposes: 0, droppedEvents: 0, durationMs: 0, events: [],
  };
  return context.run({ summary, startedAt: performance.now(), owner: "unknown", phase: "unknown",
    purpose: "unknown", logicalStep: null, operationCall: null, parentCall: null, attempt: 0 }, async () => {
    try { return await work(); }
    finally {
      bestEffort(() => {
        summary.durationMs = performance.now() - context.getStore()!.startedAt;
        const result = sink(summary);
        if (result) void Promise.resolve(result).catch(() => {});
      });
    }
  });
}

export function observeAssistantOwner<T>(action: string, phase: Phase, work: () => Promise<T>): Promise<T> {
  const frame = context.getStore();
  if (!frame) return work();
  const owner = metadataAction(action);
  const logicalStep = frame.owner === owner && frame.logicalStep !== null
    ? frame.logicalStep : ++frame.summary.logicalSteps;
  return context.run({ ...frame, owner, logicalStep, phase, purpose: phase === "prepare" ? "reference" : "verification" }, work);
}

export function observeAssistantDispatch<T>(work: () => Promise<T>): Promise<T> {
  const frame = context.getStore();
  return frame ? context.run({ ...frame, purpose: "primary" }, work) : work();
}

export function observeAssistantOperation<T>(work: () => Promise<T>): Promise<T> {
  const frame = context.getStore();
  if (!frame) return work();
  return context.run({ ...frame, operationCall: ++frame.summary.operationInvocations,
    parentCall: frame.operationCall, attempt: 0 }, work);
}

// This copies the existing budget charge after it succeeds; it never calls or changes the budget.
export function observeAssistantBudgetCharge(readOnly: boolean) {
  const frame = context.getStore();
  if (frame) bestEffort(() => { if (readOnly) frame.summary.chargedReads++; else frame.summary.chargedWrites++; });
}

export async function observeAssistantFetch(
  operation: { id: string; method: string; readOnly?: boolean }, send: () => Promise<Response>,
): Promise<Response> {
  const frame = context.getStore();
  if (!frame) return send();
  let event: ObservedAssistantCall | undefined;
  const started = performance.now();
  bestEffort(() => {
    const summary = frame.summary;
    summary.fetchInvocations++;
    const actualAction = metadataAction(operation.id);
    const method = operation.method;
    const classification: Classification = method === "GET" && reviewedPureReads.has(actualAction)
      ? "pure_read" : method !== "GET" && !operation.readOnly ? "mutation" : "unreviewed";
    if (method === "GET") summary.readFetches++;
    if (classification === "mutation") summary.mutationFetches++;
    if (classification === "unreviewed") summary.unreviewedFetches++;
    const purpose = frame.purpose === "primary" && frame.owner !== actualAction ? "unknown" : frame.purpose;
    if (frame.owner === "unknown") summary.unknownOwners++;
    if (purpose === "unknown") summary.unknownPurposes++;
    event = { call: frame.operationCall || summary.operationInvocations, parentCall: frame.parentCall,
      logicalStep: frame.logicalStep, ownerAction: frame.owner, actualAction, phase: frame.phase, purpose,
      method, classification, attempt: ++frame.attempt, status: null, outcome: "transport_error", durationMs: 0 };
  });
  try {
    const response = await send();
    bestEffort(() => { frame.summary.responsesReceived++; if (event) { event.status = response.status; event.outcome = "response"; } });
    return response;
  } catch (error) {
    bestEffort(() => { frame.summary.transportErrors++; });
    throw error;
  } finally {
    bestEffort(() => {
      if (!event) return;
      event.durationMs = performance.now() - started;
      if (frame.summary.events.length < EVENT_LIMIT) frame.summary.events.push(event);
      else frame.summary.droppedEvents++;
    });
  }
}

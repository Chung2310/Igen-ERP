import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { AssistantOperation } from "./catalog";
import type { AssistantValue } from "../../src/shared/assistant-workflow";
import { assertOperation, currentWorkflow } from "./workflows";
import { AssistantTurnModel } from "./models";
import { AssistantError } from "./policy";
import { PlanCancelledError, PlanStoppedError, executionFingerprint } from "./execution-budget";
import { observeAssistantFetch } from "./call-observer";
import { assistantSafeExecutionEnabled, assertAssistantExecutionActive, withAssistantRequestControl } from "./execution-control";

type Phase = "prepare" | "execute";
type Purpose = "primary" | "reference" | "verification";
type Status = "prepared" | "sent" | "succeeded" | "rejected" | "failed" | "cancelled" | "timed_out";
export interface BusinessCallEntryV1 {
  callId: string;
  parentCallId?: string;
  stepRequestId: string;
  ownerActionId: string;
  actionId: string;
  phase: Phase;
  purpose: Purpose;
  executionClass: "pure_read";
  workflowVersion: number;
  inputFingerprint: string;
  status: Status;
  httpStatus?: number;
  startedAt: string;
  finishedAt?: string;
}
export interface BusinessCallJournalV1 { version: 1; accounting: "legacy_primary"; calls: BusinessCallEntryV1[]; }
const statuses = new Set<Status>(["prepared", "sent", "succeeded", "rejected", "failed", "cancelled", "timed_out"]);
export function readBusinessCallJournal(value: unknown): BusinessCallJournalV1 {
  if (value === undefined || value === null) return { version: 1, accounting: "legacy_primary", calls: [] };
  const journal = value as BusinessCallJournalV1;
  if (journal.version !== 1 || journal.accounting !== "legacy_primary" || !Array.isArray(journal.calls)
    || journal.calls.some(call => !call || typeof call.callId !== "string" || !statuses.has(call.status))) {
    throw new AssistantError("Phiên bản nhật ký chưa được hỗ trợ. Chưa gửi yêu cầu nghiệp vụ.", 409);
  }
  return structuredClone(journal);
}
interface Turn {
  scope: { userId: string; companyCode: string; branchId: string };
  conversationId: string;
  requestId: string;
  journal?: BusinessCallJournalV1;
  journalLoad?: Promise<void>;
  writes: Promise<void>;
  failed?: Error;
}
interface Frame {
  turn: Turn;
  ownerActionId?: string;
  stepRequestId?: string;
  phase?: Phase;
  workflowVersion?: number;
  primary?: boolean;
  callId?: string;
  parentCallId?: string;
}
const calls = new AsyncLocalStorage<Frame>();
const allowlist = new Map([
  ["product.list", "/inventory/catalog/products"],
  ["inventory.product.detail", "/inventory/catalog/products/:id"],
]);
const requestScope = (req: AuthenticatedRequest) => ({ userId: String(req.user?.id || ""), companyCode: String(req.user?.companyCode || ""), branchId: String(req.user?.branchId || "") });
export function withBusinessCallTurn<T>(req: AuthenticatedRequest, input: { conversationId: string; requestId: string }, background: boolean, work: () => Promise<T>): Promise<T> {
  if (!assistantSafeExecutionEnabled() || background) return work();
  return calls.run({ turn: { scope: requestScope(req), conversationId: input.conversationId, requestId: input.requestId, writes: Promise.resolve() } }, work);
}
export function withBusinessCallOwner<T>(ownerActionId: string, phase: Phase, stepRequestId: string, work: () => Promise<T>): Promise<T> {
  const frame = calls.getStore();
  return frame ? calls.run({ turn: frame.turn, ownerActionId, phase, stepRequestId }, work) : work();
}
export function pinBusinessWorkflowVersion(version: number) {
  const frame = calls.getStore();
  if (frame) frame.workflowVersion = version;
}
export function withBusinessPrimary<T>(work: () => Promise<T>): Promise<T> {
  const frame = calls.getStore();
  return frame ? calls.run({ ...frame, primary: true }, work) : work();
}
export function withBusinessOperation<T>(work: () => Promise<T>): Promise<T> {
  const frame = calls.getStore();
  return frame ? calls.run({ ...frame, callId: randomUUID(), parentCallId: frame.callId }, work) : work();
}
const filterOf = (turn: Turn) => ({ ...turn.scope, conversationId: turn.conversationId, requestId: turn.requestId });
async function persist(turn: Turn) {
  if (turn.failed) throw turn.failed;
  const snapshot = structuredClone(turn.journal);
  turn.writes = turn.writes.then(async () => {
    const result = await AssistantTurnModel.updateOne(filterOf(turn), { $set: { businessCallJournal: snapshot } });
    if (result.matchedCount !== 1) throw new Error("Journal turn not found");
  });
  try { await turn.writes; }
  catch {
    turn.failed = new AssistantError("Chưa lưu được nhật ký xử lý. Bạn thử lại sau nhé.", 503);
    throw turn.failed;
  }
}

/** The only send callback is the native fetch below; callers cannot supply arbitrary transport code. */
export async function businessCallFetch(req: AuthenticatedRequest, op: AssistantOperation, input: Record<string, AssistantValue>, url: URL, init: RequestInit): Promise<Response> {
  const frame = calls.getStore();
  if (!frame?.ownerActionId || !allowlist.has(frame.ownerActionId)) return observeAssistantFetch(op, () => fetch(url, { ...init, signal: init.signal || AbortSignal.timeout(45_000) }));
  const turn = frame.turn;
  if (turn.failed) throw turn.failed;
  await assertAssistantExecutionActive();
  const scope = requestScope(req);
  if (!scope.userId || !scope.companyCode || JSON.stringify(scope) !== JSON.stringify(turn.scope)) throw new AssistantError("Phạm vi xử lý đã thay đổi. Chưa gửi yêu cầu nghiệp vụ.", 409);
  if (op.method !== "GET" || allowlist.get(op.id) !== op.path || init.method !== "GET") throw new AssistantError("Lời gọi chưa nằm trong phạm vi cổng đọc đã được kiểm tra.", 409);
  const host = req.socket.localAddress === "::1" ? "[::1]" : "127.0.0.1";
  const path = op.id === "product.list" ? op.path : op.path.replace(":id", encodeURIComponent(String(input.path_id || "")));
  if (url.origin !== `http://${host}:${req.socket.localPort}` || url.pathname !== `/api/v1${path}`
    || url.searchParams.getAll("companyCode").length !== 1 || url.searchParams.get("companyCode") !== scope.companyCode
    || init.redirect !== "error" || url.username || url.password || url.hash) throw new AssistantError("Đích API không hợp lệ. Chưa gửi yêu cầu nghiệp vụ.", 409);
  const validateAuthority = async () => {
    if (turn.failed) throw turn.failed;
    await assertAssistantExecutionActive();
    await assertOperation(req, frame.ownerActionId!);
    if (op.id !== frame.ownerActionId) await assertOperation(req, op.id);
    const workflow = await currentWorkflow(req, frame.ownerActionId!);
    if (!workflow.enabled || frame.workflowVersion === undefined || workflow.version !== frame.workflowVersion) throw new AssistantError("Quy tắc xử lý đã thay đổi. Bạn gửi lại yêu cầu để kiểm tra nhé.", 409);
    if (JSON.stringify(requestScope(req)) !== JSON.stringify(turn.scope)) throw new AssistantError("Phạm vi xử lý đã thay đổi. Chưa gửi yêu cầu nghiệp vụ.", 409);
    if (turn.failed) throw turn.failed;
    return workflow;
  };
  const workflow = await validateAuthority();
  if (!turn.journal) {
    turn.journalLoad ??= (async () => {
      const stored = await AssistantTurnModel.findOne(filterOf(turn)).select("businessCallJournal").lean();
      if (!stored) throw new AssistantError("Chưa tìm thấy nhật ký của yêu cầu. Chưa gửi API nghiệp vụ.", 409);
      turn.journal = readBusinessCallJournal((stored as { businessCallJournal?: unknown }).businessCallJournal);
    })();
    await turn.journalLoad;
  }
  const entry: BusinessCallEntryV1 = {
    callId: frame.callId || randomUUID(), ...(frame.parentCallId ? { parentCallId: frame.parentCallId } : {}),
    stepRequestId: frame.stepRequestId || turn.requestId, ownerActionId: frame.ownerActionId, actionId: op.id, phase: frame.phase || "execute",
    purpose: frame.primary && op.id === frame.ownerActionId ? "primary" : frame.phase === "prepare" ? "reference" : "verification",
    executionClass: "pure_read", workflowVersion: workflow.version,
    inputFingerprint: executionFingerprint(op.id, input),
    status: "prepared", startedAt: new Date().toISOString(),
  };
  turn.journal!.calls.push(entry);
  await persist(turn);
  try {
    await assertAssistantExecutionActive();
    entry.status = "sent";
    await persist(turn);
    await validateAuthority();
    const result = await withAssistantRequestControl(45_000, async signal => {
      if (turn.failed) throw turn.failed;
      const merged = signal && init.signal ? AbortSignal.any([signal, init.signal]) : signal || init.signal;
      const response = await observeAssistantFetch(op, () => fetch(url, { ...init, signal: merged }));
      const envelope = await response.clone().json().catch(() => null);
      return { response, envelope };
    });
    entry.httpStatus = result.response.status;
    const envelope = result.envelope;
    if (result.response.ok && envelope?.status !== "error" && envelope?.success !== false
      && (!envelope || typeof envelope !== "object" || Array.isArray(envelope)
        || !envelope.data || typeof envelope.data !== "object" || Array.isArray(envelope.data)
        || (op.id === "product.list" && !Array.isArray(envelope.data.items)))) {
      throw new AssistantError("API chưa trả dữ liệu hợp lệ. Chưa thể kết luận kết quả tra cứu.", 502);
    }
    entry.status = result.response.status >= 500 ? "failed"
      : !result.response.ok || envelope?.status === "error" || envelope?.success === false ? "rejected" : "succeeded";
    entry.finishedAt = new Date().toISOString();
    await persist(turn);
    return result.response;
  } catch (error) {
    if (turn.failed) throw turn.failed;
    entry.status = error instanceof PlanCancelledError ? "cancelled" : error instanceof PlanStoppedError ? "timed_out" : "failed";
    entry.finishedAt = new Date().toISOString();
    await persist(turn);
    throw error;
  }
}

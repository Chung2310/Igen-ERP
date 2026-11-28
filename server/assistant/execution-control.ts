import { AsyncLocalStorage } from "node:async_hooks";
import { PlanCancelledError, PlanStoppedError } from "./execution-budget";
import { AssistantError } from "./policy";

export interface AssistantExecutionControl {
  deadlineAt: number;
  cancelled?: () => Promise<boolean>;
  signal?: AbortSignal;
}
interface ExecutionFrame extends AssistantExecutionControl { stopped?: Error; abort: AbortController; }
const execution = new AsyncLocalStorage<ExecutionFrame>();

export function assistantSafeExecutionEnabled() {
  return ["test", "development"].includes(process.env.NODE_ENV || "")
    && process.env.ASSISTANT_SAFE_EXECUTION === "true";
}
export function withAssistantExecution<T>(control: AssistantExecutionControl, work: () => Promise<T>): Promise<T> {
  if (assistantSafeExecutionEnabled() && !Number.isFinite(control.deadlineAt)) return Promise.reject(new AssistantError("Thời hạn xử lý không hợp lệ.", 503));
  return assistantSafeExecutionEnabled() ? execution.run({ ...control, abort: new AbortController() }, work) : work();
}
/** Interpretation is read-only. Its deadline must abort outstanding provider
 * requests even when the experimental business execution gate is disabled. */
export function withAssistantInterpretationControl<T>(work:()=>Promise<T>,timeoutMs=90_000):Promise<T>{
 if(execution.getStore())return withAssistantRequestControl(timeoutMs,()=>work());
 return execution.run({deadlineAt:Date.now()+timeoutMs,abort:new AbortController()},()=>withAssistantRequestControl(timeoutMs,()=>work()));
}
/** Optional wording may time out without invalidating a completed business
 * result. Inherit cancellation/deadline, but keep the local stop isolated. */
export function withAssistantOptionalAIControl<T>(work:()=>Promise<T>,timeoutMs=8_000):Promise<T>{
 const parent=execution.getStore();
 return execution.run({deadlineAt:Math.min(parent?.deadlineAt??Infinity,Date.now()+timeoutMs),abort:new AbortController(),
  ...(parent?{signal:AbortSignal.any([parent.abort.signal,...(parent.signal?[parent.signal]:[])]),cancelled:parent.cancelled}:{})},
  ()=>withAssistantRequestControl(timeoutMs,()=>work()));
}
export async function assertAssistantExecutionActive() {
  const frame = execution.getStore();
  if (!frame) return;
  if (frame.stopped) throw frame.stopped;
  if (frame.signal?.aborted) frame.stopped = new PlanCancelledError("Đã dừng theo yêu cầu. Các bước đã hoàn tất được giữ nguyên.");
  else if (Date.now() >= frame.deadlineAt) frame.stopped = new PlanStoppedError("Đã hết thời gian xử lý. Các bước đã hoàn tất được giữ nguyên.");
  else if (frame.cancelled) {
    try { if (await frame.cancelled()) frame.stopped = new PlanCancelledError("Đã dừng theo yêu cầu. Các bước đã hoàn tất được giữ nguyên."); }
    catch { frame.stopped = new AssistantError("Chưa kiểm tra được trạng thái hủy. Bạn thử lại sau nhé.", 503); }
  }
  if (!frame.stopped && frame.signal?.aborted) frame.stopped = new PlanCancelledError("Đã dừng theo yêu cầu. Các bước đã hoàn tất được giữ nguyên.");
  if (!frame.stopped && Date.now() >= frame.deadlineAt) frame.stopped = new PlanStoppedError("Đã hết thời gian xử lý. Các bước đã hoàn tất được giữ nguyên.");
  if (frame.stopped) { frame.abort.abort(frame.stopped); throw frame.stopped; }
}

/** Native requests receive an abort signal; a terminal cancellation also stops later retries/fallbacks. */
export async function withAssistantRequestControl<T>(timeoutMs: number, work: (signal?: AbortSignal) => Promise<T>): Promise<T> {
  const frame = execution.getStore();
  if (!frame) return work();
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new AssistantError("Thời hạn yêu cầu không hợp lệ.", 400);
  await assertAssistantExecutionActive();
  const controller = new AbortController();
  let disposed = false;
  let rejectAbort: (error: Error) => void;
  const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
  const stop = (error: Error) => {
    if (disposed) return;
    frame.stopped ??= error;
    controller.abort(frame.stopped);
    rejectAbort(frame.stopped);
    frame.abort.abort(frame.stopped);
  };
  const cancelled = () => stop(new PlanCancelledError("Đã dừng theo yêu cầu. Các bước đã hoàn tất được giữ nguyên."));
  frame.signal?.addEventListener("abort", cancelled, { once: true });
  const terminal = () => stop(frame.stopped!);
  frame.abort.signal.addEventListener("abort", terminal, { once: true });
  const end = Math.min(frame.deadlineAt, Date.now() + timeoutMs);
  const timer = setTimeout(() => stop(new PlanStoppedError("Đã hết thời gian chờ yêu cầu. Các bước đã hoàn tất được giữ nguyên.")), Math.max(0, end - Date.now()));
  let checking = false;
  const poll = frame.cancelled ? setInterval(async () => {
    if (checking || controller.signal.aborted) return;
    checking = true;
    try { if (await frame.cancelled!()) cancelled(); }
    catch { stop(new AssistantError("Chưa kiểm tra được trạng thái hủy. Bạn thử lại sau nhé.", 503)); }
    finally { checking = false; }
  }, 250) : undefined;
  try {
    if (frame.signal?.aborted) cancelled();
    if (frame.abort.signal.aborted) terminal();
    if (Date.now() >= end) stop(new PlanStoppedError("Đã hết thời gian chờ yêu cầu. Các bước đã hoàn tất được giữ nguyên."));
    return await Promise.race([aborted, Promise.resolve().then(() => {
      if (controller.signal.aborted) throw frame.stopped;
      return work(controller.signal);
    })]);
  } finally {
    disposed = true;
    clearTimeout(timer);
    if (poll) clearInterval(poll);
    frame.signal?.removeEventListener("abort", cancelled);
    frame.abort.signal.removeEventListener("abort", terminal);
  }
}

/** Bind direct request disconnects without cancelling background jobs or changing intake. */
export async function withAssistantResponseCancellation<T>(
  response: { writableEnded: boolean; destroyed?: boolean; once: (event: "close", listener: () => void) => unknown; off: (event: "close", listener: () => void) => unknown },
  work: (signal?: AbortSignal) => Promise<T>,
): Promise<T> {
  if (!assistantSafeExecutionEnabled()) return work();
  const controller = new AbortController();
  const close = () => { if (!response.writableEnded) controller.abort(); };
  response.once("close", close);
  try {
    if (response.destroyed) close();
    return await work(controller.signal);
  } finally { response.off("close", close); }
}

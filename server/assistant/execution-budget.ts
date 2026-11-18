import { createHash } from "node:crypto";
import { AssistantError } from "./policy";
export class PlanStoppedError extends AssistantError {}
export class PlanCancelledError extends PlanStoppedError {}
export function executionFingerprint(actionId: string, values: unknown): string {
  const canonical = (value: any): any => value instanceof Date ? value.toISOString() : Array.isArray(value) ? value.map(canonical)
    : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  return createHash("sha256").update(JSON.stringify([actionId, canonical(values)])).digest("hex");
}
export class ExecutionBudget {
  readonly deadline: number;
  private reads = 0;
  private writes = 0;
  private plans = 0;
  private mutations = new Set<string>();
  private readResults = new Set<string>();
  stoppedForNoProgress = false;
  constructor(background = false, private now = Date.now) { this.deadline = now() + (background ? 8 * 60_000 : 90_000); }
  canContinue() { return this.now() < this.deadline && this.plans < 24 && !this.stoppedForNoProgress; }
  plan() {
    if (!this.canContinue()) throw new PlanStoppedError("Đã tạm dừng để giữ phần việc còn lại trong ngân sách xử lý.");
    this.plans++;
  }
  beforeCall(actionId: string, values: unknown, readOnly: boolean) {
    if (this.now() >= this.deadline) throw new PlanStoppedError("Đã hết thời gian xử lý của lượt này; phần việc còn lại được giữ.");
    if (readOnly ? this.reads >= 24 : this.writes >= 3) throw new PlanStoppedError("Đã tạm dừng tại giới hạn thao tác của lượt này; phần việc còn lại được giữ.");
    const key = executionFingerprint(actionId, values);
    if (!readOnly && this.mutations.has(key)) throw new PlanStoppedError("Đã dừng thao tác ghi lặp lại để tránh thay đổi dữ liệu hai lần.");
    if (readOnly) this.reads++; else { this.writes++; this.mutations.add(key); }
    return key;
  }
  afterRead(key: string, result: unknown) {
    const fingerprint = executionFingerprint(key, result);
    if (this.readResults.has(fingerprint)) this.stoppedForNoProgress = true;
    this.readResults.add(fingerprint);
  }
}

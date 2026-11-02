import { randomUUID } from "node:crypto";
import { calculatePayrollChecksum } from "./payroll-checksum.service";
import { PAYROLL_RECONCILIATION_FIELDS, type PayrollReconciliation, type PayrollReconciliationField, type PayrollReconciliationSnapshot } from "../../src/shared/payrollReconciliation";

export const reconciliationError = (message: string, status = 409) => Object.assign(new Error(message), { status, code: "PAYROLL_RECONCILIATION_BLOCKED" });
export function reconciliationValues(line: any): PayrollReconciliationSnapshot["values"] {
  const values = { ...(line.effectiveValues ?? {}), net: line.net ?? line.calculation?.net ?? 0 };
  const segments = line.segmentLines?.length ? line.segmentLines : [line];
  values.workedMinutes = segments.reduce((sum: number, item: any) => sum + Number(item.calculation?.workedMinutes ?? item.attendance?.workedMinutes ?? 0), 0);
  values.commission = line.effectiveValues?.commission ?? segments.reduce((sum: number, item: any) => sum + Number(item.calculation?.commission ?? 0), 0);
  return Object.fromEntries(PAYROLL_RECONCILIATION_FIELDS.map(({ key }) => [key, Number(values[key] ?? 0)])) as PayrollReconciliationSnapshot["values"];
}
export const reconciliationChecksum = (line: any) => calculatePayrollChecksum(reconciliationValues(line));
export function publishReconciliation(record: PayrollReconciliation | undefined, identity: Pick<PayrollReconciliation, "runId" | "employeeId" | "employeeName" | "periodKey">, line: any, actorId: string, now = new Date().toISOString()): PayrollReconciliation {
  const values = reconciliationValues(line);
  const checksum = calculatePayrollChecksum(values);
  if (record?.snapshot.checksum === checksum) return record;
  const snapshot = { values, checksum, publishedAt: now, publishedBy: actorId };
  return {
    ...identity, version: (record?.version ?? 0) + 1, snapshot,
    publications: [...(record?.publications ?? []), snapshot], issues: structuredClone(record?.issues ?? []),
    confirmations: structuredClone(record?.confirmations ?? []),
  };
}
type Actor = { id: string; name: string; role: "employee" | "staff" };
export type ReconciliationAction = { action: "confirm" | "dispute" | "reply" | "resolve"; field?: PayrollReconciliationField; issueId?: string; body?: string };
export function applyReconciliationAction(record: PayrollReconciliation, action: ReconciliationAction, actor: Actor, now = new Date().toISOString()): PayrollReconciliation {
  const next = structuredClone(record);
  next.version += 1;
  if (action.action === "confirm") {
    if (actor.role !== "employee") throw reconciliationError("Chỉ nhân viên được xác nhận bảng lương của mình.", 403);
    if (next.issues.some(issue => issue.status === "open")) throw reconciliationError("Còn khiếu nại chưa được giải quyết.");
    next.confirmedChecksum = next.snapshot.checksum;
    next.confirmedAt = now;
    next.confirmations.push({ checksum: next.snapshot.checksum, at: now, actorId: actor.id });
    return next;
  }
  const body = typeof action.body === "string" ? action.body.trim() : "";
  if (!body || body.length > 4000) throw reconciliationError("Nội dung phải từ 1 đến 4.000 ký tự.", 400);
  const message = { id: randomUUID(), authorId: actor.id, authorName: actor.name, role: actor.role, body, at: now };
  if (action.action === "dispute") {
    if (actor.role !== "employee") throw reconciliationError("Chỉ nhân viên được gửi khiếu nại.", 403);
    if (!PAYROLL_RECONCILIATION_FIELDS.some(field => field.key === action.field)) throw reconciliationError("Khoản lương không hợp lệ.", 400);
    if (next.issues.some(issue => issue.field === action.field && issue.status === "open")) throw reconciliationError("Khoản này đang có khiếu nại; hãy trả lời trong cuộc trao đổi hiện có.");
    next.issues.push({ id: randomUUID(), field: action.field!, status: "open", snapshotChecksum: next.snapshot.checksum, messages: [{ ...message, action: "question" }] });
    delete next.confirmedChecksum;
    delete next.confirmedAt;
  } else {
    const issue = next.issues.find(item => item.id === action.issueId);
    if (!issue) throw reconciliationError("Không tìm thấy khiếu nại.", 404);
    if (issue.status !== "open") throw reconciliationError("Khiếu nại đã giải quyết. Có thể gửi khiếu nại mới nếu cần.");
    if (action.action === "resolve") {
      if (actor.role !== "staff") throw reconciliationError("Chỉ kế toán được đánh dấu đã giải quyết.", 403);
      issue.status = "resolved";
    } else if (action.action !== "reply") throw reconciliationError("Thao tác không hợp lệ.", 400);
    issue.messages.push({ ...message, action: action.action });
  }
  return next;
}
export function assertReconciliationReady(lines: any[], records: PayrollReconciliation[]) {
  for (const line of lines) {
    const record = records.find(item => item.employeeId === String(line.employeeId));
    if (!record) throw reconciliationError("Cần phát hành bảng tạm tính cho tất cả nhân viên trước khi chốt.");
    if (record.issues.some(issue => issue.status === "open")) throw reconciliationError("Còn khiếu nại chưa được giải quyết.");
    if (record.snapshot.checksum !== reconciliationChecksum(line)) throw reconciliationError("Bảng lương đã thay đổi. Hãy phát hành lại và chờ nhân viên xác nhận.");
    if (record.confirmedChecksum !== record.snapshot.checksum) throw reconciliationError("Còn nhân viên chưa xác nhận bản lương mới nhất.");
  }
  if (records.some(record => record.issues.some(issue => issue.status === "open"))) throw reconciliationError("Còn khiếu nại của nhân viên đã bị bỏ khỏi kỳ lương.");
}

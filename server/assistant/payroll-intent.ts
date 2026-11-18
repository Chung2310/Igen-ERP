import type { AssistantWorkflow } from "../../src/shared/assistant-workflow";
import type { AssistantInterpretation } from "./interpreter";

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();

/** Vietnamese amounts, including attached units; never guess a missing amount. */
export function payrollAmount(text: string): number | undefined {
  const match = [...normalize(text).matchAll(/\b(?:thanh|len|xuong|la|con(?:\s+muc)?)\s+(-?\d[\d.,]*)\s*(trieu|tr|nghin|ngan|k|vnd|dong)?\b/g)].at(-1);
  if (!match) return undefined;
  const raw = match[1];
  const grouped = /^\d{1,3}(?:[.,]\d{3})+$/.test(raw);
  const number = Number(grouped ? raw.replace(/[.,]/g, "") : raw.replace(",", "."));
  const amount = number * (/^(trieu|tr)$/.test(match[2] || "") ? 1_000_000 : /^(nghin|ngan|k)$/.test(match[2] || "") ? 1000 : 1);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : undefined;
}

function periodFromRequest(text: string): string | undefined {
  const explicit = text.match(/\b(?:ky(?:\s+luong)?|thang)\s+(?:(\d{4})-(\d{1,2})|(\d{1,2})\s*(?:\/|nam\s+)(\d{4}))\b/);
  if (explicit) {
    const month = Number(explicit[2] || explicit[3]);
    return month >= 1 && month <= 12 ? `${explicit[1] || explicit[4]}-${String(month).padStart(2, "0")}` : undefined;
  }
  const relative = text.match(/\bthang (nay|truoc|qua|vua roi)\b/);
  const local = new Date(Date.now() + 7 * 60 * 60 * 1000);
  if (!relative) {
    const monthOnly = text.match(/\bthang\s+(0?[1-9]|1[0-2])\b/);
    if (!monthOnly) return undefined;
    return `${local.getUTCFullYear()}-${String(Number(monthOnly[1])).padStart(2, "0")}`;
  }
  const date = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - (relative[1] === "nay" ? 0 : 1), 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function directPayrollRequest(text: string, workflows: AssistantWorkflow[], pending: unknown, messages: { role: string; content: string }[] = []): AssistantInterpretation | null {
  const lastAssistant = [...messages].reverse().find(message => message.role === "assistant");
  const lastQuestion = normalize(lastAssistant?.content || "");
  if (!pending && /\?/.test(lastQuestion) && /\b(?:nhan vien|nhan su)\b/.test(lastQuestion)
    && /\bchinh sach\b/.test(lastQuestion) && /\bluong co ban\b/.test(lastQuestion)
    && /^(?:chinh sach(?: luong)?|nhan vien|nhan su)\s+\S/.test(normalize(text))) {
    const original = [...messages].reverse().find(message => message.role === "user" && /\bluong co ban\b/.test(normalize(message.content)));
    const amount = original && payrollAmount(original.content);
    if (amount !== undefined) return directPayrollRequest(`Cập nhật lương cơ bản của ${text} lên ${amount}`, workflows, null);
  }
  const intent = normalize(text).trim();
  const previous = pending as { actionId?: string; values?: Record<string, unknown> } | null;
  const available = (id: string) => workflows.some(workflow => workflow.enabled && workflow.actionId === id);
  const finish = (actionId: string, values: Record<string, unknown>, continuing = false): AssistantInterpretation | null => available(actionId)
    ? { actionId, values, intentType: "workflow", ...(pending ? { newRequest: !continuing } : {}) } : null;
  const period = periodFromRequest(intent);
  const run = period ? { path_id: period } : {};
  if (period && /^(?:ky|thang)\b/.test(intent) && previous?.actionId
    && ["payroll.run.complaints.list", "payroll.run.reconciliation.publish", "payroll.adjustment.list"].includes(previous.actionId)) {
    return finish(previous.actionId, previous.actionId === "payroll.adjustment.list" ? { path_periodKey: period } : run, true);
  }
  // A payroll phrase inside a process step is the step's name, not a payroll action.
  if (/\b(?:quy trinh|quy tinh|buoc con)\b/.test(intent)) return null;
  if (previous?.actionId === "payroll.reconciliation.schedule.update" && /^(?:lap\s+)?(?:hang|moi) thang[.! ]*$/.test(intent)) {
    return finish(previous.actionId, { recurrence: "monthly" }, true);
  }
  const change = /\b(?:doi|thay doi|cap nhat|sua|chinh sua|dieu chinh)\b/.test(intent);
  if (change && /\blich\b/.test(intent) && /\bphat hanh\b/.test(intent) && /\bluong\b/.test(intent)) {
    const day = intent.match(/\bngay\s+(\d{1,2})\b/);
    const time = intent.match(/\b(?:luc\s+)?(\d{1,2})\s*(?:gio\b|h(?![a-z])|:)\s*(\d{1,2})?\s*(?:phut)?\s*(sang|chieu|toi)?/);
    const hour = time ? Number(time[1]) + (Number(time[1]) < 12 && /^(chieu|toi)$/.test(time[3] || "") ? 12 : 0) : undefined;
    const explicitDate = /\bngay\s+\d{1,2}\s*(?:\/|-|thang\s+)\s*\d{1,2}\b/.test(intent);
    return finish("payroll.reconciliation.schedule.update", {
      ...(day ? { day: Number(day[1]) } : {}),
      ...(time ? { hour, minute: Number(time[2] || 0) } : {}),
      ...(!explicitDate || /\b(?:hang|moi) thang\b/.test(intent) ? { recurrence: "monthly" } : {}),
    });
  }
  if (/\bkhieu nai\b/.test(intent) && /\bluong\b/.test(intent) && !/\b(?:gui khieu nai|tao khieu nai|phan hoi|xu ly|giai quyet|xoa)\b/.test(intent)) {
    return finish("payroll.run.complaints.list", run);
  }
  if (/\bphat hanh\b/.test(intent) && /\b(?:luong tam tinh|luong de doi soat)\b/.test(intent) && !/\blich\b/.test(intent)) {
    return finish("payroll.run.reconciliation.publish", run);
  }
  if (/\bkhoan\b/.test(intent) && /\bcho duyet\b/.test(intent) && !/\b(?:phieu chi|phieu thu|don hang)\b/.test(intent)) {
    return finish("payroll.adjustment.list", { ...(period ? { path_periodKey: period } : {}), status: "pending" });
  }
  if (change && /\bchinh sach luong\b/.test(intent) && /\bthanh\b/.test(intent) && !/\bluong co ban\b/.test(intent)) {
    const match = text.match(/chính sách lương\s*(.*?)\s+thành\s+(.+?)[.!?]*$/iu)
      || text.match(/chinh sach luong\s*(.*?)\s+thanh\s+(.+?)[.!?]*$/iu);
    if (match) return finish("payroll.policy.update", { ...(match[1].trim() ? { path_id: match[1].trim() } : {}), name: match[2].trim() });
  }
  if (change && /\bluong co ban\b/.test(intent)) {
    const amount = payrollAmount(text);
    const employee = text.match(/(?:của|cua|cho)\s+(?:(?:nhân sự|nhan su|nhân viên|nhan vien)\s+)?(.+?)\s+(?:thành|thanh|lên|len|xuống|xuong|là|la|còn|con)\s+\d/iu);
    const policy = text.match(/(?:chính sách|chinh sach)(?:\s+(?:lương|luong))?\s+(.+?)\s+(?:thành|thanh|lên|len|xuống|xuong|là|la|còn|con)\s+\d/iu);
    if (policy) return finish("payroll.policy.update", { path_id: policy[1].trim(), ...(amount !== undefined ? { baseSalary: amount } : {}) });
    if (employee) return finish("employee.update", { id: employee[1].trim(), ...(amount !== undefined ? { monthlySalary: amount } : {}) });
    if (previous?.actionId === "payroll.policy.update" || previous?.actionId === "employee.update") {
      return finish(previous.actionId, amount !== undefined ? { [previous.actionId === "employee.update" ? "monthlySalary" : "baseSalary"]: amount } : {}, true);
    }
    if (/\bchinh sach\b/.test(intent)) return finish("payroll.policy.update", amount !== undefined ? { baseSalary: amount } : {});
    return { actionId: null, values: {}, intentType: "ambiguous", suggestedActionIds: ["employee.update", "payroll.policy.update"].filter(available) };
  }
  return null;
}

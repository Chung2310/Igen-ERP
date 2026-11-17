import { randomUUID } from "node:crypto";
import { AssistantError } from "./policy";

type WorkflowStep = Record<string, any> & { title: string; subTasks?: Array<Record<string, any>> };

function snapshotFrom(input: Record<string, unknown>) {
  try {
    const snapshot = JSON.parse(String(input.__assistantExistingRecord || ""));
    if (!snapshot || typeof snapshot !== "object" || !Array.isArray(snapshot.steps)) throw new Error("invalid workflow snapshot");
    return snapshot as { steps: WorkflowStep[] };
  } catch {
    throw new AssistantError("Không đọc được các bước hiện tại của quy trình; chưa cập nhật để tránh mất dữ liệu.");
  }
}

function updateEntry(step: WorkflowStep) {
  return { existingTitle: step.title, title: step.title };
}

export function applyWorkWorkflowMutation(body: Record<string, unknown>, input: Record<string, unknown>) {
  if (input.workflowAction === undefined) return;
  if (body.steps !== undefined) throw new AssistantError("Không thể kết hợp thao tác bước nhanh với một danh sách bước khác.");

  const workflow = snapshotFrom(input);
  const steps = workflow.steps;
  const action = String(input.workflowAction || "").trim();
  const target = String(input.workflowTarget || "").trim();
  const value = String(input.workflowValue || "").trim();
  const matches = (title: string) => steps.flatMap((step, index) => normalize(String(step?.title || "")) === normalize(title) ? [index] : []);

  if (action === "Thêm bước") {
    if (!value) throw new AssistantError("Cần nêu tên bước mới.");
    if (value.length > 120) throw new AssistantError("Tên bước tối đa 120 ký tự.");
    if (steps.length >= 30) throw new AssistantError("Quy trình đã đạt giới hạn 30 bước.");
    if (matches(value).length) throw new AssistantError(`Bước “${value}” đã có trong quy trình.`);
    body.steps = [...steps.map(updateEntry), { title: value }];
    return;
  }

  if (action === "Gỡ bước") {
    if (!target) throw new AssistantError("Cần nêu tên bước cần gỡ.");
    const found = matches(target);
    if (found.length !== 1) throw new AssistantError(found.length ? `Có nhiều bước trùng tên “${target}”; chưa gỡ bước.` : `Không tìm thấy bước “${target}” trong quy trình.`);
    if (steps.length <= 1) throw new AssistantError("Quy trình cần giữ ít nhất một bước.");
    body.steps = steps.filter((_step, index) => index !== found[0]).map(updateEntry);
    return;
  }

  if (action === "Thêm giai đoạn con") {
    if (!target || !value) throw new AssistantError("Cần nêu bước cha và tên giai đoạn con.");
    if (value.length > 120) throw new AssistantError("Tên giai đoạn con tối đa 120 ký tự.");
    const found = matches(target);
    if (found.length !== 1) throw new AssistantError(found.length ? `Có nhiều bước trùng tên “${target}”; chưa thêm giai đoạn con.` : `Không tìm thấy bước “${target}” trong quy trình.`);
    const parent = steps[found[0]];
    const subTasks = Array.isArray(parent.subTasks) ? parent.subTasks : [];
    if (subTasks.some(task => normalize(String(task?.title || "")) === normalize(value))) {
      throw new AssistantError(`Giai đoạn con “${value}” đã có trong bước “${target}”.`);
    }
    body.steps = steps.map((step, index) => index === found[0]
      ? { ...updateEntry(step), subTasks: [...subTasks, { id: randomUUID(), title: value, assigneeUid: "", assignee: "", done: false }] }
      : updateEntry(step));
    return;
  }

  throw new AssistantError("Thao tác quy trình không hợp lệ.");
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLocaleLowerCase("vi-VN").replace(/\s+/g, " ").trim();
}

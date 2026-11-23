import { describe, expect, it, vi, afterEach } from "vitest";
import { clarificationModuleIds, createModuleChoice, createWorkflowChoice, resolveModuleChoice, resolveWorkflowChoice, missingInputFields, validateFormValues } from "./collection-form";
import { defaultWorkflow, operationById } from "./catalog";
afterEach(() => vi.useRealTimers());
const workflow = defaultWorkflow(operationById("worker.project.create")!);
describe("server-owned assistant collection", () => {
  it('pins module options server-side, filters unavailable modules and rejects stale or forged choices', () => {
    vi.useFakeTimers();
    const available = [workflow, defaultWorkflow(operationById('project.create')!)];
    expect(clarificationModuleIds('Dự án Nhân sự hay dự án lao động?', available).sort()).toEqual(['hr', 'worker']);
    const choice = createModuleChoice(available, ['hr', 'worker', 'foreign'], 'Tạo dự án QA', null)!;
    expect(choice.selection.kind).toBe('module');
    expect(choice.selection.options).toHaveLength(2);
    expect(JSON.stringify(choice.selection)).not.toContain('project.create');
    const selection = { id: choice.selection.id, value: choice.selection.options[0].value };
    expect(resolveModuleChoice(choice.state, selection, null).module).toBe('hr');
    expect(() => resolveWorkflowChoice(choice.state, selection, null)).toThrow('đúng loại');
    expect(() => resolveModuleChoice(choice.state, { ...selection, value: 'worker' }, null)).toThrow('không hợp lệ');
    expect(() => resolveModuleChoice(choice.state, selection, 'new-pending')).toThrow('hết hiệu lực');
    vi.advanceTimersByTime(15 * 60_000);
    expect(() => resolveModuleChoice(choice.state, selection, null)).toThrow('hết hiệu lực');
  });
  it("does not expose defaults or repeat already supplied fields", () => {
    const fields = missingInputFields(workflow, ["Mã dự án"], [], { name: "VINSCON20" }, []);
    expect(fields).toEqual([{ key: "code", label: "Mã dự án", type: "text", required: true }]);
    expect(fields.some(field => field.key === "status")).toBe(false);
  });
  it("keeps explicit invalid input and its validation error", () => {
    const fields = missingInputFields(workflow, [], ["Chỉ tiêu: không hợp lệ"], { quota: -1 }, []);
    expect(fields).toMatchObject([{ key: "quota", value: -1, error: "Chỉ tiêu: không hợp lệ" }]);
  });
  it("does not render credentials or duplicate reference/enum controls", () => {
    const fields = missingInputFields({ ...workflow, fields: [
      { key: "secret", label: "Bí mật", type: "text", required: true },
      { key: "branch", label: "Chi nhánh", type: "reference", reference: "branch.list" },
      { key: "status", label: "Trạng thái", type: "text", options: ["active"] },
    ] }, ["Bí mật", "Chi nhánh", "Trạng thái"], [], {}, []);
    expect(fields).toEqual([]);
  });
  it("accepts only advertised scalar fields", () => {
    const fields = missingInputFields(workflow, ["Mã dự án"], [], {}, []);
    expect(validateFormValues(fields, { code: "P20" })).toEqual({ code: "P20" });
    expect(() => validateFormValues(fields, { name: "X" })).toThrow("không còn được yêu cầu");
  });
  it("pins permitted action choices privately and rejects foreign or expired selections", () => {
    vi.useFakeTimers();
    const created = createWorkflowChoice([workflow, { ...workflow, actionId: "disabled", enabled: false }], ["disabled", "foreign", workflow.actionId], "Tạo dự án X", null)!;
    expect(created.selection.options).toHaveLength(1);
    expect(JSON.stringify(created.selection)).not.toContain(workflow.actionId);
    const selected = { id: created.selection.id, value: created.selection.options[0].value };
    expect(resolveWorkflowChoice(created.state, selected, null)).toMatchObject({ actionId: workflow.actionId, intent: "Tạo dự án X" });
    expect(() => resolveWorkflowChoice(created.state, { ...selected, value: "foreign" }, null)).toThrow("hết hiệu lực");
    expect(() => resolveWorkflowChoice(created.state, selected, "a-new-pending")).toThrow("hết hiệu lực");
    vi.advanceTimersByTime(15 * 60_000);
    expect(() => resolveWorkflowChoice(created.state, selected, null)).toThrow("hết hiệu lực");
  });
});

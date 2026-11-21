import { describe, expect, it, vi, afterEach } from "vitest";
const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));
import { explicitAssistantModules, assertAssistantModuleScope } from "./module-scope";
import { interpretRequest } from "./semantic-interpreter";
import { defaultWorkflow, operationById } from "./catalog";
import { createWorkflowChoice } from "./collection-form";
afterEach(() => provider.mockReset());
const projectActions = ["project.create", "project.update", "project.delete", "project.list", "worker.project.create", "worker.project.update", "worker.project.delete", "worker.project.list"].map(id => defaultWorkflow(operationById(id)!));
describe("distinct HR and labor project namespaces", () => {
  it.each([
    ["Tạo 1 dự án mới tên VINSCON20 trong mục quản lí lao động", ["worker"]],
    ["tao du an vinscon20 quan li lao dong", ["worker"]],
    ["Tạo dự án trong module lao động", ["worker"]],
    ["Sửa dự án lao động X", ["worker"]],
    ["Tạo dự án X trong phân hệ Nhân sự", ["hr"]],
    ["Xóa dự án nhân sự X", ["hr"]],
    ["Không phải Nhân sự, tạo dự án X trong Quản lý lao động", ["worker"]],
    ['Tạo hồ sơ tên "Quản lý lao động" trong Nhân sự', ["hr"]],
    ["Xem sản phẩm Quản lý lao động", []],
    ["Tạo dự án tên Quản lý lao động", []],
    ["Tra cứu trong phân hệ Đối tác lao động", ["labor-partner"]],
    ["Tra cứu trong phân hệ Đối tác bán lẻ", ["retail-partner"]],
    ["Tạo dự án X", []],
    ["Tạo dự án ở Nhân sự và xem danh sách trong Quản lý lao động", ["hr", "worker"]],
  ])("recognizes only explicitly named module scopes: %s", (text, modules) => {
    expect(explicitAssistantModules(text as string)).toEqual(modules);
  });
  it.each([
    ["worker.project.create", "Tạo dự án X trong quản lí lao động", { name: "X" }],
    ["worker.project.update", "Sửa dự án X trong quản lý lao động", { path_id: "X", location: "Hà Nội" }],
    ["worker.project.delete", "Xóa dự án X trong quản lý lao động", { path_id: "X" }],
    ["project.create", "Tạo dự án X trong Nhân sự", { name: "X" }],
    ["project.update", "Sửa dự án X trong Nhân sự", { id: "X", name: "Y" }],
    ["project.delete", "Xóa dự án X trong Nhân sự", { id: "X" }],
  ] satisfies Array<[string, string, Record<string, unknown>]>) ("scopes the tool catalog before inference: %s", async (id, text, values) => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: id, values, intentType: "workflow" }) });
    const result = await interpretRequest(text, projectActions, null, []);
    expect(result.actionId, JSON.stringify(result)).toBe(id);
    const prompt = provider.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain(`"actionId":"${id}"`);
    expect(prompt).not.toContain(`"actionId":"${id.startsWith("worker.") ? "project.create" : "worker.project.create"}"`);
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it("asks for the project namespace instead of defaulting to HR", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: "project.create", values: { name: "X" }, intentType: "workflow" }) });
    expect(await interpretRequest("Tạo dự án X", projectActions, null, [])).toMatchObject({ actionId: null, intentType: "ambiguous", suggestedActionIds: ["project.create", "worker.project.create"] });
  });
  it("does not route into HR when labor workflows are unavailable", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: "project.create", values: { name: "X" }, intentType: "workflow" }) });
    const result = await interpretRequest("Tạo dự án X trong Quản lý lao động", projectActions.filter(workflow => workflow.module === "hr"), null, []);
    expect(result).toMatchObject({ actionId: null, intentType: "ambiguous", values: {} });
    expect(result.clarification).toContain("chưa có thao tác trợ lý khả dụng trong Quản lý lao động");
    expect(result.suggestedActionIds).toBeUndefined();
  });
  it("rejects a model choice from the wrong namespace even if that action exists globally", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: "project.create", values: { name: "X" }, intentType: "workflow" }) });
    await expect(interpretRequest("Tạo dự án X trong quản lý lao động", projectActions, null, [])).rejects.toThrow("không khớp");
  });
  it("keeps workflow options module-qualified and refuses a wrong-module option", () => {
    const choice = createWorkflowChoice(projectActions, ["project.create", "worker.project.create"], "Tạo dự án X", null)!;
    expect(choice.selection.options.map(option => option.label)).toEqual(["Tạo dự án — Nhân sự", "Tạo dự án lao động — Quản lý lao động"]);
    const scoped = createWorkflowChoice(projectActions, ["project.create", "worker.project.create"], "Tạo dự án X trong quản lý lao động", null)!;
    expect(scoped.state.options.map(option => option.actionId)).toEqual(["worker.project.create"]);
  });
  it("validates previously prepared operations again before dispatch", () => {
    expect(() => assertAssistantModuleScope({ module: "hr" }, "Tạo dự án X trong quản lý lao động")).toThrow("không khớp");
    expect(() => assertAssistantModuleScope({ module: "worker" }, "Tạo dự án X trong nhân sự")).toThrow("không khớp");
    expect(() => assertAssistantModuleScope({ module: "worker" }, "Tạo dự án X trong quản lý lao động")).not.toThrow();
  });
});

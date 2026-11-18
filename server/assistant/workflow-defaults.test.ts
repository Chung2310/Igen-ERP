import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ records: [] as any[] }));
vi.mock("../middleware/auth", () => ({ getEffectivePermissions: async () => new Set(["*"]) }));
vi.mock("../middleware/require-module", () => ({ getModuleStateForCompany: async () => ({ modules: {}, exists: true }), resolveModuleAccess: () => true }));
vi.mock("./models", () => ({ ensureAssistantIndexes: async () => {}, AssistantWorkflowModel: {
  find: () => ({ select: () => ({ lean: async () => state.records }), lean: async () => state.records }), bulkWrite: async () => {},
} }));
import { listWorkflows } from "./workflows";
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from "./catalog";
import { collectValues } from "./policy";

it("keeps persisted null defaults absent when updating only a course title", async () => {
  const config = defaultWorkflow(operationById("training.update")!);
  state.records = [{ actionId: config.actionId, version: 0, config: { ...config, fields: config.fields.map(f => ({ ...f, defaultValue: null })) } }];
  const workflows = await listWorkflows({ user: { id: "actor", companyCode: "TEST", role: "admin" } } as any);
  const workflow = workflows.find(w => w.actionId === config.actionId)!;
  const result = collectValues(workflow, { id: "Course", title: "New title" });
  expect(result.errors).toEqual([]);
  expect(result.missing).toEqual([]);
  expect(result.values).toEqual({ id: "Course", title: "New title" });
});

it("does not turn omitted JSON settings into null payloads in any module", async () => {
  const operations = ASSISTANT_OPERATIONS.filter(op => op.fields.some(f => f.type === "json" && f.defaultValue === undefined));
  state.records = operations.map(op => {
    const config = defaultWorkflow(op);
    return { actionId: op.id, version: 0, config: { ...config, fields: config.fields.map(f => f.type === "json" && f.defaultValue === undefined ? { ...f, defaultValue: null } : f) } };
  });
  const loaded = await listWorkflows({ user: { id: "actor", companyCode: "TEST", role: "admin" } } as any);
  for (const op of operations) {
    const workflow = loaded.find(w => w.actionId === op.id);
    if (!workflow) continue; // Operations restricted to another role are not loaded.
    const expected = collectValues(defaultWorkflow(op), {});
    const actual = collectValues(workflow, {});
    expect(actual, op.id).toEqual(expected);
  }
});

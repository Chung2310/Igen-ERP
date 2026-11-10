import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { ASSISTANT_OPERATIONS, defaultWorkflow, type AssistantOperation } from "./catalog";
import { completeAssistantOperation, hasAssistantUpdatePayload, type AssistantCompletion } from "./completion";
import { formatAssistantResultTable, parseAssistantResultTable } from "../../src/shared/assistant-result-table";

const id = "507f1f77bcf86cd799439012";
function fixture(module: string, adapter?: AssistantOperation["adapter"]) {
  const create: AssistantOperation = { id: `fixture.${module}.create`, module: module as AssistantOperation["module"], title: "Tạo hồ sơ", description: "", method: "POST", path: "/fixtures", adapter,
    permissions: ["fixture:manage"], resultFields: ["name", "phone"], link: "/fixtures", confirmation: true,
    fields: [
      { key: "targetBranch", label: "Chi nhánh", source: "query", apiKey: "branchId", type: "reference", reference: "branch.list" },
      { key: "name", label: "Họ tên", type: "text", source: "body", systemRequired: true, required: true },
      { key: "phone", label: "Số điện thoại", type: "text", source: "body" },
      { key: "address", label: "Địa chỉ", type: "text", source: "body" },
    ] };
  const update: AssistantOperation = { ...create, id: create.id.replace(/create$/, "update"), method: "PATCH", path: "/fixtures/:id", fields: [
    { key: "path_id", apiKey: "id", source: "path", type: "reference", label: "Hồ sơ", reference: "fixture.list" }, ...create.fields,
  ] };
  const context: AssistantCompletion = { operation: create, workflow: defaultWorkflow(create), values: { name: "Nguyễn An", targetBranch: id }, result: { _id: id, name: "Nguyễn An", phone: "", address: "" } };
  const reply = { status: "completed" as const, reply: formatAssistantResultTable("Đã lưu hồ sơ", [{ "Họ tên": "Nguyễn An" }]), link: create.link };
  return { create, update, context, reply };
}

describe("shared completion contract", () => {
  it("does not reask optional information fulfilled by an alternative field in any module", async () => {
    const { create, update, context, reply } = fixture("future-module");
    const reference = { key: "doctorId", apiKey: "doctorId", type: "reference" as const, source: "body" as const, label: "Bác sĩ trong danh mục", alternativeField: "doctorName" };
    const externalName = { key: "doctorName", apiKey: "doctorName", type: "text" as const, source: "body" as const, label: "Tên bác sĩ ngoài danh mục", alternativeField: "doctorId" };
    create.fields.push(reference, externalName); update.fields.push(reference, externalName);
    context.workflow = defaultWorkflow(create);
    context.values.doctorName = "Bác sĩ Nguyễn Minh";
    (context.result as Record<string, unknown>).doctorName = "Bác sĩ Nguyễn Minh";
    const result = await completeAssistantOperation(reply, context, [create, update], async () => true);
    expect(result.reply).toContain("Số điện thoại");
    expect(result.reply).not.toContain("Bác sĩ trong danh mục");
    expect(result.reply).not.toContain("Tên bác sĩ ngoài danh mục");
  });
  it.each([...new Set(ASSISTANT_OPERATIONS.map(op => op.module)), "future-module"])("automatically offers optional information for %s without a module opt-in", async module => {
    for (const adapter of [undefined, "contract", "healthcare"] as const) {
      const { create, update, context, reply } = fixture(module, adapter);
      const result = await completeAssistantOperation(reply, context, [create, update], async () => true);
      expect(result.reply).toContain("Số điện thoại, Địa chỉ");
      expect(result.reply.match(/Bạn có muốn bổ sung không\?/g)).toHaveLength(1);
      expect(parseAssistantResultTable(result.reply)?.after.join(" ")).toContain("Bạn có muốn bổ sung không?");
      expect(context.followUp).toEqual({ actionId: update.id, values: { path_id: id, targetBranch: id } });
      expect(JSON.stringify(result)).not.toContain(id);
    }
  });

  it("keeps the success when follow-up is unavailable and does not ask about supplied optional values", async () => {
    const { create, update, context, reply } = fixture("future-module");
    for (const canUpdate of [async () => false, async () => { throw new Error("Permission changed"); }]) {
      expect(await completeAssistantOperation(reply, context, [create, update], canUpdate)).toBe(reply);
    }
    context.values.phone = "0901234567";
    const result = await completeAssistantOperation(reply, context, [create, update], async () => true);
    expect(result.reply).toContain("còn trống: Địa chỉ");
    expect(result.reply).not.toContain("Số điện thoại");
    context.values.address = "Hà Nội";
    expect(await completeAssistantOperation(reply, context, [create, update], async () => true)).toBe(reply);
  });

  it("does not offer creation follow-up for reads, updates, failed writes, or uncertain writes", async () => {
    const { create, update, context, reply } = fixture("future-module");
    const canUpdate = vi.fn(async () => true);
    for (const status of ["failed", "uncertain", "confirmation", "collecting"] as const) {
      const original = { ...reply, status };
      expect(await completeAssistantOperation(original, context, [create, update], canUpdate)).toBe(original);
    }
    for (const op of [{ ...create, readOnly: true }, update]) {
      expect(await completeAssistantOperation(reply, { ...context, operation: op }, [create, update], canUpdate)).toBe(reply);
    }
    expect(canUpdate).not.toHaveBeenCalled();
  });

  it("accepts standard response wrappers and tolerates unset optional defaults saved as null", async () => {
    const { create, update, context, reply } = fixture("future-module");
    context.result = { data: context.result };
    context.workflow.fields.find(field => field.key === "phone")!.defaultValue = null as any;
    const result = await completeAssistantOperation(reply, context, [create, update], async () => true);
    expect(result.reply).toContain("Số điện thoại, Địa chỉ");
  });

  it.each([undefined, "contract", "healthcare"] as const)("ignores target metadata for an empty update through %s", adapter => {
    const { update } = fixture("future-module", adapter);
    const target = { path_id: id, targetBranch: id, revision: 2, __assistantExistingRecord: "{}" };
    expect(hasAssistantUpdatePayload(update, target)).toBe(false);
    expect(hasAssistantUpdatePayload(update, { ...target, phone: "0901234567" })).toBe(true);
    const legacy = { ...update, fields: [{ key: "id", type: "reference" as const, label: "Hồ sơ" }, { key: "description", type: "text" as const, label: "Mô tả" }] };
    expect(hasAssistantUpdatePayload(legacy, { id, __assistantExistingRecord: "{}" })).toBe(false);
    expect(hasAssistantUpdatePayload(legacy, { id, description: "Mô tả mới" })).toBe(true);
  });

  it("prevents new adapter branches from bypassing dispatch and the common completion hook", () => {
    const source = ts.createSourceFile("service.ts", readFileSync(new URL("./service.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
    let execute: ts.VariableDeclaration | undefined;
    const finalizers: ts.CallExpression[] = [];
    function visit(node: ts.Node) {
      if (ts.isVariableDeclaration(node) && node.name.getText(source) === "execute") execute = node;
      if (ts.isCallExpression(node) && node.expression.getText(source) === "completeAssistantOperation") finalizers.push(node);
      ts.forEachChild(node, visit);
    }
    visit(source);
    expect(execute).toBeDefined();
    const calls: ts.CallExpression[] = [];
    function dispatchCalls(node: ts.Node) {
      if (ts.isCallExpression(node) && node.expression.getText(source) === "callOperation") calls.push(node);
      ts.forEachChild(node, dispatchCalls);
    }
    dispatchCalls(execute!);
    expect(calls).toHaveLength(1);
    let owner: ts.Node | undefined = calls[0];
    while (owner && !ts.isVariableDeclaration(owner)) owner = owner.parent;
    // The nearest declaration may be the local result; the enclosing dispatcher must own this call.
    while (owner && (!ts.isVariableDeclaration(owner) || owner.name.getText(source) !== "dispatch")) owner = owner.parent;
    expect(owner).toBeDefined();
    expect(finalizers).toHaveLength(1);
    expect(finalizers[0].getStart(source)).toBeGreaterThan(execute!.end);
    expect(readFileSync(new URL("./service.ts", import.meta.url), "utf8")).not.toContain("optionalCreateQuestion");
  });
});

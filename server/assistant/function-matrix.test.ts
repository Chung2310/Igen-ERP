import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { ASSISTANT_OPERATIONS, defaultWorkflow } from "./catalog";
import { collectValues, validateField } from "./policy";
import { interpretRequest } from "./semantic-interpreter";
import type { AssistantField } from "../../src/shared/assistant-workflow";
import { functionMatrixModules } from './testing/function-matrix-scope';

const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));
const operations = ASSISTANT_OPERATIONS.filter(op => functionMatrixModules.includes(op.module));
const evidence: any[] = [];
afterEach(() => provider.mockReset());
afterAll(() => {
  const output = process.env.ASSISTANT_FUNCTION_MATRIX_OUTPUT;
  if (!output) return;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify({ scope: "Interpretation and field validation only, not complete business execution", operations: operations.map(op => ({ id: op.id, module: op.module, title: op.title, method: op.method, path: op.path, fields: op.fields, unavailableReason:op.unavailableReason })), cases: evidence }, null, 2));
});

for (const op of operations) describe(`${op.module} / ${op.id}`, () => {
  const workflow = defaultWorkflow(op);
  if(op.unavailableReason) {
    it('rejects an unavailable legacy operation', async()=>{
      provider.mockResolvedValue({text:JSON.stringify({intentType:"workflow",actionIntent:op.assistantMetadata?.intent||"unknown",actionId:op.id,values:{},requestCoverage:[]})});
      await expect(interpretRequest(op.title,[workflow],null,[])).rejects.toThrow();
      evidence.push({operation:op.id,caseId:'unavailable-operation',status:'passed',expected:op.unavailableReason,actual:'Rejected',stage:'interpretation/validation'});
    });
    return;
  }
  const record = async (caseId: string, input: unknown, expected: string, run: () => unknown | Promise<unknown>) => {
    const row: any = { operation: op.id, caseId, input, expected, stage: "interpretation/validation" };
    try { row.actual = await run(); row.status = "passed"; }
    catch (error) { row.status = "failed"; row.error = String(error); throw error; }
    finally { evidence.push(row); }
  };
  const phrase = "Thực hiện thao tác này.";
  it.each([phrase, "Vui lòng thực hiện thao tác này.", "Làm theo thao tác này."])("accepts a mocked action without inventing supplied values: %s", async text => record("wording:" + text, { text, ai: { actionId: op.id, values: {} } }, "Preserve selected action and leave unsupplied values empty", async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ intentType: "workflow", actionId: op.id, actionIntent: op.assistantMetadata?.intent || "unknown", values: {}, requestCoverage: [{ evidence: text, requirement: "Yêu cầu thao tác", mappedTo: ["action"] }] }) });
    const result = await interpretRequest(text, [workflow], null, []);
    expect(result.actionId).toBe(op.id);
    expect(result.values).toEqual({});
    return result;
  }));
  it("honors cancellation even if AI also proposes this action", async () => record("cancel", { actionId: op.id, cancel: true }, "No executable action", async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: op.id, values: {}, cancel: true }) });
    const result = await interpretRequest("HÃ¡Â»Â§y yÃƒÂªu cÃ¡ÂºÂ§u nÃƒÂ y", [workflow], null, []);
    expect(result.actionId).toBeNull();
    expect(result.values).toEqual({});
    return result;
  }));
  it("blocks an additional condition the chosen function cannot represent", async () => record("unknown-condition", { matrixUnsupportedFilter: "must-preserve" }, "Ask rather than discard a condition", async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: op.id, values: { matrixUnsupportedFilter: "must-preserve" } }) });
    const result = await interpretRequest("ThÃ¡Â»Â±c hiÃ¡Â»â€¡n yÃƒÂªu cÃ¡ÂºÂ§u vÃ¡Â»â€ºi Ã„â€˜Ã¡ÂºÂ§y Ã„â€˜Ã¡Â»Â§ Ã„â€˜iÃ¡Â»Âu kiÃ¡Â»â€¡n tÃƒÂ´i nÃƒÂªu", [workflow], null, []);
    expect(result.actionId).toBeNull();
    return result;
  }));
  it("does not execute a malformed model response", async () => record("invalid-ai-json", "invalid JSON", "Reject response", async () => {
    provider.mockResolvedValue({ text: "not valid JSON" });
    await expect(interpretRequest(phrase, [workflow], null, [])).rejects.toThrow();
    return "Rejected";
  }));

  for (const field of op.fields) {
    const invalid = field.type === "number" ? "not-a-number" : field.type === "boolean" ? "maybe" : field.type === "json" ? "{not-json" : { unexpected: true };
    it(`rejects invalid type/structure for ${field.key}`, () => record(`invalid:${field.key}`, { [field.key]: invalid }, "Reject invalid field", () => {
      expect(() => validateField(field, invalid)).toThrow();
      return "Rejected";
    }));
    if (field.type === "date" || field.type === "datetime") {
      const value = field.type === "date" ? "2026-02-30" : "2026-02-30T08:00:00+07:00";
      it(`rejects an impossible calendar day in ${field.key}`, () => record(`calendar:${field.key}`, { [field.key]: value }, "Reject February 30", () => {
        expect(() => validateField(field, value)).toThrow();
        return "Rejected";
      }));
      const valid = field.type === "date" ? "2024-02-29" : "2024-02-29T08:00:00+07:00";
      it(`accepts a real leap day in ${field.key}`, () => record(`valid-calendar:${field.key}`, { [field.key]: valid }, "Preserve valid calendar value", () => {
        expect(validateField(field, valid)).toBe(valid);
        return valid;
      }));
    }
    if (field.type === "datetime") it.each(["2026-11-01T24:00:00Z", "2026-11-01T08:60:00Z"])(`rejects invalid clock in ${field.key}: %s`, value => record(`clock:${field.key}:${value}`, { [field.key]: value }, "Reject invalid clock without normalizing to another day", () => {
      expect(() => validateField(field, value)).toThrow();
      return "Rejected";
    }));
    if (field.options?.length) it(`rejects an unknown option for ${field.key}`, () => record(`option:${field.key}`, { [field.key]: "__unknown_option__" }, "Reject unsupported option", () => {
      expect(() => validateField(field, "__unknown_option__")).toThrow();
      return "Rejected";
    }));
    if (field.type === "number") {
      for (const [label, value] of [["nonfinite", Number.POSITIVE_INFINITY], ...(field.min === undefined ? [] : [["below-min", field.min - 1]]), ...(field.max === undefined ? [] : [["above-max", field.max + 1]]), ...(field.integer ? [["fraction", (field.min || 0) + 0.5]] : [])] as Array<[string, number]>) {
        it(`rejects ${label} for ${field.key}`, () => record(`${label}:${field.key}`, { [field.key]: String(value) }, "Reject out-of-domain number", () => {
          expect(() => validateField(field, value)).toThrow();
          return "Rejected";
        }));
      }
    }
    if ((field.required || field.systemRequired) && field.defaultValue === undefined && !field.alternativeField) it(`asks for missing required ${field.key}`, () => record(`required:${field.key}`, {}, "Required field is not silently defaulted", () => {
      const single = { ...workflow, fields: [{ ...field, requiredWhen: undefined } as AssistantField] };
      const result = collectValues(single, {});
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.values).not.toHaveProperty(field.key);
      return result;
    }));
    if (field.type === "text" && !field.pattern && !field.options && field.max && field.max > 4000) it(`accepts text within declared maximum for ${field.key}`, () => record(`text-capacity:${field.key}`, { field: field.key, length: 4001, declaredMax: field.max }, "Accept text shorter than the declared field limit", () => {
      expect(validateField(field, "A".repeat(4001))).toHaveLength(4001);
      return "Accepted";
    }));
    if (field.type === "json") it(`rejects protected nested data in ${field.key}`, () => record(`protected:${field.key}`, { [field.key]: '{"password":"mock-only"}' }, "Reject protected nested key", () => {
      expect(() => validateField(field, '{"password":"mock-only"}')).toThrow();
      return "Rejected";
    }));
  }
});

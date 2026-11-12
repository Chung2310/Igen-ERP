import { afterEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));

import { interpretRequest } from "./interpreter";
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from "./catalog";
import { completeAssistantOperation } from "./completion";
import { formatHealthcareResult } from "./healthcare-result";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";

afterEach(() => provider.mockReset());

describe("healthcare catalog assistant workflow", () => {
  const operation = operationById("healthcare.catalog.create")!;
  const workflow = defaultWorkflow(operation);

  it.each([
    ["Tạo danh mục bác sĩ mã BS-01 tên Nguyễn An", "doctor"],
    ["Thêm danh mục phòng khám", "room"],
    ["Tạo danh mục dịch vụ y tế", "service"],
  ])("routes explicit medical catalog creation and resolves its kind: %s", async (text, kind) => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {} }) });

    const result = await interpretRequest(text, [workflow], null, []);

    expect(result).toMatchObject({ actionId: "healthcare.catalog.create", intentType: "workflow", values: { kind } });
  });

  it("routes a general medical catalog request and leaves the missing kind for the assistant to ask", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {} }) });

    const result = await interpretRequest("Tạo danh mục cho module quản lý y tế", [workflow], null, []);

    expect(result).toMatchObject({ actionId: "healthcare.catalog.create", intentType: "workflow", values: {} });
    expect(operation.confirmation).toBe(true);
    expect(workflow.fields.find(field => field.key === "kind")?.required).toBe(true);
  });

  it("keeps the created catalog result in the shared table format and runs shared completion", async () => {
    const record = { kind: "doctor", code: "BS-01", name: "Nguyễn An", active: true };
    const result = formatHealthcareResult(operation, { items: [record] });
    const table = parseAssistantResultTable(result);
    const reply = { status: "completed" as const, reply: result, link: operation.link };

    expect(table?.rows[0].values).toMatchObject({ Loại: "Bác sĩ", Mã: "BS-01", Tên: "Nguyễn An", "Đang sử dụng": "Có" });
    await expect(completeAssistantOperation(reply, {
      operation,
      workflow,
      values: { kind: "doctor", code: "BS-01", name: "Nguyễn An", active: true },
      result: record,
    }, ASSISTANT_OPERATIONS, async () => true)).resolves.toEqual(reply);
  });
});

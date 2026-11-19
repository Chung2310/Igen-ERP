import { expect, it } from "vitest";
import { operationById } from "./catalog";
import { normalizeBusinessResult } from "./business-result";
import { formatFriendlyAssistantResult } from "./result-format";
import { normalizeAssistantReply } from "./general-answer";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";

it("keeps date-looking project names and formats actual timestamps in Vietnam time", () => {
  const op = operationById("architect.project.list")!;
  const data = normalizeBusinessResult(op.module, op.id, { projects: [{ name: "2026-11-18", areaM2: 100, floors: 2, style: "Hiện đại", requirements: "Sân vườn", createdAt: "2026-11-17T18:30:00.000Z", revision: 4 }] });
  const reply = formatFriendlyAssistantResult(op, data);
  const table = parseAssistantResultTable(reply)!;
  expect(Object.values(table.rows[0].values)).toContain("2026-11-18");
  expect(reply).toContain("01:30, 18/11/2026");
  expect(reply).toContain("Yêu cầu thiết kế");
  expect(reply).toContain("Ngày tạo");
  expect(reply).not.toContain("Ngày giao dịch");
  expect(reply).not.toContain("revision");
});

it("shows birthdays as calendar dates for create and update as well as lookups", () => {
  for (const id of ["employee.create", "employee.update", "employee.detail"]) {
    const reply = formatFriendlyAssistantResult(operationById(id)!, { displayName: "An", birthDate: "1995-01-01T00:00:00.000Z" });
    expect(reply).toContain("01/01/1995");
    expect(reply).not.toContain("07:00");
  }
});

it("preserves structured business citations through reply normalization", () => {
  const op = operationById("legal.document.answer")!;
  const result = normalizeBusinessResult(op.module, op.id, { query: "Câu hỏi", answer: "Xem [1].", sources: [{ citation: "[1]", title: "Văn bản", symbol: "VB-01", internalId: "hidden" }] });
  const reply = formatFriendlyAssistantResult(op, result);
  expect(normalizeAssistantReply(reply, "Tra cứu")).toBe(reply);
  expect(reply).toContain("Xem [1].");
  expect(reply).not.toContain("hidden");
});

it("distinguishes accepting synchronization from completing synchronization", () => {
  const op = operationById("legal.repository.sync")!;
  const reply = formatFriendlyAssistantResult(op, normalizeBusinessResult(op.module, op.id, { status: "accepted", message: "Đã bắt đầu đồng bộ. Kết quả sẽ hiện trong trạng thái kho." }));
  expect(reply).toContain("Đã tiếp nhận, đang xử lý");
  expect(reply).toContain("Đã bắt đầu đồng bộ");
});

import { afterEach, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));
import { applyAssistantResponseRules } from "./reply-rules";
import { presentAssistantReply } from "./reply-presentation";
import { formatAssistantResultTable, parseAssistantResultTable } from "../../src/shared/assistant-result-table";
import type { AssistantReply } from "../../src/shared/assistant-workflow";

afterEach(() => provider.mockReset());

it("adds no paid rewrite request to result tables or empty preference settings", async () => {
  const source: AssistantReply = { status: "completed", reply: formatAssistantResultTable("Đã tạo", [{ "Tên": "QA **A_B**", "Số tiền": "2.000.000 ₫" }], ["Bạn có muốn bổ sung không?"]) };
  const reply = await applyAssistantResponseRules(presentAssistantReply(source), "Tự nhiên, ngắn gọn");
  expect(parseAssistantResultTable(reply.reply)?.rows).toEqual(parseAssistantResultTable(source.reply)?.rows);
  expect(reply.reply).toContain("Bạn có muốn bổ sung không?");
  expect(await applyAssistantResponseRules({ status: "collecting", reply: "Bạn chọn lớp bên dưới nhé." }, "")).toEqual({ status: "collecting", reply: "Bạn chọn lớp bên dưới nhé." });
  expect(provider).not.toHaveBeenCalled();
});

it("uses the shared natural tone while retaining form and selection contracts", async () => {
  const source: AssistantReply = { status: "collecting", reply: "Bạn muốn chọn lớp nào?", inputForm: { id: "qa-form", fields: [] },
    workflowSelection: { id: "qa-choice", kind: "module", options: [{ value: "opaque-option", label: "Học viên" }] } };
  provider.mockResolvedValueOnce({ text: JSON.stringify({ reply: "Bạn chọn lớp cần xem nhé?" }) });
  const reply = await applyAssistantResponseRules(source, "Nói tự nhiên");
  const prompt = provider.mock.calls[0][0].messages[0].content;
  expect(prompt).toContain("đồng nghiệp");
  expect(prompt).toContain("Không bắt người dùng viết lại câu theo mẫu");
  expect(prompt).toContain("Không dùng tiêu đề Markdown");
  expect(reply.inputForm).toBe(source.inputForm);
  expect(reply.workflowSelection).toBe(source.workflowSelection);
  expect(reply.status).toBe("collecting");
});

it.each([
  "Đã thực hiện rồi.",
  "Bạn không cần xác nhận để thực hiện.",
  "Bạn xác nhận để chuyển 3000000 đồng nhé.",
])("rejects a rewrite that drops confirmation or changes the business amount: %s", revised => {
  const source: AssistantReply = { status: "confirmation", reply: "Bạn xác nhận để chuyển 2000000 đồng nhé." };
  provider.mockResolvedValueOnce({ text: JSON.stringify({ reply: revised }) });
  return expect(applyAssistantResponseRules(source, "Ngắn gọn")).resolves.toEqual(source);
});

it("keeps a safe natural server reply when the editing provider fails", async () => {
  const source: AssistantReply = { status: "collecting", reply: "Bạn chọn lớp cần xem bên dưới nhé." };
  provider.mockRejectedValueOnce(new Error("fixture provider unavailable"));
  expect(await applyAssistantResponseRules(source, "Thân thiện")).toBe(source);
});

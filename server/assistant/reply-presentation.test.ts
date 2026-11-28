import { expect, it } from "vitest";
import { presentAssistantReply } from "./reply-presentation";
import { formatAssistantResultTable, parseAssistantResultTable } from "../../src/shared/assistant-result-table";

it("preserves punctuation in business data, tables and optional follow-up questions", () => {
  const values = { "Tên": "Công ty A; B", "Ghi chú": "Đã gọi; hẹn 8:30. Mã A.01", "Website": "https://example.com/a;b?q=1.5" };
  const text = formatAssistantResultTable("Đã cập nhật", [values], ["Bạn có muốn bổ sung không?"]);
  const result = presentAssistantReply({ status: "completed", reply: text });
  expect(parseAssistantResultTable(result.reply)?.rows[0].values).toEqual(values);
  expect(result.reply).toContain("Bạn có muốn bổ sung không?");
});

it("does not rewrite source errors or code while presenting a failed reply", () => {
  const text = 'API từ chối: Mã A.01 đã tồn tại; chọn mã khác.\n```js\nconst value = 1.5;\n```';
  expect(presentAssistantReply({ status: "failed", reply: text }).reply).toBe(text);
});

it("keeps explicit values and confirmation while hiding only defaulted preview values", () => {
  const result = presentAssistantReply({ status: "confirmation", reply: "Tên: A; B\nTrạng thái: Đang hoạt động\n\nBạn kiểm tra thông tin bên dưới nhé. Nếu đã đúng, bạn xác nhận để mình thực hiện." }, ["Trạng thái"]);
  expect(result.reply).toContain("Tên: A; B");
  expect(result.reply).not.toContain("Trạng thái:");
  expect(result.reply).toContain("bạn xác nhận để mình thực hiện.");
});

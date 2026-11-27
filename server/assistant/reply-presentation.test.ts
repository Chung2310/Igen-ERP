import { expect, it } from "vitest";
import { presentAssistantReply, assistantEmptyReadResult } from "./reply-presentation";
import { formatAssistantResultTable, parseAssistantResultTable } from "../../src/shared/assistant-result-table";

it.each([
  ['Có đối tác tuyển sinh nào đã được thanh toán đủ 100% hoa hồng chưa','đối tác tuyển sinh nào đã được thanh toán đủ 100% hoa hồng'],
  ['Có học viên nào còn nợ học phí không?','học viên nào còn nợ học phí'],
  ['Có nhân sự nào chưa chấm công chưa?','nhân sự nào chưa chấm công'],
])('states an empty read as a scoped business finding: %s',(question,meaning)=>{
  const reply=assistantEmptyReadResult(question);
  expect(reply).toBe(`Hiện mình chưa thấy ${meaning} trong phạm vi đang xem.`);
  expect(presentAssistantReply({status:'completed',reply}).reply).toBe(reply);
});
it('does not repeat a pasted question or imply a second unexecuted request was checked',()=>{
  const question='Có đối tác tuyển sinh nào đã được thanh toán đủ 100% hoa hồng chưa';
  expect(assistantEmptyReadResult([question,question,question].join('\n\n'))).toBe(assistantEmptyReadResult(question));
  const unrelated=assistantEmptyReadResult('Có học viên nào nợ học phí không?\nCó nhân sự nào vắng không?');
  expect(unrelated).toBe('Mình chưa tìm thấy dữ liệu theo yêu cầu của bạn trong phạm vi đang xem.');
  expect(unrelated).not.toContain('nhân sự');
});

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

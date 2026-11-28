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

it("keeps form and selection prompts deterministic without a paid rewrite", async () => {
  const source: AssistantReply = { status: "collecting", reply: "Bạn muốn chọn lớp nào?", inputForm: { id: "qa-form", fields: [] },
    workflowSelection: { id: "qa-choice", kind: "module", options: [{ value: "opaque-option", label: "Học viên" }] } };
  provider.mockResolvedValueOnce({ text: JSON.stringify({ reply: "Bạn chọn lớp cần xem nhé?" }) });
  const reply = await applyAssistantResponseRules(source, "Nói tự nhiên");
  expect(provider).not.toHaveBeenCalled();
  expect(reply.inputForm).toBe(source.inputForm);
  expect(reply.workflowSelection).toBe(source.workflowSelection);
  expect(reply.status).toBe("collecting");
});

it('applies the shared style rule to plain prose without changing the question', async () => {
  const source: AssistantReply = { status: 'collecting', reply: 'Bạn muốn chọn lớp nào?' };
  provider.mockResolvedValueOnce({ text: JSON.stringify({ reply: 'Bạn chọn lớp nào giúp mình nhé?' }) });
  provider.mockResolvedValueOnce({text:JSON.stringify({equivalent:true})});
  const reply = await applyAssistantResponseRules(source, 'Tự nhiên, ngắn gọn');
  expect(reply.reply).toBe('Bạn chọn lớp nào giúp mình nhé?');
  const prompt = provider.mock.calls[0][0].messages[0].content;
  expect(prompt).toContain('đồng nghiệp');
  expect(prompt).toContain('Không bắt người dùng viết lại câu theo mẫu');
  expect(prompt).toContain('Không dùng tiêu đề Markdown');
});

it.each([
  'Đã tạo lớp. Bạn cần gì nữa?',
  'Bạn chọn khóa nào giúp mình nhé?',
  'Bạn chọn lớp A1 nhé?',
])('rejects style edits that change intent, fields or invent completion: %s', revised => {
  const source: AssistantReply = { status: 'collecting', reply: 'Bạn muốn chọn lớp nào?' };
  provider.mockResolvedValueOnce({ text: JSON.stringify({ reply: revised }) });
  return expect(applyAssistantResponseRules(source, 'Thân thiện')).resolves.toEqual(source);
});

it.each(['Đã cập nhật hồ sơ An.', 'Đã cập nhật hồ sơ Minh Ân.'])('keeps the exact person name during a style edit: %s', revised => {
  const source: AssistantReply = { status: 'completed', reply: 'Đã cập nhật hồ sơ Minh An.' };
  provider.mockResolvedValueOnce({ text: JSON.stringify({ reply: revised }) });
  return expect(applyAssistantResponseRules(source, 'Nói ngắn hơn')).resolves.toEqual(source);
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


it('accepts a verified natural synonym without requiring identical business words',async()=>{
 const source:AssistantReply={status:'completed',reply:'Có 3 học viên chưa thanh toán học phí.'};
 provider.mockResolvedValueOnce({text:JSON.stringify({reply:'Có 3 học viên chưa nộp học phí.'})}).mockResolvedValueOnce({text:JSON.stringify({equivalent:true})});
 expect((await applyAssistantResponseRules(source,'Tự nhiên')).reply).toBe('Có 3 học viên chưa nộp học phí.');expect(provider).toHaveBeenCalledTimes(2);
});
it('edits form prose while preserving every form, option and preview object',async()=>{
 const source:AssistantReply={status:'collecting',reply:'Bạn muốn chọn lớp nào?',inputForm:{id:'QA',fields:[]},workflowSelection:{id:'QA-choice',kind:'module',options:[{value:'opaque-token',label:'Lớp học viên'}]}};
 provider.mockResolvedValueOnce({text:JSON.stringify({reply:'Bạn chọn lớp cần xem ở bên dưới nhé.'})}).mockResolvedValueOnce({text:JSON.stringify({equivalent:true})});
 const reply=await applyAssistantResponseRules(source,'',{enabled:true});expect(reply.reply).toBe('Bạn chọn lớp cần xem ở bên dưới nhé.');expect(reply.inputForm).toBe(source.inputForm);expect(reply.workflowSelection).toBe(source.workflowSelection);
});
it('edits a table introduction while freezing rows, numbers and follow-up questions',async()=>{
 const source:AssistantReply={status:'completed',reply:formatAssistantResultTable('Đã tạo',[{Tên:'QA Tên','Điện thoại':'0900090998'}],['Bạn có muốn bổ sung email không? Có thể nói “bỏ qua”.'])};
 provider.mockResolvedValueOnce({text:JSON.stringify({reply:'Đã tạo xong.'})}).mockResolvedValueOnce({text:JSON.stringify({equivalent:true})});
 const reply=await applyAssistantResponseRules(source,'',{enabled:true,effect:'write'}),before=parseAssistantResultTable(source.reply)!,after=parseAssistantResultTable(reply.reply)!;
 expect(reply.reply).not.toBe(source.reply);expect(after.rows).toEqual(before.rows);expect(after.after).toEqual(before.after);
});
it('rejects a changed question subject when the independent equivalence check fails',async()=>{
 const source:AssistantReply={status:'collecting',reply:'Bạn muốn chọn lớp nào?'};
 provider.mockResolvedValueOnce({text:JSON.stringify({reply:'Bạn muốn chọn khóa nào?'})}).mockResolvedValueOnce({text:JSON.stringify({equivalent:false})});
 expect(await applyAssistantResponseRules(source,'Tự nhiên')).toEqual(source);
});

it('grounds a direct natural answer in immutable aggregate cells rather than merely repeating a report title',async()=>{
 const source:AssistantReply={status:'completed',reply:formatAssistantResultTable('Báo cáo đối tác',[{Phạm_vi:'Tất cả','Số lượng':'0'}])};
 provider.mockResolvedValueOnce({text:JSON.stringify({reply:'Hiện chưa có đối tác nào đáp ứng điều kiện này.'})}).mockResolvedValueOnce({text:JSON.stringify({equivalent:true})});
 const result=await applyAssistantResponseRules(source,'',{enabled:true,requestText:'Có đối tác nào đã được trả đủ chưa?'});
 expect(result.reply).toContain('Hiện chưa có đối tác');expect(parseAssistantResultTable(result.reply)?.rows).toEqual(parseAssistantResultTable(source.reply)?.rows);
 expect(JSON.parse(provider.mock.calls[1][0].messages[1].content).facts.rows[0]['Số lượng']).toBe('0');
 const facts=JSON.parse(provider.mock.calls[0][0].messages[1].content).facts;
 expect(facts).toMatchObject({excerptedForRewriting:false});expect(facts).not.toHaveProperty('displayedSample');
 expect(provider.mock.calls[0][0].messages[0].content).toContain('không phải dữ liệu minh họa');
});
it('keeps source coverage authoritative when only an excerpt is sent to the prose composer',async()=>{
 const source:AssistantReply={status:'completed',reply:formatAssistantResultTable('Kết quả',[{Tên:'QA An'},{Tên:'QA Bình'},{Tên:'QA Chi'},{Tên:'QA Dũng'}])};
 provider.mockResolvedValueOnce({text:JSON.stringify({reply:'Đây là dữ liệu mẫu nên chưa thể xác định kết quả.'})}).mockResolvedValueOnce({text:JSON.stringify({equivalent:false})});
 expect(await applyAssistantResponseRules(source,'',{enabled:true})).toEqual(source);
 expect(JSON.parse(provider.mock.calls[0][0].messages[1].content).facts.excerptedForRewriting).toBe(true);
 expect(provider.mock.calls[1][0].messages[0].content).toContain('mức độ đầy đủ');
});

import { describe, expect, it } from "vitest";
import { operationById, defaultWorkflow } from "./catalog";
import { formatFriendlyAssistantResult } from "./result-format";
import { completeAssistantOperation, type AssistantCompletion } from "./completion";
import { assistantRequestGuidance } from "./request-guidance";
import { presentAssistantReply, assistantConfirmationPrompt, assistantMissingInformationPrompt } from "./reply-presentation";
import { formatAssistantResultTable, parseAssistantResultTable } from "../../src/shared/assistant-result-table";
import type { AssistantReply } from "../../src/shared/assistant-workflow";

describe("shared Vietnamese assistant tone", () => {
  it.each(["student.create", "customer.create", "worker.project.create"])("states the actual completed action without changing its result table: %s", id => {
    const operation = operationById(id)!;
    const record = { fullName: "HOC-VIEN-QA", name: "HO-SO-QA", phone: "0900000001", code: "QA-01", email: "qa@example.test" };
    const source = formatFriendlyAssistantResult(operation, record);
    const reply = presentAssistantReply({ status: "completed", reply: source });
    expect(reply.reply).toMatch(/^Đã /);
    expect(reply.reply).not.toContain("Đã hoàn tất yêu cầu");
    expect(reply.reply).not.toContain("· 1 kết quả");
    expect(parseAssistantResultTable(reply.reply)?.rows).toEqual(parseAssistantResultTable(source)?.rows);
    expect(parseAssistantResultTable(reply.reply)?.rows).toHaveLength(1);
  });

  it("asks for the missing fields where the form already exists", () => {
    const prompt = assistantMissingInformationPrompt(["Mã", "Tên", "Điện thoại"], true);
    expect(prompt).toBe("Bạn bổ sung mã, tên và số điện thoại trong form bên dưới nhé.");
    expect(prompt).not.toMatch(/\n-|\[|trường|API/);
    const source: AssistantReply = { status: "collecting", reply: prompt,
      inputForm: { id: "pending-qa", fields: [{ key: "name", label: "Tên", type: "text", required: true }] } };
    expect(presentAssistantReply(source).inputForm).toBe(source.inputForm);
  });

  it("uses a concrete confirmation without changing the preview or claiming a write", () => {
    const source: AssistantReply = { status: "confirmation", reply: assistantConfirmationPrompt("Tạo khách hàng"),
      action: { id: "pending-qa", title: "Tạo khách hàng", values: [{ label: "Tên", value: "QA **A_B**", defaulted: false }] } };
    const reply = presentAssistantReply(source);
    expect(reply.reply).toContain("xác nhận để mình tạo khách hàng");
    expect(reply.reply).not.toContain("Mình đã");
    expect(reply.action?.values[0].value).toBe("QA **A_B**");
    expect(reply.status).toBe("confirmation");
  });

  it("rephrases a failed coverage check without pretending that leave data was queried", () => {
    const reply = presentAssistantReply({ status: "collecting", reply: 'Điều kiện “Hôm nay có ai nghỉ phép không” chưa được gắn với trường lọc. Mình chưa gọi API.' });
    expect(reply.reply).toContain('“Hôm nay có ai nghỉ phép không”');
    expect(reply.reply).toContain("chưa được thực hiện");
    expect(reply.reply).not.toMatch(/API|trường lọc|ánh xạ|Không có ai|không có kết quả/);
    expect(reply.status).toBe("collecting");
  });

  it("does not append placeholder tutorials to a specific clarification", () => {
    const workflows = ["worker.create", "worker.project.create"].map(id => defaultWorkflow(operationById(id)!));
    for (const text of ["thêm đối tượng", "hồ sơ đối tác", "Hôm nay có ai nghỉ phép không", "Tạo dự án lao động DU-AN-QA"]) {
      expect(assistantRequestGuidance(text, workflows)).toBe("");
    }
    const help = assistantRequestGuidance("Cho ví dụ cách hỏi tạo dự án lao động", workflows);
    expect(help).not.toMatch(/\[đối tượng\]|\[thông tin|thay phần trong ngoặc|Ví dụ cách viết/);
    expect(help).toContain("mình sẽ hỏi tiếp");
    expect(assistantRequestGuidance("Hướng dẫn cách hỏi với tệp", workflows, true)).not.toContain("[");
  });

  it("removes prose formatting while preserving names, punctuation, URLs, code and structured data", () => {
    const values = { "Tên": "Công ty **A_B**; [QA]", "Website": "https://example.test/a_b?q=1.5", "Ghi chú": "# Tên; lúc 8:30" };
    const source = formatAssistantResultTable("### **Mình đã cập nhật**", [values], ['Bạn có muốn bổ sung không?', 'Tên “**GIU_NGUYEN**” vẫn được giữ.']);
    const reply = presentAssistantReply({ status: "completed", reply: source });
    expect(reply.reply).toMatch(/^Mình đã cập nhật/);
    expect(parseAssistantResultTable(reply.reply)?.rows[0].values).toEqual(values);
    expect(reply.reply).toContain('“**GIU_NGUYEN**”');
    expect(reply.reply).toContain("Bạn có muốn bổ sung không?");
    const code = '```js\nconst name = "**QA**";\n```';
    expect(presentAssistantReply({ status: "completed", reply: code }).reply).toBe(code);
  });

  it("keeps table recognition for a single public column and does not hide meaningful counts", () => {
    const single = presentAssistantReply({ status: "completed", reply: formatAssistantResultTable("Đã cập nhật", [{ "Tên": "QA" }]) });
    expect(single.reply).toContain("1 kết quả");
    expect(parseAssistantResultTable(single.reply)?.rows).toHaveLength(1);
    const multiple = presentAssistantReply({ status: "completed", reply: formatAssistantResultTable("Học viên còn nợ", [{ "Tên": "A", "Còn nợ": "2.000.000 ₫" }, { "Tên": "B", "Còn nợ": "3.000.000 ₫" }]) });
    expect(multiple.reply).toContain("2 kết quả");
    expect(parseAssistantResultTable(multiple.reply)?.rows).toHaveLength(2);
    const styled = presentAssistantReply({ status: "completed", reply: formatAssistantResultTable("### **Kết quả**", [{ "Tên": "QA-A" }, { "Tên": "QA-B" }]) });
    expect(styled.reply).toMatch(/^Kết quả · 2 kết quả:/);
    expect(parseAssistantResultTable(styled.reply)?.rows).toHaveLength(2);
  });

  it("keeps the same private follow-up target, asks briefly and allows skipping after creation", async () => {
    const operation = operationById("customer.create")!;
    const workflow = defaultWorkflow(operation);
    const completion: AssistantCompletion = { operation, workflow, values: { name: "KHACH-HANG-QA", phone: "0900000001" },
      result: { data: { _id: "private-customer-qa", name: "KHACH-HANG-QA", phone: "0900000001" } } };
    const source: AssistantReply = { status: "completed", reply: formatFriendlyAssistantResult(operation, completion.result) };
    const result = await completeAssistantOperation(source, completion, [operation, operationById("customer.update")!], async () => true);
    const reply = presentAssistantReply(result);
    expect(reply.reply).toMatch(/Bạn có muốn bổ sung .+ không\?/);
    expect(reply.reply).toContain("bỏ qua");
    expect(reply.reply).not.toMatch(/Các mục còn trống|\d+ mục khác|private-customer-qa/);
    expect(completion.followUp?.values.path_id).toBe("private-customer-qa");
    expect(reply.reply).not.toMatch(/thêm.*Điện thoại/);
    expect((await completeAssistantOperation(reply, completion, [operation], async () => true)).reply).toBe(reply.reply);
  });
});

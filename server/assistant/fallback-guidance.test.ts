import { expect, it } from "vitest";
import { appendAssistantFallback } from "./fallback-guidance";
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from "./catalog";
import type { AssistantReply } from "../../src/shared/assistant-workflow";
const operation=operationById("student.payment.create")!;
const workflows=[defaultWorkflow(operation)];

it('preserves a provider failure without unrelated manual business instructions', () => {
  const reply: AssistantReply = { status: 'failed', reply: 'Chưa kết nối được dịch vụ AI.' };
  expect(appendAssistantFallback(reply, { operation, workflows, reason: 'provider' })).toBe(reply);
});

it("keeps the API reason and adds verified fee navigation without user credentials",()=>{
  const result=appendAssistantFallback({status:"failed",reply:"Số tiền vượt học phí còn nợ."},{operation,workflows,reason:"validation"});
  expect(result.reply).toContain("Số tiền vượt học phí còn nợ.");
  expect(result.reply).toContain("Nhật ký & Sửa học phí");
  expect(result.reply).toContain("Sửa thông tin hoặc điều kiện");
  expect(result.link).toBe("/quan-ly-hoc-vien?sub=hoc-phi");
  expect(result.status).toBe("failed");
});
it("only guides verification after an uncertain write, including a partial plan",()=>{
  const result=appendAssistantFallback({status:"uncertain",reply:"Chưa xác định kết quả."},{operation,workflows,reason:"uncertain",completedSteps:1});
  expect(result.reply).toContain("không thực hiện lại");
  expect(result.reply).toContain("Các bước đã hoàn tất vẫn được giữ");
  expect(result.reply).not.toContain("Chọn Thu học phí");
  expect(result.reply).not.toContain("chưa có dữ liệu nào được thay đổi");
});
it("does not suggest bypassing permissions or provide a write link",()=>{
  const result=appendAssistantFallback({status:"unsupported",reply:"Không có quyền."},{operation,workflows,reason:"permission"});
  expect(result.reply).toContain("Chỉ tiếp tục sau khi được cấp quyền");
  expect(result.reply).not.toContain("Chọn Thu học phí");
  expect(result.link).toBeUndefined();
});
it.each(["collecting","confirmation","completed","cancelled"] as const)("does not add manual instructions to %s", status=>{
  const reply:AssistantReply={status,reply:"Cần chọn học viên"};
  expect(appendAssistantFallback(reply,{operation,workflows,reason:"technical"})).toBe(reply);
});
it("does not guess a screen or link when the module is unavailable",()=>{
  const result=appendAssistantFallback({status:"failed",reply:"Không xử lý được."},{module:"student",workflows:[],reason:"technical"});
  expect(result.link).toBeUndefined();
  expect(result.reply).toContain("hãy cho biết tên màn hình");
  expect(result.reply).not.toContain("QUẢN LÝ HỌC VIÊN");
});
it.each([...new Set(ASSISTANT_OPERATIONS.map(op=>op.module))])("supports the common fallback for module %s without calling AI",module=>{
  const op=ASSISTANT_OPERATIONS.find(op=>op.module===module)!;
  const result=appendAssistantFallback({status:"failed",reply:"API tạm thời không kết nối được."},{operation:op,workflows:[defaultWorkflow(op)],reason:"technical"});
  expect(result.status).toBe("failed");
  expect(result.reply).toContain("Hướng dẫn dự phòng:");
  expect(result.reply).toContain("API tạm thời không kết nối được.");
  // Unknown screens and hidden modules deliberately do not receive guessed links.
  if (result.link !== undefined) expect(result.link).toMatch(/^\/(?!\/)/);
});
it("omits credential fields and unsafe destinations from a catalog fallback",()=>{
  const op={...operationById("employee.create")!,link:"https://outside.invalid/?token=private"};
  const result=appendAssistantFallback({status:"failed",reply:"Lỗi"},{operation:{...op,id:"custom.create"},workflows:[defaultWorkflow({...op,id:"custom.create"})],reason:"technical"});
  expect(result.link).toBeUndefined();
  expect(result.reply).not.toContain("Mật khẩu");
  expect(result.reply).not.toContain("outside.invalid");
});

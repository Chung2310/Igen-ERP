import { describe, expect, it } from 'vitest';
import type { AssistantReply } from '../../src/shared/assistant-workflow';
import { ASSISTANT_OPERATIONS } from './catalog';
import { assistantMissingInformationPrompt, assistantSelectionPrompt, assistantConfirmationPrompt,
  assistantOptionalInformationPrompt, hasAssistantOptionalInformationPrompt, presentAssistantReply } from './reply-presentation';
import { formatAssistantResultTable, parseAssistantResultTable } from '../../src/shared/assistant-result-table';

describe('natural ERP dialogue shared by every module', () => {
  it('asks only for missing fields without reading the format hint aloud', () => {
    expect(assistantMissingInformationPrompt(['Email', 'Ngày đăng ký (DD/MM/YYYY hoặc YYYY-MM-DD)'], true))
      .toBe('Bạn bổ sung email và ngày đăng ký trong form bên dưới nhé.');
    expect(assistantSelectionPrompt(['Tên hoặc mã học viên'])).toBe('Bạn chọn học viên bên dưới nhé.');
    expect(assistantSelectionPrompt(['Tên hoặc mã sản phẩm', 'SKU cần nhập'])).toBe('Bạn chọn sản phẩm và SKU cần nhập bên dưới nhé.');
    expect(assistantSelectionPrompt(['Tên, hoặc mã lớp', 'Tên, hoặc số điện thoại học viên cần thêm']))
      .toBe('Bạn chọn lớp và học viên cần thêm bên dưới nhé.');
    expect(assistantSelectionPrompt(['Tên hoặc mã hoặc mã lớp'])).toBe('Bạn chọn lớp bên dưới nhé.');
  });

  it.each([...new Set(ASSISTANT_OPERATIONS.map(operation => operation.module))])('keeps confirmation, form and opaque choices intact in %s', module => {
    const operation = ASSISTANT_OPERATIONS.find(operation => operation.module === module)!;
    const controls = {
      action: { id: 'private-pending', title: operation.title, values: [
        { label: 'Tên', value: 'Minh **An**; A.01', defaulted: false },
        { label: 'Mặc định', value: 'private-default', defaulted: true },
      ] },
      inputForm: { id: 'private-form', fields: [{ key: 'email', label: 'Email', type: 'email' as const, required: true }] },
      referenceSelections: [{ key: 'record', label: 'Học viên', required: true, multiple: false, options: [
        { value: 'opaque-1', label: 'Minh An — 0900090001' }, { value: 'opaque-2', label: 'Minh An — 0900090002' },
      ] }],
      workflowSelection: { id: 'private-choice', kind: 'module' as const, options: [{ value: 'opaque-module', label: String(module) }] },
    };
    const result = presentAssistantReply({ status: 'confirmation', reply: assistantConfirmationPrompt(operation.title), ...controls });
    expect(result.status).toBe('confirmation');
    expect(result.reply).toContain('xác nhận');
    expect(result.reply).not.toMatch(/Đã tạo|Đã sửa|Đã xóa|private-|opaque-/);
    expect(result.action?.values).toEqual([controls.action.values[0]]);
    expect(result.inputForm).toBe(controls.inputForm);
    expect(result.referenceSelections).toBe(controls.referenceSelections);
    expect(result.workflowSelection).toBe(controls.workflowSelection);
    expect(controls.action.values).toHaveLength(2);
  });

  it('uses the existing selection when a collecting reply has no remaining prose', () => {
    const reply: AssistantReply = { status: 'collecting', reply: 'Workflow: chọn hồ sơ', referenceSelections: [
      { key: 'worker', label: 'Tên hoặc mã lao động', required: true, multiple: false, options: [{ value: 'opaque', label: 'Minh An' }] },
    ] };
    expect(presentAssistantReply(reply).reply).toBe('Bạn chọn lao động bên dưới nhé.');
    const restored = presentAssistantReply({ ...reply, reply: 'Số điện thoại chưa hợp lệ.\nMình đã tìm thấy lựa chọn phù hợp. Bạn chọn ngay bên dưới nhé.' });
    expect(restored.reply).toBe('Số điện thoại chưa hợp lệ.\nBạn chọn lao động bên dưới nhé.');
    expect(restored.referenceSelections).toBe(reply.referenceSelections);
  });

  it('recognizes both new and restored optional questions, but never a value inside a table', () => {
    const question = assistantOptionalInformationPrompt(['Email', 'Địa chỉ']);
    expect(question).toBe('Bạn có muốn bổ sung email hoặc địa chỉ không? Có thể nói “bỏ qua” để thêm sau.');
    expect(hasAssistantOptionalInformationPrompt(question)).toBe(true);
    expect(hasAssistantOptionalInformationPrompt('Bạn có muốn bổ sung không? Mình có thể thêm email.')).toBe(true);
    const rows = [{ 'Tên': 'Bạn có muốn bổ sung không?', 'Mã': 'QA-01' }];
    expect(hasAssistantOptionalInformationPrompt(formatAssistantResultTable('Đã tạo', rows))).toBe(false);
    expect(hasAssistantOptionalInformationPrompt(formatAssistantResultTable('Đã tạo', rows, [question]))).toBe(true);
  });

  it('preserves facts, truncated counts, dates and after-table follow-up text', () => {
    const values = [{ 'Tên': 'Minh **An**; A.01', 'Còn nợ': '2.000.000 ₫', 'Ngày': '25/11/2026', 'Ghi chú': '# Giữ nguyên; chưa thanh toán' }];
    const source = formatAssistantResultTable('Mình đã cập nhật hồ sơ.', values, [
      assistantOptionalInformationPrompt(['Email', 'Địa chỉ']), 'Còn 4 kết quả chưa hiển thị.',
    ]);
    const result = presentAssistantReply({ status: 'completed', reply: source });
    expect(result.reply).toMatch(/^Đã cập nhật hồ sơ/);
    expect(parseAssistantResultTable(result.reply)?.rows).toEqual(parseAssistantResultTable(source)?.rows);
    expect(parseAssistantResultTable(result.reply)?.after).toEqual(parseAssistantResultTable(source)?.after);
    expect(result.reply).toContain('Còn 4 kết quả chưa hiển thị.');
  });

  it('does not turn a missing result into a provider error or guess a broader scope', () => {
    expect(presentAssistantReply({ status: 'completed', reply: 'Chưa có kết quả phù hợp trong phạm vi đang xem. Bạn có thể thử tên hoặc mã khác, hay chọn lại phạm vi cần tìm.' }).reply)
      .toBe('Không tìm thấy kết quả phù hợp trong phạm vi đang xem.');
    const failed: AssistantReply = { status: 'failed', reply: 'Chưa lấy được dữ liệu y tế. Chưa thể kết luận không có bệnh nhân.' };
    expect(presentAssistantReply(failed)).toEqual(failed);
  });

  it('does not rewrite uncertainty, raw error details or partial completion into success', () => {
    const uncertain: AssistantReply = { status: 'uncertain', reply: 'Chưa xác minh được thao tác đã hoàn tất hay chưa. Cần kiểm tra lại trước khi thử lại.' };
    expect(presentAssistantReply(uncertain)).toEqual(uncertain);
    const partial: AssistantReply = { status: 'collecting', reply: 'Đã cập nhật số điện thoại của Minh An. Phần chuyển phòng ban chưa được thực hiện. Bạn chọn phòng bên dưới nhé.' };
    expect(presentAssistantReply(partial)).toEqual(partial);
  });
});

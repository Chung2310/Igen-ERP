import { afterEach, describe, expect, it, vi } from 'vitest';
import fixtures from './testing/hr-local-regression/coverage-fixtures.json';
import { defaultWorkflow, operationById } from './catalog';
import { validateRequestCoverage } from './request-coverage';
import { collectValues } from './policy';
import { buildAssistantCapabilityContext } from './capability-context';

afterEach(() => vi.useRealTimers());
const check = (text: string, actionId: string, values: Record<string, unknown>, coverage: unknown) => {
  const operation = operationById(actionId)!;
  return validateRequestCoverage(text, coverage, defaultWorkflow(operation), operation, values);
};

describe('captured real-model HR coverage regressions', () => {
  it.each(fixtures.filter(f => f.id !== 'HR11-2'))('$id accepts the supported request without a model repair', fixture => {
    expect(check(fixture.text, fixture.actionId, fixture.values, fixture.coverage)).toEqual({ ok: true });
  });
  it('rejects the captured repair that truncated the employee name', () => {
    const fixture = fixtures.find(f => f.id === 'HR11-2')!;
    expect(fixture.values.employeeId).toBe('QA Nhân Sự');
    expect(check(fixture.text, fixture.actionId, fixture.values, fixture.coverage)).toMatchObject({ ok: false });
  });
  it.each(fixtures.filter(f => ['HR07-1', 'HR22-1', 'HR23-1'].includes(f.id)))('$id still rejects an additional unpaid condition', fixture => {
    expect(check(fixture.text + ' chưa thanh toán', fixture.actionId, fixture.values, fixture.coverage)).toMatchObject({ ok: false });
  });
  it.each(['employee.birthday.next-month', 'hr.training.incomplete.list'])('does not swallow an unrepresented date in %s', id => {
    const text = id === 'employee.birthday.next-month' ? 'Nhân sự có sinh nhật tháng tới' : 'Nhân sự chưa hoàn thành đào tạo nội bộ';
    expect(check(text + ' trong quý 4', id, {}, [{ evidence: text, requirement: 'Báo cáo', mappedTo: ['action'] }])).toMatchObject({ ok: false });
  });
  it('does not use an all-progress report as an incomplete-only filter', () => {
    const text = 'Nhân sự chưa hoàn thành đào tạo nội bộ';
    expect(check(text, 'hr.training.progress', {}, [{ evidence: text, requirement: 'Chưa hoàn thành', mappedTo: ['action'] }])).toMatchObject({ ok: false });
  });
  it('keeps positive and negative contract predicates distinct', () => {
    const text = 'Nhân sự có hợp đồng';
    expect(check(text, 'hr.contract.missing.list', {}, [{ evidence: text, requirement: 'Có hợp đồng', mappedTo: ['action'] }])).toMatchObject({ ok: false });
  });
  it.each(['nếu đã nghỉ việc', 'chỉ khi đã nghỉ việc', 'vì đã nghỉ việc và xóa người khác'])('does not turn %s into an explanatory motive', suffix => {
    const text = `Xóa nhân sự QA Người Kiểm Thử ${suffix}`;
    expect(check(text, 'employee.delete', { id: 'QA Người Kiểm Thử' }, [
      { evidence: 'Xóa nhân sự QA Người Kiểm Thử', requirement: 'Xóa hồ sơ', mappedTo: ['action', 'values.id'] },
      { evidence: suffix, requirement: 'Điều kiện', mappedTo: [] },
    ])).toMatchObject({ ok: false });
  });
  it('does not discard an omitted name suffix because it resembles discourse', () => {
    expect(check('Sửa nhân sự QA Người Hà Nội số điện thoại 0900000001', 'employee.update', { id: 'QA Người', phone: '0900000001' }, [
      { evidence: 'Sửa nhân sự QA Người', requirement: 'Nhân sự', mappedTo: ['action', 'values.id'] },
      { evidence: 'số điện thoại 0900000001', requirement: 'Điện thoại', mappedTo: ['values.phone'] },
    ])).toMatchObject({ ok: false });
  });
  it('does not allow internal result fields to masquerade as a supported mapping', () => {
    expect(check('Số nhân sự của phòng ban', 'department.lookup', {}, [{ evidence: 'Số nhân sự của phòng ban', requirement: 'Đếm', mappedTo: ['department.lookup:result.password'] }])).toMatchObject({ ok: false });
  });
});

describe('explicit clears and runtime date defaults', () => {
  it('pins the declared attendance date default but never accepts another requested day as today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-25T01:00:00Z'));
    const op = operationById('timekeeping.records.leave')!;
    expect(collectValues(defaultWorkflow(op), {}).values.query_date).toBe('2026-11-25');
    expect(check('Ngày mai có ai nghỉ phép không', op.id, {}, [
      { evidence: 'Ngày mai', requirement: 'Ngày cần xem', mappedTo: ['values.query_date'] },
      { evidence: 'có ai nghỉ phép không', requirement: 'Nghỉ phép', mappedTo: ['action'] },
    ])).toMatchObject({ ok: false });
  });
  it('preserves an inner contract negation inside a polar question', () => {
    expect(check('Có ai có hợp đồng không', 'hr.contract.missing.list', {}, [
      { evidence: 'có ai có hợp đồng không', requirement: 'Có hợp đồng', mappedTo: ['action'] },
    ])).toMatchObject({ ok: false });
  });
  it('preserves an explicitly cleared job title as an update, not an empty request', () => {
    const workflow = defaultWorkflow(operationById('employee.update')!);
    const result = collectValues(workflow, { id: 'QA Người Kiểm Thử', jobTitle: '' });
    expect(result.values.jobTitle).toBe('');
    expect(result.defaulted).not.toContain('jobTitle');
    expect(check('Hủy chức danh của QA Người Kiểm Thử', 'employee.update', { id: 'QA Người Kiểm Thử', jobTitle: '' }, [
      { evidence: 'Hủy chức danh', requirement: 'Xóa chức danh', mappedTo: ['values.jobTitle'] },
      { evidence: 'QA Người Kiểm Thử', requirement: 'Nhân sự', mappedTo: ['values.id'] },
    ])).toEqual({ ok: true });
  });
  it('does not clear an unrelated field or invent a clear from missing data', () => {
    expect(check('Đổi chức danh của QA Người Kiểm Thử', 'employee.update', { id: 'QA Người Kiểm Thử', jobTitle: '' }, [
      { evidence: 'Đổi chức danh', requirement: 'Đổi chức danh', mappedTo: ['values.jobTitle'] },
      { evidence: 'QA Người Kiểm Thử', requirement: 'Nhân sự', mappedTo: ['values.id'] },
    ])).toMatchObject({ ok: false });
  });
  it('defaults extension date at request time in Vietnam and retains explicit overrides', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-23T18:00:00Z'));
    const workflow = defaultWorkflow(operationById('hr.contract.extend')!);
    const supplied = { path_id: 'QA Hợp đồng', newEndDate: '2027-04-30' };
    const defaulted = collectValues(workflow, supplied);
    expect(defaulted.values.extensionDate).toBe('2026-11-24');
    expect(defaulted.defaulted).toContain('extensionDate');
    expect(defaulted.missing).not.toContain('Ngày gia hạn');
    const explicit = collectValues(workflow, { ...supplied, extensionDate: '2026-11-20' });
    expect(explicit.values.extensionDate).toBe('2026-11-20');
    expect(explicit.defaulted).not.toContain('extensionDate');
  });
  it('publishes clearable/default semantics without granting a new action', () => {
    const operations = ['employee.update', 'hr.contract.extend'].map(id => operationById(id)!);
    const context = buildAssistantCapabilityContext(operations.map(defaultWorkflow), operations);
    expect(context[0].inputs.find(field => field.key === 'jobTitle')).toMatchObject({ clearable: true });
    expect(context[1].inputs.find(field => field.key === 'extensionDate')).toMatchObject({ runtimeDefault: 'today-vietnam' });
  });
});

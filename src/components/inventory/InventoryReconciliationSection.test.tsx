// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ warehouses: vi.fn(), run: vi.fn() }));
vi.mock('../../services/inventoryReconciliationService', () => ({ inventoryReconciliationService: mocks }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ userProfile: { companyCode: 'QA', role: 'admin' }, hasPermission: () => true }) }));
vi.mock('../../context/BranchContext', () => ({ useBranch: () => ({ activeBranchId: 'branch-a' }) }));
import { InventoryReconciliationSection } from './InventoryReconciliationSection';

beforeEach(() => {
  mocks.warehouses.mockResolvedValue([]);
  mocks.run.mockResolvedValue({ summary: { status: 'needs-review', complete: true, scope: {}, examined: {}, errors: 0, reviews: 1, findings: 1 }, findings: [], checkedAt: new Date().toISOString(), truncated: false });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

async function setup() {
  render(<InventoryReconciliationSection />);
  const run = screen.getByRole('button', { name: 'Chạy đối soát' }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  return { run, input: screen.getByLabelText('Tệp tồn đầu kỳ đã xác nhận (JSON)') as HTMLInputElement };
}

describe('đối soát và tệp đầu kỳ', () => {
  it('chờ đọc xong tệp rồi mới cho chạy và gửi đúng dữ liệu đã chọn', async () => {
    const { input, run } = await setup();
    let finish!: (value: string) => void;
    const file = new File([''], 'opening.json', { type: 'application/json' });
    const baseline = { schemaVersion: 1, companyCode: 'QA', balances: [] };
    Object.defineProperty(file, 'text', { value: () => new Promise<string>((resolve) => { finish = resolve; }) });
    fireEvent.change(input, { target: { files: [file] } });
    expect(run.disabled).toBe(true);
    fireEvent.click(run); expect(mocks.run).not.toHaveBeenCalled();
    await act(async () => finish(JSON.stringify(baseline)));
    expect(run.disabled).toBe(false);
    fireEvent.click(run);
    await waitFor(() => expect(mocks.run).toHaveBeenCalledWith({ companyCode: 'QA', branchId: 'branch-a' }, expect.objectContaining({ baseline }), expect.any(AbortSignal)));
  });

  it('tệp cũ đọc chậm không được ghi đè tệp mới', async () => {
    const { input, run } = await setup();
    let finishOld!: (value: string) => void;
    const older = new File([''], 'older.json');
    const newer = new File([''], 'newer.json');
    const baseline = { schemaVersion: 1, companyCode: 'QA', balances: [], asOf: '2026-10-01T00:00:00Z' };
    Object.defineProperty(older, 'text', { value: () => new Promise<string>((resolve) => { finishOld = resolve; }) });
    Object.defineProperty(newer, 'text', { value: async () => JSON.stringify(baseline) });
    fireEvent.change(input, { target: { files: [older] } });
    fireEvent.change(input, { target: { files: [newer] } });
    await screen.findByText('newer.json');
    await act(async () => finishOld('{"invalid":"old"}'));
    expect(screen.queryByText('older.json')).toBeNull();
    fireEvent.click(run);
    await waitFor(() => expect(mocks.run).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ baseline }), expect.anything()));
  });

  it('hiển thị lỗi đối soát chưa hoàn tất và không đưa kết luận sạch', async () => {
    const { run } = await setup();
    mocks.run.mockRejectedValueOnce(new Error('Đối soát chưa hoàn tất.'));
    fireEvent.click(run);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Đối soát chưa hoàn tất.');
    expect(screen.queryByText('Chưa phát hiện chênh lệch trong phạm vi đã kiểm tra')).toBeNull();
  });
});

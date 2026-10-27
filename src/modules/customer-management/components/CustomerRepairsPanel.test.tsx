// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ api: vi.fn(), allowed: true }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ userProfile: { role: 'user' }, hasPermission: () => mocks.allowed }) }));
vi.mock('../../shared/lib/apiFetch', () => ({ apiFetch: mocks.api }));
import CustomerRepairsPanel from './CustomerRepairsPanel';
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.allowed = true; });
const item = (code: string) => ({ _id: code, ticketCode: code, ticketType: 'service', device: { name: 'Thiết bị' }, status: 'received', receivedAt: '2026-10-01T00:00:00Z', dueAmount: 0 });
it('không truy vấn khi thiếu quyền xem sửa chữa', () => {
  mocks.allowed = false; render(<CustomerRepairsPanel customerId="customer-a" companyCode="QA" branchId="branch-a" />);
  expect(mocks.api).not.toHaveBeenCalled(); expect(screen.getByText(/chưa có quyền/)).toBeTruthy();
});
it('đổi chi nhánh không hiển thị phản hồi cũ đến chậm', async () => {
  let finish!: (value: unknown) => void;
  mocks.api.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  mocks.api.mockResolvedValueOnce({ data: { items: [item('BRANCH-B')], total: 1, page: 1, limit: 20 } });
  const view = render(<CustomerRepairsPanel customerId="customer-a" companyCode="QA" branchId="branch-a" />);
  view.rerender(<CustomerRepairsPanel customerId="customer-a" companyCode="QA" branchId="branch-b" />);
  await screen.findByText('BRANCH-B');
  await act(async () => finish({ data: { items: [item('OLD-BRANCH-A')], total: 1, page: 1, limit: 20 } }));
  expect(screen.queryByText('OLD-BRANCH-A')).toBeNull();
  expect(mocks.api.mock.calls[0][1].signal.aborted).toBe(true);
});

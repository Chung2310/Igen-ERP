// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ revenue: vi.fn(), technicians: vi.fn() }));
vi.mock('../../services/repairService', () => ({ repairExtras: { revenueReport: mocks.revenue, technicianReport: mocks.technicians } }));
vi.mock('../../pages/Toast', () => ({ toast: { error: vi.fn() } }));
import RepairReportsPanel from './RepairReportsPanel';

afterEach(() => { cleanup(); vi.resetAllMocks(); });
const total = { ticketCount: 2, warrantyTicketCount: 1, laborRevenue: 1000000, partRevenue: 200000, revenue: 1200000, collected: 1000000, outstanding: 200000 };
test('keeps report errors visible and retries without losing the existing request filters', async () => {
  mocks.revenue.mockRejectedValueOnce(new Error('Không thể kết nối')).mockResolvedValue({ items: [{ key: 'Chi nhánh A', ...total }], total });
  mocks.technicians.mockResolvedValue([]);
  render(<RepairReportsPanel />);
  expect((await screen.findByRole('alert')).textContent).toContain('Không thể kết nối');
  const firstParams = mocks.revenue.mock.calls[0][0];
  await userEvent.setup().click(screen.getByRole('button', { name: 'Xem báo cáo' }));
  await screen.findByText('Chi nhánh A');
  expect(mocks.revenue.mock.lastCall?.[0]).toEqual(firstParams);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByText('Doanh thu vật tư')).toBeTruthy();
});
test('announces report loading and preserves the existing grouping action', async () => {
  let resolve!: (value: { items: never[]; total: typeof total }) => void;
  mocks.revenue.mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue({ items: [], total });
  mocks.technicians.mockResolvedValue([]);
  render(<RepairReportsPanel />);
  expect(screen.getByRole('status').textContent).toContain('Đang tải báo cáo');
  resolve({ items: [], total });
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Nhóm theo' }));
  await user.click(screen.getByRole('option', { name: 'Kỹ thuật viên' }));
  await waitFor(() => expect(mocks.revenue).toHaveBeenLastCalledWith(expect.objectContaining({ groupBy: 'technician' })));
});

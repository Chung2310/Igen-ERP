// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import RepairBoardView from './RepairBoardView';
import type { RepairStatus, RepairTicket } from '../../services/repairService';

afterEach(() => { cleanup(); vi.useRealTimers(); });
const ticket = (id: string, status: RepairStatus, extra: Partial<RepairTicket> = {}): RepairTicket => ({ _id: id, ticketCode: id, status, customerId: 'customer-a', customerName: 'Công ty Minh Anh', customerPhone: '0901000001', device: { name: 'Máy in', condition: '', accessories: [] }, coverage: { customer: { covered: false }, supplier: { covered: false }, costBearer: 'customer', checkedAt: '2026-10-29' }, symptom: 'Kẹt giấy', laborFee: 0, partCost: 0, discountAmount: 0, totalAmount: 0, paidAmount: 0, dueAmount: 0, paymentStatus: 'unpaid', receivedAt: '2026-10-28T18:00:00Z', ...extra });
const board = {
  approved: [ticket('REP-A', 'approved', { ticketType: 'warranty', technicianId: 'tech-a', technicianName: 'Kỹ thuật A' })],
  repairing: [ticket('REP-B', 'repairing', { ticketType: 'service', technicianId: 'tech-b', technicianName: 'Kỹ thuật B' })],
  waiting_parts: [ticket('REP-C', 'waiting_parts')],
  waiting_supplier: [ticket('REP-D', 'waiting_supplier')],
  delivered: [ticket('REP-E', 'delivered', { deliveredAt: '2026-10-29T05:00:00Z' })],
};
function setup(data = board, options: { loading?: boolean; error?: string } = {}) {
  const onSelect = vi.fn(); const onRetry = vi.fn();
  render(<RepairBoardView board={data} loading={options.loading || false} error={options.error || ''} onRetry={onRetry} intakeAction={<button>Tiếp nhận sửa dịch vụ</button>} renderTicket={item => <button type="button" onClick={() => onSelect(item)}>{item.ticketCode}</button>} onSelect={onSelect} />);
  return { user: userEvent.setup(), onSelect, onRetry };
}
test('groups ERP statuses into seven retail steps without losing approved or supplier tickets', () => {
  setup();
  expect(screen.getByText('4 phiếu đang xử lý')).toBeTruthy();
  const repairing = screen.getByRole('region', { name: '4. Đang thực hiện' });
  expect(within(repairing).getByText('REP-A')).toBeTruthy(); expect(within(repairing).getByText('REP-B')).toBeTruthy();
  const waiting = screen.getByRole('region', { name: '5. Chờ vật tư / NCC' });
  expect(within(waiting).getByText('REP-C')).toBeTruthy(); expect(within(waiting).getByText('REP-D')).toBeTruthy();
});
test('combines text, source and technician filters and restores all steps', async () => {
  const { user } = setup();
  await user.click(within(screen.getByRole('group', { name: 'Lọc loại phiếu' })).getByRole('button', { name: 'Bảo hành' }));
  expect(screen.getByText('REP-A')).toBeTruthy(); expect(screen.queryByText('REP-B')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Lọc theo kỹ thuật viên' }));
  await user.click(screen.getByRole('option', { name: 'Kỹ thuật A' }));
  await user.type(screen.getByRole('searchbox'), 'not-found');
  await user.click(screen.getByRole('checkbox', { name: 'Ẩn bước trống' }));
  expect(screen.getByText('Không có phiếu phù hợp với bộ lọc.')).toBeTruthy();
  await user.click(screen.getAllByRole('button', { name: 'Xóa bộ lọc' })[0]);
  expect(screen.getByText('REP-B')).toBeTruthy();
});
test('filters service work separately and retains unclassified legacy tickets', async () => {
  const { user } = setup({ ...board, approved: [ticket('REP-SERVICE', 'approved', { subjectType: 'service' }), ticket('REP-PRODUCT', 'approved', { subjectType: 'product' })] });
  await user.click(screen.getByRole('button', { name: 'Lọc loại đối tượng' }));
  await user.click(screen.getByRole('option', { name: 'Hạng mục dịch vụ' }));
  expect(screen.getByText('REP-SERVICE')).toBeTruthy();
  expect(screen.queryByText('REP-PRODUCT')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Lọc loại đối tượng' }));
  await user.click(screen.getByRole('option', { name: 'Chưa phân loại' }));
  expect(screen.getByText('REP-B')).toBeTruthy();
  expect(screen.queryByText('REP-SERVICE')).toBeNull();
});
test('filters by Vietnam calendar day, excludes future tickets and uses delivery date in history', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-29T05:00:00Z'));
  const { user, onSelect } = setup({ ...board, approved: [ticket('REP-TODAY', 'approved'), ticket('REP-TOMORROW', 'approved', { receivedAt: '2026-10-29T18:00:00Z' })] });
  await user.click(screen.getByRole('button', { name: 'Hôm nay' }));
  expect(screen.getByText('REP-TODAY')).toBeTruthy(); expect(screen.queryByText('REP-TOMORROW')).toBeNull();
  await user.click(screen.getByRole('button', { name: /Lịch sử bàn giao/ }));
  await user.click(screen.getByRole('button', { name: 'REP-E' }));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ _id: 'REP-E' }));
});
test('stage filters and hide-empty controls leave usable empty-state recovery', async () => {
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: /^4\. Đang xử lý/ }));
  expect(screen.queryByRole('region', { name: '1. Tiếp nhận' })).toBeNull();
  await user.click(screen.getByRole('button', { name: /^1\. Tiếp nhận/ }));
  await user.click(screen.getByRole('checkbox', { name: 'Ẩn bước trống' }));
  expect(screen.getByText('Không có phiếu phù hợp với bộ lọc.')).toBeTruthy();
});
test('shows loading without a false empty board, and lets failed loads retry', async () => {
  setup(board, { loading: true });
  expect(screen.getByRole('status').textContent).toContain('Đang tải phiếu');
  cleanup();
  const { user, onRetry } = setup(board, { error: 'Không kết nối được' });
  expect(screen.getByRole('alert').textContent).toContain('Không kết nối được');
  await user.click(screen.getByRole('button', { name: 'Thử lại' })); expect(onRetry).toHaveBeenCalledOnce();
});

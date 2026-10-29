// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ branchId: 'branch-a', role: 'admin', lookup: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ userProfile: { uid: 'staff', companyCode: 'QA', role: mocks.role }, hasPermission: () => false }) }));
vi.mock('../../context/BranchContext', () => ({ useBranch: () => ({ activeBranchId: mocks.branchId, loading: false }) }));
vi.mock('../../services/retailWarrantyService', () => ({ retailWarrantyService: { lookup: mocks.lookup } }));
vi.mock('../../modules/retail/pages/OrderWarrantyPage', () => ({ default: () => <p>Order lookup workspace</p> }));
import WarrantyLookupSection from './WarrantyLookupSection';

afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.branchId = 'branch-a'; mocks.role = 'admin'; });

test('changing branches aborts the old lookup and clears its result', async () => {
  let resolve!: (data: { found: false }) => void;
  mocks.lookup.mockImplementation(() => new Promise(done => { resolve = done; }));
  const user = userEvent.setup();
  const view = render(<WarrantyLookupSection />);
  await user.type(screen.getByRole('textbox'), 'SN-001');
  await user.click(screen.getByRole('button', { name: 'Tra cứu' }));
  const options = mocks.lookup.mock.calls[0][1];
  expect(options).toEqual(expect.objectContaining({ companyCode: 'QA', branchId: 'branch-a' }));
  mocks.branchId = 'branch-b';
  view.rerender(<WarrantyLookupSection />);
  expect(options.signal.aborted).toBe(true);
  await act(async () => resolve({ found: false }));
  expect(screen.queryByText('Không tìm thấy sản phẩm trong hệ thống')).toBeNull();
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
});

test('read-only staff can look up products without intake actions or management reports', async () => {
  mocks.role = 'staff';
  mocks.lookup.mockResolvedValue({ found: false });
  const user = userEvent.setup();
  render(<WarrantyLookupSection />);
  await user.type(screen.getByRole('textbox'), 'EXT-001');
  await user.click(screen.getByRole('button', { name: 'Tra cứu' }));
  await screen.findByText('Không tìm thấy sản phẩm trong hệ thống');
  expect(screen.queryByRole('button', { name: /Tiếp nhận/ })).toBeNull();
  expect(screen.queryByText('Danh sách sắp hết hạn')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Đơn hàng / khách hàng' }));
  expect(screen.getByText('Order lookup workspace')).toBeTruthy();
});

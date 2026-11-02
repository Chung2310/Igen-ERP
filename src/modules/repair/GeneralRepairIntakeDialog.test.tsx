// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ search: vi.fn(), create: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'staff' }, userProfile: { companyCode: 'QA', role: 'admin' }, hasPermission: () => true }) }));
vi.mock('../../context/BranchContext', () => ({ useBranch: () => ({ activeBranchId: 'branch-a' }) }));
vi.mock('../customer-management/customerApi', () => ({ customerApi: { searchActive: mocks.search } }));
vi.mock('../../services/repairService', () => ({ repairService: { create: mocks.create } }));
import GeneralRepairIntakeDialog from './GeneralRepairIntakeDialog';
async function choose(label: string, option: string | RegExp) { fireEvent.click(screen.getByRole("button", { name: label })); fireEvent.click(await screen.findByRole("option", { name: option })); }

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
beforeEach(() => { sessionStorage.clear(); mocks.search.mockResolvedValue([{ customerId: 'customer-a', customerCode: 'KH-A', name: 'Doanh nghiệp A', phone: '0901000001' }]); mocks.create.mockResolvedValue({ _id: 'ticket-a' }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('accepts a service work item without a serial or an inventory link', async () => {
  render(<GeneralRepairIntakeDialog onClose={vi.fn()} onCreated={vi.fn()} />);
  await fill();
  await choose('Đối tượng', 'Hạng mục dịch vụ');
  expect((screen.getByLabelText('Serial / mã định danh (nếu có)') as HTMLInputElement).required).toBe(false);
  expect(screen.queryByRole('option', { name: 'Liên kết hàng đã bán trong hệ thống' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Tạo phiếu tiếp nhận' }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ subjectType: 'service', intakeSource: 'external', device: expect.objectContaining({ serialNumber: undefined, productId: undefined }) })));
});
it('classifies a prefilled catalog item as a product', () => {
  render(<GeneralRepairIntakeDialog onClose={vi.fn()} onCreated={vi.fn()} prefill={{ productId: 'product-1', productName: 'Bàn làm việc', coverage: { customer: { covered: false }, supplier: { covered: false }, costBearer: 'customer', checkedAt: '2026-10-29' } }} />);
  expect(screen.getByRole('button', { name: 'Đối tượng' }).textContent).toContain('Sản phẩm');
});
it('preserves an external intake with a serial number', async () => {
  render(<GeneralRepairIntakeDialog onClose={vi.fn()} onCreated={vi.fn()} prefill={{ ticketType: 'service', intakeSource: 'external', productName: 'Máy in', serialNumber: 'EXT-001', coverage: { customer: { covered: false }, supplier: { covered: false }, costBearer: 'customer', checkedAt: '2026-10-29' } }} />);
  expect(screen.getByRole('button', { name: 'Nguồn tiếp nhận' }).textContent).toContain('Khách mang đến / dịch vụ bên ngoài');
  await fill();
  fireEvent.click(screen.getByRole('button', { name: 'Tạo phiếu tiếp nhận' }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ ticketType: 'service', intakeSource: 'external', device: expect.objectContaining({ serialNumber: 'EXT-001' }) })));
});
it('opens supplier-only coverage as a warranty intake', () => {
  render(<GeneralRepairIntakeDialog onClose={vi.fn()} onCreated={vi.fn()} prefill={{ ticketType: 'warranty', intakeSource: 'company_sale', productName: 'Máy in', serialNumber: 'ERP-001', coverage: { customer: { covered: false }, supplier: { covered: true, daysLeft: 60 }, costBearer: 'supplier', checkedAt: '2026-10-29' } }} />);
  expect(screen.getByRole('button', { name: 'Loại phiếu' }).textContent).toContain('Bảo hành');
  expect(screen.getByRole('button', { name: 'Nguồn tiếp nhận' }).textContent).toContain('Liên kết hàng đã bán trong hệ thống');
});
async function fill() {
  await choose('Khách hàng', /Doanh nghiệp A/);
  fireEvent.change(screen.getByLabelText('Tên đối tượng / hạng mục'), { target: { value: 'Hệ thống điều hòa' } });
  fireEvent.change(screen.getByLabelText('Tình trạng khi tiếp nhận'), { target: { value: 'Hoạt động yếu' } });
  fireEvent.change(screen.getByLabelText('Mô tả lỗi / yêu cầu thực hiện'), { target: { value: 'Kiểm tra và bảo trì' } });
}
it('tiếp nhận dịch vụ không serial và dùng ID khách hàng thống nhất', async () => {
  const onCreated = vi.fn(); render(<GeneralRepairIntakeDialog onClose={vi.fn()} onCreated={onCreated} />);
  await fill();
  expect((screen.getByLabelText('Serial / mã định danh (nếu có)') as HTMLInputElement).required).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Tạo phiếu tiếp nhận' }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'customer-a', ticketType: 'service', intakeSource: 'external', idempotencyKey: expect.any(String) }));
});
it('yêu cầu bảo hành ngoài hiển thị chứng từ và xác nhận kiểm tra', async () => {
  render(<GeneralRepairIntakeDialog onClose={vi.fn()} onCreated={vi.fn()} />); await fill();
  await choose('Loại phiếu', 'Bảo hành');
  expect((screen.getByLabelText('Chứng từ / điều kiện áp dụng') as HTMLInputElement).required).toBe(true);
  expect((screen.getByRole('checkbox') as HTMLInputElement).required).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Tạo phiếu tiếp nhận' }));
  expect(mocks.create).not.toHaveBeenCalled();
});
it('mở lại sau lỗi mạng thử đúng yêu cầu cũ để không tạo hai phiếu', async () => {
  mocks.create.mockRejectedValueOnce(new Error('Mất kết nối'));
  const first = render(<GeneralRepairIntakeDialog onClose={vi.fn()} onCreated={vi.fn()} />); await fill();
  fireEvent.click(screen.getByRole('button', { name: 'Tạo phiếu tiếp nhận' }));
  await screen.findByText('Mất kết nối');
  const sent = mocks.create.mock.calls[0][0]; first.unmount();
  const onCreated = vi.fn(); render(<GeneralRepairIntakeDialog onClose={vi.fn()} onCreated={onCreated} />);
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại yêu cầu trước' }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
  expect(mocks.create.mock.calls[1][0]).toEqual(sent);
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { RepairTicket } from '../../services/repairService';
const mocks = vi.hoisted(() => ({ balances: vi.fn(), warehouses: vi.fn(), issue: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'staff' }, userProfile: { email: 'staff@example.test' } }) }));
vi.mock('../../services/inventoryReceivingService', () => ({ inventoryReceivingService: { listBalances: mocks.balances, listWarehouses: mocks.warehouses } }));
vi.mock('../../services/repairService', () => ({ repairService: { issuePart: mocks.issue } }));
import GeneralRepairMaterials from './GeneralRepairMaterials';
const ticket = { _id: 'ticket-a', intakeSource: 'external', coverage: { costBearer: 'customer' } } as RepairTicket;
beforeEach(() => {
  sessionStorage.clear(); mocks.issue.mockResolvedValue({});
  mocks.balances.mockResolvedValue([{ _id: 'balance-a', warehouseId: 'warehouse-a', productId: 'product-a', variantId: 'variant-a', productName: 'Dây điện', sku: 'CABLE', trackingMode: 'quantity', quantity: 10.5, reservedQuantity: 0 }]);
  mocks.warehouses.mockResolvedValue([{ _id: 'warehouse-a', name: 'Kho vật tư' }]);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
async function choose() {
  await screen.findByRole('option', { name: /Dây điện.*Kho vật tư/ });
  fireEvent.change(screen.getByLabelText('Vật tư khả dụng trong kho'), { target: { value: 'balance-a' } });
  fireEvent.change(screen.getByLabelText('Số lượng'), { target: { value: '1.25' } });
}
it('xuất số lượng lẻ theo đúng SKU/kho và dùng tên kho trên giao diện', async () => {
  const done = vi.fn(); render(<GeneralRepairMaterials ticket={ticket} onIssued={done} />); await choose();
  fireEvent.click(screen.getByRole('button', { name: 'Xuất vật tư từ kho' }));
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(mocks.issue).toHaveBeenCalledWith('ticket-a', expect.objectContaining({ productId: 'product-a', variantId: 'variant-a', warehouseId: 'warehouse-a', quantity: 1.25, idempotencyKey: expect.any(String) }));
});
it('thử lại sau lỗi mạng giữ khóa và nội dung của lần xuất trước', async () => {
  mocks.issue.mockRejectedValueOnce(new Error('Mất kết nối'));
  const first = render(<GeneralRepairMaterials ticket={ticket} onIssued={vi.fn()} />); await choose();
  fireEvent.click(screen.getByRole('button', { name: 'Xuất vật tư từ kho' })); await screen.findByText('Mất kết nối');
  const payload = mocks.issue.mock.calls[0][1]; first.unmount();
  const done = vi.fn(); render(<GeneralRepairMaterials ticket={ticket} onIssued={done} />);
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại yêu cầu xuất trước' }));
  await waitFor(() => expect(done).toHaveBeenCalledOnce()); expect(mocks.issue.mock.calls[1][1]).toEqual(payload);
});
it('lỗi thiếu tồn cho phép chỉnh yêu cầu, xung đột khóa vẫn giữ để đối soát', async () => {
  mocks.issue.mockRejectedValueOnce(Object.assign(new Error('Không đủ tồn khả dụng'), { status: 409, code: 'INSUFFICIENT_STOCK' }));
  render(<GeneralRepairMaterials ticket={ticket} onIssued={vi.fn()} />); await choose();
  fireEvent.click(screen.getByRole('button', { name: 'Xuất vật tư từ kho' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa yêu cầu' }));
  fireEvent.change(screen.getByLabelText('Số lượng'), { target: { value: '0.5' } });
  mocks.issue.mockRejectedValueOnce(Object.assign(new Error('Khóa đã dùng cho phiếu khác'), { status: 409, code: 'REPAIR_REQUEST_KEY_CONFLICT' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xuất vật tư từ kho' }));
  await screen.findByText('Khóa đã dùng cho phiếu khác'); expect(screen.queryByRole('button', { name: 'Chỉnh sửa yêu cầu' })).toBeNull();
});

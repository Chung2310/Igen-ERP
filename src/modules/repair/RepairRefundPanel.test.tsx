// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RepairRefundPanel from './RepairRefundPanel';
import { repairRefundApi } from './repairRefundApi';
import type { RepairTicket } from '../../services/repairService';
import type { RepairRefundSummary } from '../../../shared/repair-refund';

let branchId = 'b1', canManage = true;
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ userProfile: { role: 'user', uid: 'u1', companyCode: 'ACME' }, hasPermission: (permission: string) => permission === 'repair:read' || canManage }) }));
vi.mock('../../context/BranchContext', () => ({ useBranch: () => ({ activeBranchId: branchId }) }));
vi.mock('./repairRefundApi', () => ({ repairRefundApi: { summary: vi.fn(), vouchers: vi.fn(), submit: vi.fn() } }));
const ticket = { _id: 'ticket-a', ticketCode: 'SC-001', status: 'delivered' } as RepairTicket;
const summary: RepairRefundSummary = { ticketId: ticket._id, ticketCode: ticket.ticketCode, status: 'delivered', totalAmount: 200000, paidAmount: 200000, refundedAmount: 0, netCollected: 200000, remaining: 200000, remainingLabor: 100000, remainingOther: 100000, refunds: [] };
const complete = { status: 'completed' as const, summary: { ...summary, refundedAmount: 80000, netCollected: 120000, remaining: 120000 } };
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); branchId = 'b1'; canManage = true;
  vi.mocked(repairRefundApi.summary).mockResolvedValue(summary);
  vi.mocked(repairRefundApi.vouchers).mockResolvedValue([{ _id: 'voucher-a', key: 'PC-001', amount: 80000, occurredOn: '2026-10-28', description: 'Hoàn dịch vụ' }]);
  vi.mocked(repairRefundApi.submit).mockResolvedValue(complete);
});
afterEach(cleanup);
async function fillAndConfirm() {
  fireEvent.change(await screen.findByLabelText('Phiếu chi đã duyệt'), { target: { value: 'voucher-a' } });
  fireEvent.change(screen.getByLabelText(/Trong đó tiền công/), { target: { value: '40000' } });
  fireEvent.change(screen.getByLabelText('Lý do hoàn tiền'), { target: { value: 'Hoàn dịch vụ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận khoản hoàn' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận hoàn tiền' }));
}
describe('repair refund form', () => {
  it('keeps the exact request after a lost response and recovers it across reopening', async () => {
    vi.mocked(repairRefundApi.submit).mockRejectedValueOnce(new Error('Mất phản hồi'));
    const changed = vi.fn();
    const first = render(<RepairRefundPanel ticket={ticket} onChanged={changed} />);
    await fillAndConfirm();
    expect(await screen.findByText('Mất phản hồi')).toBeTruthy();
    const input = vi.mocked(repairRefundApi.submit).mock.calls[0][3];
    expect(input).toMatchObject({ amount: 80000, laborAmount: 40000, reference: 'PC-001', reason: 'Hoàn dịch vụ' });
    first.unmount();
    render(<RepairRefundPanel ticket={ticket} onChanged={changed} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại khoản hoàn' }));
    await waitFor(() => expect(repairRefundApi.submit).toHaveBeenCalledTimes(2));
    expect(vi.mocked(repairRefundApi.submit).mock.calls[1][3]).toEqual(input);
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(localStorage.length).toBe(0);
  });
  it('leaves an unconfirmed request intact and only clears it after server-confirmed revocation', async () => {
    vi.mocked(repairRefundApi.submit).mockRejectedValueOnce(new Error('Mất phản hồi')).mockResolvedValueOnce({ status: 'not_found' }).mockResolvedValueOnce({ status: 'revoked' });
    render(<RepairRefundPanel ticket={ticket} onChanged={vi.fn()} />);
    await fillAndConfirm();
    await screen.findByRole('button', { name: 'Đối chiếu kết quả' });
    fireEvent.click(screen.getByRole('button', { name: 'Đối chiếu kết quả' }));
    expect(await screen.findByText(/Chưa có bằng chứng/)).toBeTruthy();
    expect(localStorage.length).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi yêu cầu' }));
    const buttons = await screen.findAllByRole('button', { name: 'Thu hồi yêu cầu' });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(localStorage.length).toBe(0));
    expect(await screen.findByLabelText('Phiếu chi đã duyệt')).toBeTruthy();
  });
  it('does not show write controls or fetch finance vouchers without both management permissions', async () => {
    canManage = false;
    render(<RepairRefundPanel ticket={ticket} onChanged={vi.fn()} />);
    expect(await screen.findByText(/Cần quyền xử lý sửa chữa/)).toBeTruthy();
    expect(repairRefundApi.vouchers).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Ghi nhận khoản hoàn' })).toBeNull();
  });
  it('ignores a late response for the previous branch and resets the form scope', async () => {
    let resolveOld!: (value: RepairRefundSummary) => void;
    vi.mocked(repairRefundApi.summary).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const view = render(<RepairRefundPanel ticket={ticket} onChanged={vi.fn()} />);
    branchId = 'b2';
    view.rerender(<RepairRefundPanel ticket={ticket} onChanged={vi.fn()} />);
    await screen.findByLabelText('Phiếu chi đã duyệt');
    await act(async () => { resolveOld({ ...summary, refundedAmount: 199999, remaining: 1 }); });
    expect(screen.queryByText('199.999 ₫')).toBeNull();
    expect(vi.mocked(repairRefundApi.summary).mock.calls[0][2]?.aborted).toBe(true);
  });
  it('does not overwrite a corrupt pending request', async () => {
    const key = `repair-refund:v1:${JSON.stringify(['ACME', 'b1', 'u1', ticket._id])}`;
    localStorage.setItem(key, '{broken');
    render(<RepairRefundPanel ticket={ticket} onChanged={vi.fn()} />);
    await screen.findByRole('alert');
    expect(localStorage.getItem(key)).toBe('{broken');
    expect(repairRefundApi.submit).not.toHaveBeenCalled();
  });
  it('restores a request created in another tab without submitting a different intent automatically', async () => {
    render(<RepairRefundPanel ticket={ticket} onChanged={vi.fn()} />);
    await screen.findByLabelText('Phiếu chi đã duyệt');
    const key = `repair-refund:v1:${JSON.stringify(['ACME', 'b1', 'u1', ticket._id])}`;
    const stored = { idempotencyKey: 'other-tab-request', amount: 50000, laborAmount: 10000, reference: 'PC-OTHER', reason: 'Yêu cầu ở tab khác' };
    localStorage.setItem(key, JSON.stringify(stored));
    await fillAndConfirm();
    expect(await screen.findByText(/Đã khôi phục yêu cầu đang chờ/)).toBeTruthy();
    expect(repairRefundApi.submit).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(stored);
  });
});

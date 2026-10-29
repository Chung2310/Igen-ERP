// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { customerApi } from '../customerApi';
import CustomerTransactionsPanel from './CustomerTransactionsPanel';
import type { CustomerTransactionsResult } from '../../../../shared/customer-transactions';

vi.mock('../customerApi', () => ({ customerApi: { transactions: vi.fn(), transactionDetail: vi.fn() } }));
const result: CustomerTransactionsResult = { items: [{ id: 'sale:order-a', sourceId: 'order-a', kind: 'sale', code: 'DH-001', occurredAt: '2026-10-28T02:00:00Z', status: 'completed', amount: 300000, paidAmount: 300000, dueAmount: 0, description: 'Máy bơm' }], total: 1, page: 1, limit: 20, repairsVisible: true, summary: { charged: 300000, received: 300000, refunded: 0, buybackPaid: 0, outstanding: 0 } };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(customerApi.transactions).mockResolvedValue(result);
  vi.mocked(customerApi.transactionDetail).mockResolvedValue({ item: result.items[0], lines: [{ name: 'Máy bơm', quantity: 1, unitPrice: 300000, total: 300000 }], payments: [], refunds: [] });
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('unified customer transaction history', () => {
  it('requires a branch and applies type/date filters and pagination', async () => {
    const view = render(<CustomerTransactionsPanel customerId="c1" companyCode="ACME" />);
    expect(customerApi.transactions).not.toHaveBeenCalled();
    view.rerender(<CustomerTransactionsPanel customerId="c1" companyCode="ACME" branchId="b1" />);
    await screen.findAllByText('DH-001');
    fireEvent.change(screen.getByLabelText('Loại giao dịch'), { target: { value: 'refund' } });
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-10-28' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xem giao dịch' }));
    await waitFor(() => expect(customerApi.transactions).toHaveBeenLastCalledWith('c1', { companyCode: 'ACME', branchId: 'b1' }, { type: 'refund', from: '2026-10-01', to: '2026-10-28', page: 1, limit: 20 }, expect.any(AbortSignal)));
  });
  it('fetches details only after opening a transaction and restores focus when closed', async () => {
    render(<CustomerTransactionsPanel customerId="c1" companyCode="ACME" branchId="b1" />);
    const buttons = await screen.findAllByRole('button', { name: 'Xem DH-001 Mua hàng' });
    expect(customerApi.transactionDetail).not.toHaveBeenCalled();
    buttons[0].focus(); fireEvent.click(buttons[0]);
    expect(await screen.findByRole('dialog', { name: 'Chi tiết giao dịch' })).toBeTruthy();
    await waitFor(() => expect(customerApi.transactionDetail).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Đóng chi tiết giao dịch' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(buttons[0]);
  });
  it('discards responses from an old branch and can retry a read error', async () => {
    let resolveOld!: (value: CustomerTransactionsResult) => void;
    vi.mocked(customerApi.transactions).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; })).mockRejectedValueOnce(new Error('Mất kết nối'));
    const view = render(<CustomerTransactionsPanel customerId="c1" companyCode="ACME" branchId="b1" />);
    await waitFor(() => expect(customerApi.transactions).toHaveBeenCalledTimes(1));
    view.rerender(<CustomerTransactionsPanel customerId="c1" companyCode="ACME" branchId="b2" />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await screen.findAllByText('DH-001');
    await act(async () => { resolveOld({ ...result, items: [{ ...result.items[0], code: 'OLD-BRANCH' }] }); });
    expect(screen.queryByText('OLD-BRANCH')).toBeNull();
    expect(vi.mocked(customerApi.transactions).mock.calls[0][3]?.aborted).toBe(true);
  });
});

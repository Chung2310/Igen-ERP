// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import CustomerFormDialog from './CustomerFormDialog';
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(cleanup);
it('lưu doanh nghiệp và người liên hệ độc lập với lựa chọn VAT', async () => {
  const onSave = vi.fn(async () => undefined);
  render(<CustomerFormDialog onClose={vi.fn()} onSave={onSave} />);
  fireEvent.click(screen.getByRole('button', { name: 'Đối tượng khách hàng' }));
  fireEvent.click(screen.getByRole('option', { name: 'Doanh nghiệp / tổ chức' }));
  fireEvent.change(screen.getByLabelText(/Tên doanh nghiệp/), { target: { value: 'Công ty A' } });
  fireEvent.change(screen.getByLabelText(/Số điện thoại/), { target: { value: '0901000001' } });
  fireEvent.change(screen.getByLabelText('Người liên hệ'), { target: { value: 'Nguyễn Văn A' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu khách hàng' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ customerKind: 'business', contactName: 'Nguyễn Văn A', type: 'regular' }), undefined));
});

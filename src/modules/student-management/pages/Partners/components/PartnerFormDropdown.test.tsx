// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PartnerFormDropdown } from './PartnerFormDropdown';

const options = [
  { value: '', label: 'Chọn ngân hàng' },
  { value: 'mbbank', label: 'MBBank (MB)' },
  { value: 'bidv', label: 'BIDV' },
];

afterEach(cleanup);

describe('PartnerFormDropdown', () => {
  it('opens a branded list and returns the selected value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PartnerFormDropdown label="Ngân hàng (VietQR)" value="" options={options} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Ngân hàng (VietQR)' }));
    expect(screen.getByRole('listbox', { name: 'Ngân hàng (VietQR)' })).toBeTruthy();
    await user.click(screen.getByRole('option', { name: 'BIDV' }));

    expect(onChange).toHaveBeenCalledWith('bidv');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('supports arrow keys and Escape', async () => {
    const user = userEvent.setup();
    render(<PartnerFormDropdown label="Ngân hàng (VietQR)" value="mbbank" options={options} onChange={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: 'Ngân hàng (VietQR)' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'MBBank (MB)' })).toBe(document.activeElement);
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'BIDV' })).toBe(document.activeElement);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger).toBe(document.activeElement);
  });
});

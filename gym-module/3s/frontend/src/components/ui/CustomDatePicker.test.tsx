// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import CustomDatePicker from './CustomDatePicker';

afterEach(cleanup);

test('cho nhập năm sinh trực tiếp thay vì chuyển từng tháng', () => {
  const onChange = vi.fn();
  render(<CustomDatePicker value="" onChange={onChange} ariaLabel="Ngày sinh" max="2026-11-21" />);

  fireEvent.click(screen.getByRole('button', { name: 'Ngày sinh' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Năm' }), { target: { value: '1996' } });
  fireEvent.click(screen.getByRole('button', { name: '15/11/1996' }));

  expect(onChange).toHaveBeenCalledWith('1996-11-15');
});

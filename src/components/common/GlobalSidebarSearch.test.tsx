// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { GlobalSidebarSearch } from './GlobalSidebarSearch';

afterEach(cleanup);

it('opens a placeholder-free ERP search and navigates from a result', () => {
  window.history.replaceState(null, '', '/nhan-su?sub=chi-nhanh');
  render(<GlobalSidebarSearch />);

  const trigger = screen.getByRole('button', { name: 'Tìm kiếm trong ERP' });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(trigger);

  const input = screen.getByRole('searchbox', { name: 'Tìm kiếm trong ERP' });
  expect(input.getAttribute('type')).toBe('text');
  expect(input.hasAttribute('placeholder')).toBe(false);
  expect(screen.getByRole('button', { name: 'Đóng tìm kiếm' }).className).toContain('bg-surface');
  expect(trigger.getAttribute('aria-expanded')).toBe('true');

  fireEvent.change(input, { target: { value: 'so do to chuc' } });
  fireEvent.click(screen.getByRole('button', { name: /Sơ đồ tổ chức/ }));

  expect(window.location.pathname).toBe('/nhan-su');
  expect(window.location.search).toContain('sub=so-do');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

it('closes with Escape and restores focus to the search button', () => {
  render(<GlobalSidebarSearch />);
  const trigger = screen.getByRole('button', { name: 'Tìm kiếm trong ERP' });
  fireEvent.click(trigger);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('searchbox')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

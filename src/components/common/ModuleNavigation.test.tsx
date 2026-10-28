// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ModuleNavigation, ModuleNavigationButton } from './ModuleNavigation';

afterEach(cleanup);

it('preserves selection, disabled actions and native keyboard focus', () => {
  const change = vi.fn();
  render(<ModuleNavigation label="Mục kiểm tra" activeValue="first">
    <ModuleNavigationButton active onClick={() => change('first')}>Đầu tiên</ModuleNavigationButton>
    <ModuleNavigationButton active={false} onClick={() => change('next')}>Tiếp theo</ModuleNavigationButton>
    <ModuleNavigationButton active={false} disabled onClick={() => change('disabled')}>Chưa khả dụng</ModuleNavigationButton>
  </ModuleNavigation>);
  expect(screen.getByRole('button', { name: 'Đầu tiên' }).getAttribute('aria-current')).toBe('page');
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp theo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Chưa khả dụng' }));
  expect(change.mock.calls).toEqual([['next']]);
  screen.getByRole('button', { name: 'Tiếp theo' }).focus();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tiếp theo' }));
});

it('only exposes scroll controls when overflowing and updates the boundaries', () => {
  render(<ModuleNavigation label="Mục kiểm tra"><ModuleNavigationButton active>Đầu tiên</ModuleNavigationButton></ModuleNavigation>);
  const nav = screen.getByRole('navigation', { name: 'Mục kiểm tra' });
  expect(screen.queryByRole('button', { name: 'Cuộn Mục kiểm tra sang phải' })).toBeNull();
  Object.defineProperties(nav, { clientWidth: { configurable: true, value: 300 }, scrollWidth: { configurable: true, value: 900 } });
  const scrollBy = vi.fn();
  nav.scrollBy = scrollBy;
  fireEvent(window, new Event('resize'));
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cuộn Mục kiểm tra sang trái' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Cuộn Mục kiểm tra sang phải' }));
  expect(scrollBy).toHaveBeenCalledWith({ left: 240, behavior: 'auto' });
  nav.scrollLeft = 600;
  fireEvent.scroll(nav);
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cuộn Mục kiểm tra sang phải' }).disabled).toBe(true);
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cuộn Mục kiểm tra sang trái' }).disabled).toBe(false);
});

it('reveals a changed active item within its own horizontal viewport', () => {
  const items = (active: boolean) => <ModuleNavigation label="Mục kiểm tra" activeValue={active ? 'next' : 'first'}>
    <ModuleNavigationButton active={!active}>Đầu tiên</ModuleNavigationButton>
    <ModuleNavigationButton active={active}>Tiếp theo</ModuleNavigationButton>
  </ModuleNavigation>;
  const { rerender } = render(items(false));
  const nav = screen.getByRole('navigation');
  nav.getBoundingClientRect = () => ({ left: 0, right: 300 } as DOMRect);
  screen.getByRole('button', { name: 'Tiếp theo' }).getBoundingClientRect = () => ({ left: 400, right: 520 } as DOMRect);
  rerender(items(true));
  expect(nav.scrollLeft).toBe(220);
});

it('keeps the user scroll position when a parent refreshes with the same selection', () => {
  const items = () => <ModuleNavigation label="Mục kiểm tra" activeValue="first">
    <ModuleNavigationButton active>Đầu tiên</ModuleNavigationButton>
    <ModuleNavigationButton active={false}>Tiếp theo</ModuleNavigationButton>
  </ModuleNavigation>;
  const { rerender } = render(items());
  const nav = screen.getByRole('navigation');
  nav.getBoundingClientRect = () => ({ left: 0, right: 300 } as DOMRect);
  screen.getByRole('button', { name: 'Đầu tiên' }).getBoundingClientRect = () => ({ left: -220, right: -100 } as DOMRect);
  nav.scrollLeft = 220;
  rerender(items());
  expect(nav.scrollLeft).toBe(220);
});

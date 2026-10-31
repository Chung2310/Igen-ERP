// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ModuleNavigation, ModuleNavigationButton } from './ModuleNavigation';

afterEach(cleanup);

it('preserves selection, disabled actions and native keyboard focus', () => {
  const change = vi.fn();
  render(
    <ModuleNavigation label="Mục kiểm tra" activeValue="first">
      <ModuleNavigationButton active onClick={() => change('first')}>Đầu tiên</ModuleNavigationButton>
      <ModuleNavigationButton active={false} onClick={() => change('next')}>Tiếp theo</ModuleNavigationButton>
      <ModuleNavigationButton active={false} disabled onClick={() => change('disabled')}>Chưa khả dụng</ModuleNavigationButton>
    </ModuleNavigation>
  );
  expect(screen.getByRole('button', { name: 'Đầu tiên' }).getAttribute('aria-current')).toBe('page');
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp theo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Chưa khả dụng' }));
  expect(change.mock.calls).toEqual([['next']]);
  screen.getByRole('button', { name: 'Tiếp theo' }).focus();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tiếp theo' }));
});

it('renders a clean flat navigation bar without chevron buttons and supports wheel scroll', () => {
  render(
    <ModuleNavigation label="Mục kiểm tra">
      <ModuleNavigationButton active>Đầu tiên</ModuleNavigationButton>
      <ModuleNavigationButton active={false}>Thứ hai</ModuleNavigationButton>
    </ModuleNavigation>
  );
  expect(screen.queryByRole('button', { name: /Cuộn .* sang trái/i })).toBeNull();
  expect(screen.queryByRole('button', { name: /Cuộn .* sang phải/i })).toBeNull();

  const nav = screen.getByRole('navigation', { name: 'Mục kiểm tra' });
  expect(nav).toBeDefined();

  // Test mouse wheel horizontal scrolling
  nav.scrollLeft = 0;
  fireEvent.wheel(nav, { deltaY: 100, deltaX: 0 });
  expect(nav.scrollLeft).toBe(100);
});

it('reveals a changed active item within its own horizontal viewport', () => {
  const items = (active: boolean) => (
    <ModuleNavigation label="Mục kiểm tra" activeValue={active ? 'next' : 'first'}>
      <ModuleNavigationButton active={!active}>Đầu tiên</ModuleNavigationButton>
      <ModuleNavigationButton active={active}>Tiếp theo</ModuleNavigationButton>
    </ModuleNavigation>
  );
  const { rerender } = render(items(false));
  const nav = screen.getByRole('navigation');
  nav.getBoundingClientRect = () => ({ left: 0, right: 300 } as DOMRect);
  screen.getByRole('button', { name: 'Tiếp theo' }).getBoundingClientRect = () => ({ left: 400, right: 520 } as DOMRect);
  rerender(items(true));
  expect(nav.scrollLeft).toBe(220);
});

it('keeps the user scroll position when a parent refreshes with the same selection', () => {
  const items = () => (
    <ModuleNavigation label="Mục kiểm tra" activeValue="first">
      <ModuleNavigationButton active>Đầu tiên</ModuleNavigationButton>
      <ModuleNavigationButton active={false}>Tiếp theo</ModuleNavigationButton>
    </ModuleNavigation>
  );
  const { rerender } = render(items());
  const nav = screen.getByRole('navigation');
  nav.getBoundingClientRect = () => ({ left: 0, right: 300 } as DOMRect);
  screen.getByRole('button', { name: 'Đầu tiên' }).getBoundingClientRect = () => ({ left: -220, right: -100 } as DOMRect);
  nav.scrollLeft = 220;
  rerender(items());
  expect(nav.scrollLeft).toBe(220);
});

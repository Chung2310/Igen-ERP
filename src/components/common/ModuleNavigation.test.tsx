// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ModuleNavigation, ModuleNavigationButton } from './ModuleNavigation';

afterEach(cleanup);

it('keeps calendar navigation horizontal without a left rail toggle', () => {
  render(
    <ModuleNavigation label="Mục Lịch" layout="horizontal">
      <ModuleNavigationButton active>Lịch trình</ModuleNavigationButton>
    </ModuleNavigation>
  );
  const bar = screen.getByRole('navigation', { name: 'Mục Lịch' }).parentElement?.parentElement;
  expect(bar?.getAttribute('data-layout')).toBe('horizontal');
  expect(screen.queryByRole('button', { name: 'Thu gọn thanh điều hướng' })).toBeNull();
  expect(bar?.style.getPropertyValue('--module-navigation-left')).toBe('');
});

it('preserves selection, disabled actions and native keyboard focus', () => {
  const change = vi.fn();
  render(
    <ModuleNavigation label="Mục kiểm tra" activeValue="first">
      <ModuleNavigationButton active onClick={() => change('first')}>Đầu tiên</ModuleNavigationButton>
      <ModuleNavigationButton active={false} onClick={() => change('next')}>Tiếp theo</ModuleNavigationButton>
      <ModuleNavigationButton active={false} disabled onClick={() => change('disabled')}>Chưa khả dụng</ModuleNavigationButton>
    </ModuleNavigation>
  );
  const activeButton = screen.getByRole('button', { name: 'Đầu tiên' });
  expect(activeButton.getAttribute('aria-current')).toBe('page');
  expect(activeButton.className).toContain('bg-primary/5');
  expect(activeButton.className).toContain('text-primary');
  expect(screen.queryByRole('link', { name: 'Chức năng' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp theo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Chưa khả dụng' }));
  expect(change.mock.calls).toEqual([['next']]);
  screen.getByRole('button', { name: 'Tiếp theo' }).focus();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tiếp theo' }));
});

it('collapses and reopens the left rail without removing tab names or actions', () => {
  const change = vi.fn();
  render(
    <ModuleNavigation label="Mục kiểm tra">
      <ModuleNavigationButton active icon={<span>●</span>} onClick={change}>Đầu tiên</ModuleNavigationButton>
    </ModuleNavigation>
  );
  const rail = screen.getByRole('navigation', { name: 'Mục kiểm tra' }).parentElement?.parentElement;
  const collapse = screen.getByRole('button', { name: 'Thu gọn thanh điều hướng' });
  expect(collapse.getAttribute('aria-controls')).toBe(screen.getByRole('navigation').id);
  expect(collapse.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(collapse);
  expect(rail?.getAttribute('data-collapsed')).toBe('true');
  expect(screen.getByRole('button', { name: 'Mở rộng thanh điều hướng' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'Đầu tiên' }).getAttribute('title')).toBe('Đầu tiên');
  fireEvent.click(screen.getByRole('button', { name: 'Đầu tiên' }));
  expect(change).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Mở rộng thanh điều hướng' }));
  expect(rail?.getAttribute('data-collapsed')).toBe('false');
});

it('keeps the rail within the visible page height while content extends below the viewport', () => {
  const page = document.createElement('main');
  page.id = 'primary_page_container';
  page.getBoundingClientRect = () => ({ top: 72, bottom: 900 } as DOMRect);
  const workspace = document.createElement('div');
  workspace.getBoundingClientRect = () => ({ top: 80, bottom: 1600, left: 8 } as DOMRect);
  page.appendChild(workspace);
  document.body.appendChild(page);

  render(
    <ModuleNavigation label="Mục kiểm tra">
      <ModuleNavigationButton active>Đầu tiên</ModuleNavigationButton>
    </ModuleNavigation>,
    { container: workspace }
  );

  const rail = workspace.querySelector<HTMLElement>('[data-module-navigation]');
  expect(rail?.style.getPropertyValue('--module-navigation-left')).toBe('8px');
  expect(rail?.style.getPropertyValue('--module-navigation-top')).toBe('80px');
  expect(rail?.style.getPropertyValue('--module-navigation-height')).toBe(`${Math.min(892, window.innerHeight - 8) - 80}px`);
  page.remove();
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

it('scrolls vertically and reveals the active item in the left rail', () => {
  const { rerender } = render(
    <ModuleNavigation label="Mục kiểm tra" activeValue="first">
      <ModuleNavigationButton active>Đầu tiên</ModuleNavigationButton>
      <ModuleNavigationButton active={false}>Tiếp theo</ModuleNavigationButton>
    </ModuleNavigation>
  );
  const nav = screen.getByRole('navigation');
  nav.style.flexDirection = 'column';
  nav.scrollTop = 0;
  fireEvent.wheel(nav, { deltaY: 100 });
  expect(nav.scrollTop).toBe(100);
  nav.getBoundingClientRect = () => ({ top: 0, bottom: 100 } as DOMRect);
  screen.getByRole('button', { name: 'Tiếp theo' }).getBoundingClientRect = () => ({ top: 130, bottom: 175 } as DOMRect);
  rerender(
    <ModuleNavigation label="Mục kiểm tra" activeValue="next">
      <ModuleNavigationButton active={false}>Đầu tiên</ModuleNavigationButton>
      <ModuleNavigationButton active>Tiếp theo</ModuleNavigationButton>
    </ModuleNavigation>
  );
  expect(nav.scrollTop).toBe(175);
});

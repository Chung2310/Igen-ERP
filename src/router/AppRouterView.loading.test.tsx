// @vitest-environment jsdom
import React, { lazy } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { UserProfile } from '../types';
import { AppRouterView } from './AppRouterView';

const mock = vi.hoisted(() => ({ route: { component: null as unknown, canAccess: undefined as ((profile: unknown) => boolean) | undefined }, retry: vi.fn() }));
vi.mock('./route-config', () => ({ getRouteByTab: () => mock.route, retryRoute: mock.retry }));
const profile = { uid: 'u1', companyCode: 'ACME', role: 'admin' } as UserProfile;
beforeEach(() => { vi.clearAllMocks(); mock.route.canAccess = undefined; });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
it('keeps the shell available after a route exception and recovers on retry', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mock.route.component = () => { throw new Error('Failed to fetch module'); };
  mock.retry.mockImplementation(() => { mock.route.component = () => <p>Page ready</p>; });
  render(<><nav>Sidebar available</nav><AppRouterView activeTab="TỔNG QUAN" userProfile={profile} /></>);
  expect(screen.getByText('Sidebar available')).toBeTruthy();
  expect(screen.getByRole('alert')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại phân hệ' }));
  expect(await screen.findByText('Page ready')).toBeTruthy();
});
it('offers recovery when a lazy module never settles', async () => {
  vi.useFakeTimers();
  mock.route.component = lazy(() => new Promise(() => {}));
  render(<AppRouterView activeTab="TỔNG QUAN" userProfile={profile} />);
  expect(screen.getByRole('status').textContent).toContain('Đang tải');
  await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
  expect(screen.getByText('Tải phân hệ lâu hơn dự kiến')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Thử lại phân hệ' })).toBeTruthy();
});
it('never mounts a page after its route access is revoked', () => {
  const page = vi.fn(() => <p>Private content</p>);
  mock.route.component = page; mock.route.canAccess = () => false;
  render(<AppRouterView activeTab="TỔNG QUAN" userProfile={profile} />);
  expect(page).not.toHaveBeenCalled();
  expect(screen.queryByText('Private content')).toBeNull();
});

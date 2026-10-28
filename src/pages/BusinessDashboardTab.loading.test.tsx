// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import BusinessDashboardTab from './BusinessDashboardTab';
import { dashboardService } from '../services/dashboardService';

let branchId = 'b1', userId = 'u1', nextUser = 0;
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ userProfile: { uid: userId, companyCode: 'ACME', role: 'admin', enabledModules: ['hr'], permissions: ['*'] }, hasPermission: () => true }) }));
vi.mock('../context/BranchContext', () => ({ useBranch: () => ({ activeBranchId: branchId }) }));
vi.mock('../services/dashboardService', () => ({ dashboardService: { getSummary: vi.fn() } }));
vi.mock('../services/authService', () => ({ authService: { getAllUsers: async () => [], getUsersByCompany: async () => [] } }));
vi.mock('../services/hrDepartmentService', () => ({ hrDepartmentService: { list: async () => [] } }));
vi.mock('../components/dashboard/PersonnelToday', () => ({ PersonnelToday: () => null }));
vi.mock('../components/dashboard/EnterpriseOverviewDashboard', () => ({ EnterpriseOverviewDashboard: ({ summary, loading, error }: { summary: { marker: number } | null; loading: boolean; error: boolean }) => <output aria-label="Summary">{summary?.marker || 0}|{String(loading)}|{String(error)}</output> }));
const data = (marker: number) => ({ marker }) as unknown as Awaited<ReturnType<typeof dashboardService.getSummary>>;
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); branchId = 'b1'; userId = `user-${++nextUser}`;
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  vi.mocked(dashboardService.getSummary).mockResolvedValue(data(7));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('keeps existing figures visible and prevents overlapping background polls', async () => {
  let complete!: (value: ReturnType<typeof data>) => void;
  vi.mocked(dashboardService.getSummary).mockResolvedValueOnce(data(7)).mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
  render(<BusinessDashboardTab />); await act(async () => {});
  expect(screen.getByLabelText('Summary').textContent).toBe('7|false|false');
  await act(async () => { await vi.advanceTimersByTimeAsync(90000); });
  expect(dashboardService.getSummary).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText('Summary').textContent).toBe('7|false|false');
  await act(async () => { complete(data(9)); });
  expect(screen.getByLabelText('Summary').textContent).toBe('9|false|false');
});
it('reuses a fresh result after leaving the page, but fetches separately for another branch', async () => {
  const first = render(<BusinessDashboardTab />); await act(async () => {}); first.unmount();
  const second = render(<BusinessDashboardTab />); await act(async () => {});
  expect(dashboardService.getSummary).toHaveBeenCalledOnce();
  expect(screen.getByLabelText('Summary').textContent).toBe('7|false|false');
  branchId = 'b2'; second.rerender(<BusinessDashboardTab />); await act(async () => {});
  expect(dashboardService.getSummary).toHaveBeenCalledTimes(2);
  expect(vi.mocked(dashboardService.getSummary).mock.calls[1][1]).toMatchObject({ branchId: 'b2' });
});
it('keeps the last successful figures and announces a failed background update', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(dashboardService.getSummary).mockResolvedValueOnce(data(7)).mockRejectedValueOnce(new Error('Offline'));
  render(<BusinessDashboardTab />); await act(async () => {});
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(screen.getByLabelText('Summary').textContent).toBe('7|false|false');
  expect(screen.getByText(/Đang hiển thị dữ liệu đã tải/)).toBeTruthy();
  vi.restoreAllMocks();
});

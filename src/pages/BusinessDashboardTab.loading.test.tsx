// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import BusinessDashboardTab from './BusinessDashboardTab';
import { dashboardService } from '../services/dashboardService';

let branchId = 'b1', userId = 'u1', nextUser = 0, branchLoading = false, branchError = '';
const retryBranch = vi.fn();
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ userProfile: { uid: userId, companyCode: 'ACME', role: 'admin', enabledModules: ['hr'], permissions: ['*'] }, hasPermission: () => true }) }));
vi.mock('../context/BranchContext', () => ({ useBranch: () => ({ activeBranchId: branchId, loading: branchLoading, error: branchError, retry: retryBranch }) }));
vi.mock('../services/dashboardService', () => ({ dashboardService: { getBusinessOverview: vi.fn() } }));
vi.mock('../components/dashboard/BusinessOverviewDashboard', () => ({ BusinessOverviewDashboard: ({ data: summary, loading }: { data: { marker: number } | null; loading: boolean }) => <output aria-label="Summary">{summary?.marker || 0}|{String(loading)}|false</output> }));
const data = (marker: number) => ({ marker, businessType: 'education', generatedAt: '2026-10-28T08:00:00Z' }) as unknown as Awaited<ReturnType<typeof dashboardService.getBusinessOverview>>;
beforeEach(() => {
  vi.clearAllMocks(); retryBranch.mockReset(); vi.useFakeTimers(); branchId = 'b1'; branchLoading = false; branchError = ''; userId = `user-${++nextUser}`;
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  vi.mocked(dashboardService.getBusinessOverview).mockResolvedValue(data(7));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('keeps existing figures visible and prevents overlapping background polls', async () => {
  let complete!: (value: ReturnType<typeof data>) => void;
  vi.mocked(dashboardService.getBusinessOverview).mockResolvedValueOnce(data(7)).mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
  render(<BusinessDashboardTab />); await act(async () => {});
  expect(screen.getByLabelText('Summary').textContent).toBe('7|false|false');
  await act(async () => { await vi.advanceTimersByTimeAsync(90000); });
  expect(dashboardService.getBusinessOverview).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText('Summary').textContent).toBe('7|false|false');
  await act(async () => { complete(data(9)); });
  expect(screen.getByLabelText('Summary').textContent).toBe('9|false|false');
});
it('reuses a fresh result after leaving the page, but fetches separately for another branch', async () => {
  const first = render(<BusinessDashboardTab />); await act(async () => {}); first.unmount();
  const second = render(<BusinessDashboardTab />); await act(async () => {});
  expect(dashboardService.getBusinessOverview).toHaveBeenCalledOnce();
  expect(screen.getByLabelText('Summary').textContent).toBe('7|false|false');
  branchId = 'b2'; second.rerender(<BusinessDashboardTab />); await act(async () => {});
  expect(dashboardService.getBusinessOverview).toHaveBeenCalledTimes(2);
  expect(vi.mocked(dashboardService.getBusinessOverview).mock.calls[1][2]).toMatchObject({ branchId: 'b2' });
});
it('keeps the last successful figures and announces a failed background update', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(dashboardService.getBusinessOverview).mockResolvedValueOnce(data(7)).mockRejectedValueOnce(new Error('Offline'));
  render(<BusinessDashboardTab />); await act(async () => {});
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(screen.getByLabelText('Summary').textContent).toBe('7|false|false');
  expect(screen.getByText(/Đang hiển thị dữ liệu đã tải/)).toBeTruthy();
  vi.restoreAllMocks();
});

it('aborts the old branch request and hides its figures before the next response arrives', async () => {
  let previous!: (value: ReturnType<typeof data>) => void;
  let current!: (value: ReturnType<typeof data>) => void;
  vi.mocked(dashboardService.getBusinessOverview).mockImplementationOnce(() => new Promise(resolve => { previous = resolve; })).mockImplementationOnce(() => new Promise(resolve => { current = resolve; }));
  const view = render(<BusinessDashboardTab />); await act(async () => {});
  const oldSignal = vi.mocked(dashboardService.getBusinessOverview).mock.calls[0][2]?.signal;
  branchId = 'b2'; view.rerender(<BusinessDashboardTab />); await act(async () => {});
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => { previous(data(99)); });
  expect(screen.getByLabelText('Summary').textContent).toBe('0|true|false');
  await act(async () => { current(data(8)); });
  expect(screen.getByLabelText('Summary').textContent).toBe('8|false|false');
});

it('does not issue unresolved branch reads and exposes branch failure', async () => {
  branchLoading = true;
  const view = render(<BusinessDashboardTab />); await act(async () => {});
  expect(dashboardService.getBusinessOverview).not.toHaveBeenCalled();
  branchLoading = false; branchError = 'Không tải được chi nhánh'; view.rerender(<BusinessDashboardTab />); await act(async () => {});
  expect(screen.getByRole('alert').textContent).toContain(branchError);
  expect(dashboardService.getBusinessOverview).not.toHaveBeenCalled();
});

it('allows an initial failed read to recover from the retry button', async () => {
  vi.mocked(dashboardService.getBusinessOverview).mockRejectedValueOnce(new Error('Không thể tải tổng quan')).mockResolvedValueOnce(data(8));
  render(<BusinessDashboardTab />); await act(async () => {});
  expect(screen.getByRole('alert').textContent).toContain('Không thể tải tổng quan');
  await act(async () => { screen.getByRole('button', { name: 'Thử lại' }).click(); });
  expect(screen.getByLabelText('Summary').textContent).toBe('8|false|false');
});
it('retries branch resolution before trying the dashboard again', async () => {
  branchError = 'Không tải được chi nhánh';
  retryBranch.mockImplementation(() => { branchError = ''; });
  render(<BusinessDashboardTab />); await act(async () => {});
  await act(async () => { screen.getByRole('button', { name: 'Thử lại' }).click(); });
  expect(retryBranch).toHaveBeenCalledOnce();
  expect(dashboardService.getBusinessOverview).toHaveBeenCalledOnce();
  expect(screen.getByLabelText('Summary').textContent).toBe('7|false|false');
});

it('updates the selected calendar period when a tab stays open across Vietnam midnight', async () => {
  vi.setSystemTime(new Date('2026-10-31T16:59:50Z'));
  render(<BusinessDashboardTab />); await act(async () => {});
  expect(vi.mocked(dashboardService.getBusinessOverview).mock.calls[0].slice(0, 2)).toEqual(['2026-10-01', '2026-10-31']);
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(vi.mocked(dashboardService.getBusinessOverview).mock.calls.at(-1)?.slice(0, 2)).toEqual(['2026-11-01', '2026-11-01']);
});

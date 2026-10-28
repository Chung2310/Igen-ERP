// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BranchProvider, useBranch } from './BranchContext';
import { branchService, type BranchRecord } from '../services/branchService';

let profile = { uid: 'u1', companyCode: 'ACME', role: 'admin', branchId: '' };
vi.mock('./AuthContext', () => ({ useAuth: () => ({ userProfile: profile }) }));
vi.mock('../services/branchService', () => ({ branchService: { list: vi.fn() } }));
function Probe() { const value = useBranch(); return <><output>{value.loading ? 'loading' : value.error || value.activeBranchId}</output><button onClick={value.retry}>Retry</button></>; }
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); profile = { uid: 'u1', companyCode: 'ACME', role: 'admin', branchId: '' }; });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const branch = (id: string) => ({ _id: id, isActive: true }) as BranchRecord;
it('times out a stalled branch read and lets the user retry', async () => {
  vi.useFakeTimers();
  vi.mocked(branchService.list).mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue([branch('b1')]);
  render(<BranchProvider><Probe /></BranchProvider>);
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(screen.getByText(/Tải chi nhánh quá lâu/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await act(async () => {});
  expect(screen.getByText('b1')).toBeTruthy();
});
it('aborts the old company request and ignores its late branch selection', async () => {
  let complete!: (value: BranchRecord[]) => void;
  vi.mocked(branchService.list).mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; })).mockResolvedValue([branch('b2')]);
  const view = render(<BranchProvider><Probe /></BranchProvider>);
  await waitFor(() => expect(branchService.list).toHaveBeenCalledOnce());
  const firstSignal = vi.mocked(branchService.list).mock.calls[0][0];
  profile = { ...profile, companyCode: 'OTHER' }; view.rerender(<BranchProvider><Probe /></BranchProvider>);
  await screen.findByText('b2');
  await act(async () => { complete([branch('b1')]); });
  expect(firstSignal?.aborted).toBe(true);
  expect(screen.getByText('b2')).toBeTruthy();
  expect(localStorage.getItem('igen.activeBranch.ACME')).toBeNull();
});
it('uses an assigned staff branch without making an admin-only request', () => {
  profile = { ...profile, role: 'user', branchId: 'staff-branch' };
  render(<BranchProvider><Probe /></BranchProvider>);
  expect(screen.getByText('staff-branch')).toBeTruthy();
  expect(branchService.list).not.toHaveBeenCalled();
});

it('never attaches a branch saved by an admin to a staff request', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => new Response('{}'));
  vi.stubGlobal('fetch', fetcher);
  localStorage.setItem('igen.activeBranch.ACME', 'admin-branch');
  profile = { ...profile, role: 'user', branchId: 'staff-branch' };
  function ChildRequest() { React.useEffect(() => { void fetch('/api/v1/students'); }, []); return null; }
  render(<BranchProvider><Probe /><ChildRequest /></BranchProvider>);
  await act(async () => {});
  expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('x-branch-id')).toBe('staff-branch');
  expect(localStorage.getItem('igen.activeBranch.ACME')).toBe('admin-branch');
});

it('updates the request branch when switching from an admin to a staff account in the same company', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => new Response('{}'));
  vi.stubGlobal('fetch', fetcher);
  vi.mocked(branchService.list).mockResolvedValue([branch('admin-branch')]);
  const view = render(<BranchProvider><Probe /></BranchProvider>);
  await screen.findByText('admin-branch');
  profile = { ...profile, uid: 'staff-user', role: 'user', branchId: 'staff-branch' };
  view.rerender(<BranchProvider><Probe /></BranchProvider>);
  await fetch('/api/v1/timekeeping/today');
  expect(new Headers(fetcher.mock.calls.at(-1)?.[1]?.headers).get('x-branch-id')).toBe('staff-branch');
});

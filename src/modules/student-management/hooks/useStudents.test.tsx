// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../lib/api';
import { useStudents } from './useStudents';
import { clearStudentListCache } from './studentListCache';

let activeBranchId = 'b1';
let branchLoading = false;
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ userProfile: { uid: 'u1', companyCode: 'ACME' } }) }));
vi.mock('../../../context/BranchContext', () => ({ useBranch: () => ({ activeBranchId, loading: branchLoading }) }));
vi.mock('../lib/api', () => ({ apiFetch: vi.fn(), getBusinessApiScope: () => 'student' }));

beforeEach(() => { vi.resetAllMocks(); clearStudentListCache(); activeBranchId = 'b1'; branchLoading = false; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('student list loading', () => {
  it('loads every server page instead of silently stopping at one thousand records', async () => {
    vi.mocked(apiFetch).mockImplementation(async (endpoint) => {
      const page = Number(new URL(endpoint, 'http://qa.test').searchParams.get('page'));
      return { success: true, total: 1001, students: Array.from({ length: page === 5 ? 1 : 250 }, (_, index) => ({ _id: `s-${(page - 1) * 250 + index}` })) };
    });
    const { result } = renderHook(() => useStudents());
    await waitFor(() => expect(result.current.students).toHaveLength(1001));
    expect(apiFetch).toHaveBeenCalledTimes(5);
    expect(result.current.loading).toBe(false);
  });
  it('reuses a short-lived same-scope result on remount and bypasses it on explicit refresh', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true, total: 1, students: [{ _id: 's1' }] });
    const first = renderHook(() => useStudents());
    await waitFor(() => expect(first.result.current.students).toHaveLength(1)); first.unmount();
    const second = renderHook(() => useStudents());
    await waitFor(() => expect(second.result.current.students).toHaveLength(1));
    expect(apiFetch).toHaveBeenCalledOnce();
    await act(async () => { await second.result.current.refetch(); });
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
  it('does not present a truncated or duplicated list as a complete result', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ success: true, total: 2, students: [{ _id: 's1' }] }).mockResolvedValueOnce({ success: true, total: 2, students: [] });
    const { result } = renderHook(() => useStudents());
    await waitFor(() => expect(result.current.error).toContain('chưa tải đủ'));
    expect(result.current.students).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
  it('does not load while disabled or while branches are being resolved', async () => {
    branchLoading = true;
    vi.mocked(apiFetch).mockResolvedValue({ success: true, students: [] });
    const { rerender } = renderHook(({ enabled }) => useStudents(undefined, 'branch', enabled), { initialProps: { enabled: false } });
    await act(async () => {});
    expect(apiFetch).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await act(async () => {});
    expect(apiFetch).not.toHaveBeenCalled();
    branchLoading = false;
    rerender({ enabled: true });
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
  });

  it('discards the previous branch response and aborts its request', async () => {
    let completeOld!: (value: unknown) => void;
    vi.mocked(apiFetch).mockImplementationOnce(() => new Promise((resolve) => { completeOld = resolve; }));
    vi.mocked(apiFetch).mockResolvedValue({ success: true, students: [{ _id: 'b2-student' }] });
    const { result, rerender } = renderHook(() => useStudents());
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    const firstSignal = vi.mocked(apiFetch).mock.calls[0][1]?.signal;
    activeBranchId = 'b2';
    rerender();
    await waitFor(() => expect(result.current.students[0]?.id).toBe('b2-student'));
    expect(firstSignal?.aborted).toBe(true);
    expect(apiFetch).toHaveBeenLastCalledWith('/students?page=1&limit=250', expect.objectContaining({ headers: { 'x-branch-id': 'b2' } }));
    await act(async () => { completeOld({ success: true, students: [{ _id: 'b1-student' }] }); });
    expect(result.current.students[0]?.id).toBe('b2-student');
  });

  it('exposes an error and recovers through refetch without remounting', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({ success: true, students: [{ _id: 's1' }] });
    const { result } = renderHook(() => useStudents());
    await waitFor(() => expect(result.current.error).toBe('Offline'));
    expect(result.current.loading).toBe(false);
    await act(async () => { await result.current.refetch(); });
    expect(result.current.students[0]?.id).toBe('s1');
    expect(result.current.error).toBe('');
  });

  it('ends the loading state when the read request never settles', async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useStudents());
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toContain('quá lâu');
    expect(vi.mocked(apiFetch).mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
});

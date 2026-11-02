// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../lib/api';
import { useStudentCollection } from './useStudentCollection';
import { useBatches } from './useBatches';
import { useCourses } from './useCourses';
import { useExams } from './useExams';
import { useResources } from './useResources';
import { useCourseCategories } from './useCourseCategories';
import { useResourceCategories } from './useResourceCategories';
import { useSchedule } from './useSchedule';

let branchId = 'b1', branchLoading = false, branchError = '', userId = 'u1';
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ userProfile: { uid: userId, companyCode: 'ACME', role: 'admin', permissions: ['*'] } }) }));
vi.mock('../../../context/BranchContext', () => ({ useBranch: () => ({ activeBranchId: branchId, loading: branchLoading, error: branchError }) }));
vi.mock('../lib/api', () => ({ apiFetch: vi.fn(), getBusinessApiScope: () => 'student' }));
beforeEach(() => { vi.resetAllMocks(); branchId = 'b1'; branchLoading = false; branchError = ''; userId = 'u1'; });
afterEach(() => { cleanup(); vi.useRealTimers(); });
const useList = () => useStudentCollection<{ id: string }>('/courses', 'courses', 'course-mutation', 'khóa học');

describe('scoped student collections', () => {
  it('cancels the previous branch and hides obsolete rows before the new read finishes', async () => {
    let old!: (value: unknown) => void;
    vi.mocked(apiFetch).mockImplementationOnce(() => new Promise((resolve) => { old = resolve; })).mockResolvedValueOnce({ success: true, courses: [{ _id: 'new-branch' }] });
    const view = renderHook(useList);
    await waitFor(() => expect(apiFetch).toHaveBeenCalledOnce());
    const signal = vi.mocked(apiFetch).mock.calls[0][1]?.signal;
    branchId = 'b2'; view.rerender();
    expect(view.result.current.items).toEqual([]);
    await waitFor(() => expect(view.result.current.items[0]?.id).toBe('new-branch'));
    await act(async () => { old({ success: true, courses: [{ _id: 'old-branch' }] }); });
    expect(signal?.aborted).toBe(true);
    expect(view.result.current.items[0]?.id).toBe('new-branch');
    expect(vi.mocked(apiFetch).mock.calls[1][1]?.headers).toEqual({ 'x-branch-id': 'b2' });
  });
  it('does not refetch just because the profile object is recreated', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true, courses: [] });
    const view = renderHook(useList);
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    view.rerender(); await act(async () => {});
    expect(apiFetch).toHaveBeenCalledOnce();
  });
  it('waits for branch resolution and exposes an error rather than sending a request with an unresolved branch', async () => {
    branchLoading = true;
    const view = renderHook(useList); await act(async () => {});
    expect(apiFetch).not.toHaveBeenCalled();
    branchLoading = false; branchError = 'Không tải được chi nhánh'; view.rerender(); await act(async () => {});
    expect(view.result.current.error).toBe(branchError);
    expect(view.result.current.loading).toBe(false);
    expect(apiFetch).not.toHaveBeenCalled();
  });
  it('times out a hung request and can recover after the browser comes online', async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue({ success: true, courses: [{ _id: 's1' }] });
    const view = renderHook(useList);
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(view.result.current.loading).toBe(false);
    expect(view.result.current.error).toContain('quá lâu');
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(view.result.current.items).toEqual([{ _id: 's1', id: 's1' }]);
    expect(view.result.current.error).toBe('');
  });
  it('rejects malformed responses instead of presenting a failed read as an empty list', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true, courses: null });
    const view = renderHook(useList);
    await waitFor(() => expect(view.result.current.error).toContain('Không thể tải'));
    expect(view.result.current.loading).toBe(false);
  });
  it('removes event listeners and aborts its read on unmount', async () => {
    vi.mocked(apiFetch).mockImplementation(() => new Promise(() => {}));
    const view = renderHook(useList); await waitFor(() => expect(apiFetch).toHaveBeenCalledOnce());
    const signal = vi.mocked(apiFetch).mock.calls[0][1]?.signal;
    view.unmount(); window.dispatchEvent(new Event('course-mutation')); window.dispatchEvent(new Event('online'));
    expect(signal?.aborted).toBe(true);
    expect(apiFetch).toHaveBeenCalledOnce();
  });
});

it('keeps each collection endpoint, ID mapping, booking mapping and schedule dates compatible', async () => {
  vi.mocked(apiFetch).mockImplementation(async (endpoint) => {
    if (endpoint.startsWith('/batches')) return { success: true, batches: [{ _id: 'b1' }] };
    if (endpoint.startsWith('/exams')) return { success: true, exams: [{ _id: 'e1' }] };
    if (endpoint.startsWith('/schedule')) return { success: true, events: [{ id: 'event1', date: '2026-10-28' }] };
    if (endpoint.includes('/categories')) return { success: true, data: [{ _id: 'cat1', name: 'Phân loại' }] };
    if (endpoint.startsWith('/student-resources')) return { success: true, resources: [{ _id: 'r1', bookings: [{ _id: 'booking1' }] }] };
    return { success: true, courses: [{ _id: 'c1' }] };
  });
  const view = renderHook(() => ({ batches: useBatches('ACME'), courses: useCourses('ACME'), exams: useExams('ACME'), resources: useResources(), courseCategories: useCourseCategories('ACME'), resourceCategories: useResourceCategories(), schedule: useSchedule('2026-10-01', '2026-10-31', 'ACME') }));
  await waitFor(() => expect(view.result.current.schedule.loading).toBe(false));
  expect(view.result.current.batches.batches[0].id).toBe('b1');
  expect(view.result.current.courses.courses[0].id).toBe('c1');
  expect(view.result.current.exams.exams[0].id).toBe('e1');
  expect(view.result.current.resources.resources[0].bookings[0].id).toBe('booking1');
  expect(view.result.current.courseCategories.categories[0]).toEqual({ id: 'cat1', name: 'Phân loại' });
  expect(view.result.current.resourceCategories.categories[0].id).toBe('cat1');
  expect(view.result.current.schedule.events[0].id).toBe('event1');
  expect(vi.mocked(apiFetch).mock.calls.map(([url]) => url)).toContain('/schedule?from=2026-10-01&to=2026-10-31&ownerFilter=ACME');
});

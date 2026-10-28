import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useBranch } from '../../../context/BranchContext';
import { withRequestTimeout } from '../../../utils/requestTimeout';
import { apiFetch, getBusinessApiScope } from '../lib/api';

export function mapEntityIds<T>(items: unknown[]): T[] {
  return items.map((item) => {
    if (!item || typeof item !== 'object' || !('_id' in item) || typeof item._id !== 'string') throw new Error('Dữ liệu trả về không hợp lệ. Vui lòng thử lại.');
    return { ...item, id: item._id } as T;
  });
}

/** Keep each read bounded and discard results from an obsolete tenant/branch. */
export function useStudentCollection<T>(endpoint: string, field: string, events: string, label: string, decode: (items: unknown[]) => T[] = mapEntityIds) {
  const { userProfile } = useAuth();
  const { activeBranchId, loading: branchLoading, error: branchError } = useBranch();
  const userId = userProfile?.uid;
  const key = JSON.stringify([userId, userProfile?.companyCode, userProfile?.role, userProfile?.permissions, activeBranchId, endpoint, getBusinessApiScope(), localStorage.getItem('accessToken')]);
  const [result, setResult] = useState<{ key: string; items: T[]; loading: boolean; error: string }>({ key: '', items: [], loading: true, error: '' });
  const request = useRef<{ version: number; controller?: AbortController }>({ version: 0 });
  const refetch = useCallback(async () => {
    request.current.controller?.abort();
    const version = ++request.current.version;
    if (!userId || branchLoading || branchError) {
      setResult({ key, items: [], loading: Boolean(userId && branchLoading), error: branchError || '' });
      return;
    }
    const controller = new AbortController();
    request.current.controller = controller;
    setResult({ key, items: [], loading: true, error: '' });
    try {
      const items = await withRequestTimeout(async (signal) => {
        const response = await apiFetch<Record<string, unknown>>(endpoint, { signal, ...(activeBranchId ? { headers: { 'x-branch-id': activeBranchId } } : {}) });
        if (response.success !== true || !Array.isArray(response[field])) throw new Error(`Không thể tải ${label}. Vui lòng thử lại.`);
        return decode(response[field] as unknown[]);
      }, 20000, `Tải ${label} quá lâu. Vui lòng thử lại.`, controller.signal);
      if (controller.signal.aborted || request.current.version !== version) return;
      setResult({ key, items, loading: false, error: '' });
    } catch (cause) {
      if (controller.signal.aborted || request.current.version !== version) return;
      setResult({ key, items: [], loading: false, error: cause instanceof Error ? cause.message : `Không thể tải ${label}. Vui lòng thử lại.` });
    }
  }, [userId, branchLoading, branchError, key, endpoint, field, activeBranchId, decode, label]);
  useEffect(() => {
    let disposed = false;
    const current = request.current;
    void Promise.resolve().then(() => { if (!disposed) return refetch(); });
    const changed = () => { void refetch(); };
    const names = events.split(' ').filter(Boolean);
    names.forEach((name) => window.addEventListener(name, changed));
    window.addEventListener('online', changed);
    return () => {
      disposed = true; current.version++; current.controller?.abort();
      names.forEach((name) => window.removeEventListener(name, changed));
      window.removeEventListener('online', changed);
    };
  }, [refetch, events]);
  const matches = result.key === key && !branchLoading && !branchError && Boolean(userId);
  return { items: matches ? result.items : [], loading: userId ? (branchLoading || (result.key === key ? result.loading : true)) : false, error: branchError || (result.key === key ? result.error : ''), refetch };
}

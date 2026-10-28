import { useEffect, useState } from 'react';
import type { BusinessOverview } from '../../../shared/business-overview';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { dashboardService } from '../../services/dashboardService';

const cache = new Map<string, { at: number; data: BusinessOverview }>();
type Snapshot = { key: string; data: BusinessOverview | null; loading: boolean; error: string; refreshError: string };

export function useBusinessOverview(from: string, to: string, valid: boolean) {
  const { userProfile } = useAuth();
  const { activeBranchId, loading: branchLoading, error: branchError, retry: retryBranch } = useBranch();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Snapshot>({ key: '', data: null, loading: true, error: '', refreshError: '' });
  const key = JSON.stringify([userProfile?.uid, userProfile?.companyCode, userProfile?.role, userProfile?.businessType, userProfile?.permissions, userProfile?.enabledModules, activeBranchId, from, to, localStorage.getItem('accessToken')]);
  const userId = userProfile?.uid;

  useEffect(() => {
    if (!userId || !valid || branchLoading || branchError) return;
    let disposed = false;
    let busy = false;
    const controller = new AbortController();
    const cached = cache.get(key);
    const fresh = Boolean(cached && Date.now() - cached.at < 30000);
    let last = cached?.data || null;
    const load = async () => {
      if (busy || disposed) return;
      busy = true;
      try {
        const data = await dashboardService.getBusinessOverview(from, to, { signal: controller.signal, branchId: activeBranchId || undefined });
        if (disposed) return;
        last = data;
        cache.delete(key); cache.set(key, { at: Date.now(), data });
        if (cache.size > 8) cache.delete(cache.keys().next().value!);
        setResult({ key, data, loading: false, error: '', refreshError: '' });
      } catch (cause) {
        if (disposed) return;
        setResult({ key, data: last, loading: false, error: last ? '' : cause instanceof Error ? cause.message : 'Không thể tải tổng quan doanh nghiệp.', refreshError: last ? 'Chưa cập nhật được số liệu mới. Đang hiển thị dữ liệu đã tải; bạn có thể bấm Làm mới.' : '' });
      } finally { busy = false; }
    };
    void Promise.resolve().then(() => {
      if (disposed) return;
      setResult({ key, data: last, loading: !last, error: '', refreshError: '' });
      if (!fresh || attempt > 0) void load();
    });
    const poll = window.setInterval(() => { if (!document.hidden) void load(); }, 30000);
    const online = () => { void load(); };
    window.addEventListener('online', online);
    return () => { disposed = true; controller.abort(); window.clearInterval(poll); window.removeEventListener('online', online); };
  }, [key, userId, valid, branchLoading, branchError, from, to, activeBranchId, attempt]);

  const matches = result.key === key && valid && !branchLoading && !branchError;
  return {
    data: matches ? result.data : null,
    loading: Boolean(userId && valid && !branchError && (branchLoading || !matches || result.loading)),
    error: branchError || (matches ? result.error : ''),
    refreshError: matches ? result.refreshError : '',
    refresh: () => { if (branchError) retryBranch(); setAttempt(value => value + 1); },
  };
}

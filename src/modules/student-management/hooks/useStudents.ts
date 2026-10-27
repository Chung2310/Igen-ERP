import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useBranch } from '../../../context/BranchContext';
import { Student } from '../types';
import { buildStudentListEndpoint, type StudentListScope } from './studentListScope';
import { withRequestTimeout } from '../../../utils/requestTimeout';

export function useStudents(ownerFilter?: string, scope: StudentListScope = "branch", enabled = true) {
  const { userProfile: user } = useAuth();
  const { activeBranchId, loading: branchLoading } = useBranch();
  const userId = user?.uid;
  const companyCode = user?.companyCode;
  const scopeKey = JSON.stringify([userId, companyCode, activeBranchId, ownerFilter, scope, enabled]);
  const [result, setResult] = useState<{ key: string; students: Student[]; loading: boolean; error: string }>({ key: '', students: [], loading: true, error: '' });
  const request = useRef<{ version: number; controller?: AbortController }>({ version: 0 });

  const fetchStudents = useCallback(async () => {
    request.current.controller?.abort();
    const version = ++request.current.version;
    if (!userId || !enabled || branchLoading) {
      setResult({ key: scopeKey, students: [], loading: Boolean(branchLoading && enabled), error: '' });
      return;
    }
    const controller = new AbortController();
    request.current.controller = controller;
    setResult((current) => ({ key: scopeKey, students: current.key === scopeKey ? current.students : [], loading: true, error: '' }));
    try {
      const res = await withRequestTimeout(
        (signal) => apiFetch(buildStudentListEndpoint(scope, ownerFilter), {
          signal,
          ...(activeBranchId ? { headers: { 'x-branch-id': activeBranchId } } : {}),
        }),
        20000,
        'Tải danh sách quá lâu. Vui lòng thử lại.',
        controller.signal,
      );
      if (request.current.version !== version) return;
      if (res.success && res.students) {
        const mapped = res.students.map((s: Omit<Student, 'id'> & { _id: string }) => ({
          ...s,
          id: s._id,
        })) as Student[];
        setResult({ key: scopeKey, students: mapped, loading: false, error: '' });
      } else {
        throw new Error(res.error || res.message || 'Không thể tải danh sách. Vui lòng thử lại.');
      }
    } catch (error) {
      if (request.current.version !== version || controller.signal.aborted) return;
      setResult({ key: scopeKey, students: [], loading: false, error: error instanceof Error ? error.message : 'Không thể tải danh sách. Vui lòng thử lại.' });
    }
  }, [userId, scopeKey, ownerFilter, scope, activeBranchId, enabled, branchLoading]);

  useEffect(() => {
    const currentRequest = request.current;
    let disposed = false;
    void Promise.resolve().then(() => { if (!disposed) return fetchStudents(); });
    const handleMutation = () => { void fetchStudents(); };
    window.addEventListener("student-mutation", handleMutation);
    return () => {
      disposed = true;
      currentRequest.version++;
      currentRequest.controller?.abort();
      window.removeEventListener("student-mutation", handleMutation);
    };
  }, [fetchStudents]);

  return {
    students: result.key === scopeKey && enabled ? result.students : [],
    loading: result.key === scopeKey ? result.loading : enabled,
    error: result.key === scopeKey ? result.error : '',
    refetch: fetchStudents,
  };
}
export type UseStudentsReturn = ReturnType<typeof useStudents>;

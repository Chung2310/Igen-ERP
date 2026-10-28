import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, getBusinessApiScope } from '../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useBranch } from '../../../context/BranchContext';
import { Student } from '../types';
import { buildStudentListEndpoint, type StudentListScope } from './studentListScope';
import { withRequestTimeout } from '../../../utils/requestTimeout';
import { clearStudentListCache, readStudentListCache, writeStudentListCache } from './studentListCache';

export function useStudents(ownerFilter?: string, scope: StudentListScope = "branch", enabled = true) {
  const { userProfile: user } = useAuth();
  const { activeBranchId, loading: branchLoading, error: branchError } = useBranch();
  const userId = user?.uid;
  const companyCode = user?.companyCode;
  const scopeKey = JSON.stringify([userId, companyCode, activeBranchId, ownerFilter, scope, enabled, getBusinessApiScope(), user?.permissions, localStorage.getItem('accessToken')]);
  const [result, setResult] = useState<{ key: string; students: Student[]; loading: boolean; error: string }>({ key: '', students: [], loading: true, error: '' });
  const request = useRef<{ version: number; controller?: AbortController }>({ version: 0 });

  const fetchStudents = useCallback(async (force = true) => {
    request.current.controller?.abort();
    const version = ++request.current.version;
    if (!userId || !enabled || branchLoading) {
      setResult({ key: scopeKey, students: [], loading: Boolean(branchLoading && enabled), error: '' });
      return;
    }
    if (branchError) { setResult({ key: scopeKey, students: [], loading: false, error: branchError }); return; }
    if (!force) {
      const cached = readStudentListCache(scopeKey);
      if (cached) { setResult({ key: scopeKey, students: cached, loading: false, error: '' }); return; }
    } else clearStudentListCache();
    const controller = new AbortController();
    request.current.controller = controller;
    setResult((current) => ({ key: scopeKey, students: current.key === scopeKey ? current.students : [], loading: true, error: '' }));
    try {
      const students = await withRequestTimeout(async (signal) => {
        const endpoint = buildStudentListEndpoint(scope, ownerFilter);
        const all: Student[] = [];
        let page = 1, total = 0;
        let expectedTotal: number | undefined;
        do {
          if (signal.aborted) throw signal.reason;
          const res = await apiFetch(`${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}&limit=250`, {
            signal,
            ...(activeBranchId ? { headers: { 'x-branch-id': activeBranchId } } : {}),
          });
          if (!res.success || !Array.isArray(res.students)) throw new Error(res.error || res.message || 'Không thể tải danh sách. Vui lòng thử lại.');
          total = Number(res.total ?? res.students.length);
          if (!Number.isSafeInteger(total) || total < all.length + res.students.length || (expectedTotal !== undefined && total !== expectedTotal) || (res.students.length === 0 && all.length < total)) throw new Error('Danh sách vừa thay đổi hoặc chưa tải đủ. Vui lòng thử lại.');
          expectedTotal = total;
          all.push(...res.students.map((student: Omit<Student, 'id'> & { _id: string }) => ({ ...student, id: student._id })));
          page++;
        } while (all.length < total);
        if (new Set(all.map((student) => student.id)).size !== all.length) throw new Error('Danh sách vừa thay đổi trong lúc tải. Vui lòng thử lại.');
        return all;
      }, 20000,
        'Tải danh sách quá lâu. Vui lòng thử lại.',
        controller.signal,
      );
      if (request.current.version !== version) return;
      writeStudentListCache(scopeKey, students);
      setResult({ key: scopeKey, students, loading: false, error: '' });
    } catch (error) {
      if (request.current.version !== version || controller.signal.aborted) return;
      setResult({ key: scopeKey, students: [], loading: false, error: error instanceof Error ? error.message : 'Không thể tải danh sách. Vui lòng thử lại.' });
    }
  }, [userId, scopeKey, ownerFilter, scope, activeBranchId, enabled, branchLoading, branchError]);

  useEffect(() => {
    const currentRequest = request.current;
    let disposed = false;
    void Promise.resolve().then(() => { if (!disposed) return fetchStudents(false); });
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

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useBranch } from '../../../context/BranchContext';
import { Student } from '../types';
import { buildStudentListEndpoint, type StudentListScope } from './studentListScope';

export function useStudents(ownerFilter?: string, scope: StudentListScope = "branch", enabled = true) {
  const { userProfile: user } = useAuth();
  const { activeBranchId } = useBranch();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStudents = useCallback(async () => {
    if (!user || !enabled) {
      setStudents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(buildStudentListEndpoint(scope, ownerFilter));
      if (res.success && res.students) {
        const mapped = res.students.map((s: Omit<Student, 'id'> & { _id: string }) => ({
          ...s,
          id: s._id,
        })) as Student[];
        setStudents(mapped);
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error("Error fetching students:", error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [user, ownerFilter, scope, activeBranchId, enabled]);

  useEffect(() => {
    fetchStudents();
    const handleMutation = () => { fetchStudents(); };
    window.addEventListener("student-mutation", handleMutation);
    return () => { window.removeEventListener("student-mutation", handleMutation); };
  }, [fetchStudents]);

  return { students, loading, refetch: fetchStudents };
}
export type UseStudentsReturn = ReturnType<typeof useStudents>;

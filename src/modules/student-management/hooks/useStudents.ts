import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { Student } from '../types';

export function useStudents(ownerFilter?: string) {
  const { userProfile: user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStudents = useCallback(async () => {
    if (!user) {
      setStudents([]);
      setLoading(false);
      return;
    }
    
    try {
      const url = ownerFilter ? `/students?ownerFilter=${encodeURIComponent(ownerFilter)}` : "/students";
      const res = await apiFetch(url);
      if (res.success && res.students) {
        const mapped = res.students.map((s: Omit<Student, 'id'> & { _id: string }) => ({
          ...s,
          id: s._id,
        })) as Student[];
        setStudents(mapped);
      }
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  }, [user, ownerFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStudents();

    const handleMutation = () => {
      fetchStudents();
    };

    window.addEventListener("student-mutation", handleMutation);
    return () => {
      window.removeEventListener("student-mutation", handleMutation);
    };
  }, [fetchStudents]);

  return { students, loading, refetch: fetchStudents };
}
export type UseStudentsReturn = ReturnType<typeof useStudents>;

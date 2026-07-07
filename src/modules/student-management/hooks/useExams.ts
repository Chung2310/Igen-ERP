import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { ExamSession } from '../types';

export function useExams(ownerFilter?: string) {
  const { userProfile: user } = useAuth();
  const [exams, setExams] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExams = useCallback(async () => {
    if (!user) {
      setExams([]);
      setLoading(false);
      return;
    }
    
    try {
      const url = ownerFilter ? `/exams?ownerFilter=${encodeURIComponent(ownerFilter)}` : "/exams";
      const res = await apiFetch(url);
      if (res.success && res.exams) {
        const mapped = res.exams.map((e: Omit<ExamSession, 'id'> & { _id: string }) => ({
          ...e,
          id: e._id,
        })) as ExamSession[];
        setExams(mapped);
      }
    } catch (error) {
      console.error("Error fetching exams:", error);
    } finally {
      setLoading(false);
    }
  }, [user, ownerFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchExams();

    const handleMutation = () => {
      fetchExams();
    };

    window.addEventListener("exam-mutation", handleMutation);
    window.addEventListener("student-mutation", handleMutation);
    return () => {
      window.removeEventListener("exam-mutation", handleMutation);
      window.removeEventListener("student-mutation", handleMutation);
    };
  }, [fetchExams]);

  return { exams, loading, refetch: fetchExams };
}
export type UseExamsReturn = ReturnType<typeof useExams>;

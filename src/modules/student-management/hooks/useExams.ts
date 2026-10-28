import type { ExamSession } from '../types';
import { useStudentCollection } from './useStudentCollection';

export function useExams(ownerFilter?: string) {
  const endpoint = ownerFilter ? `/exams?ownerFilter=${encodeURIComponent(ownerFilter)}` : '/exams';
  const { items: exams, ...state } = useStudentCollection<ExamSession>(endpoint, 'exams', 'exam-mutation student-mutation', 'lịch thi');
  return { exams, ...state };
}
export type UseExamsReturn = ReturnType<typeof useExams>;

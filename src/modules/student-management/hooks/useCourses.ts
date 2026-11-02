import type { Course } from '../types';
import { useStudentCollection } from './useStudentCollection';

export function useCourses(ownerFilter?: string) {
  const endpoint = ownerFilter ? `/courses?ownerFilter=${encodeURIComponent(ownerFilter)}` : '/courses';
  const { items: courses, ...state } = useStudentCollection<Course>(endpoint, 'courses', 'course-mutation', 'danh sách khóa học');
  return { courses, ...state };
}
export type UseCoursesReturn = ReturnType<typeof useCourses>;

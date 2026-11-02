import { mapEntityIds, useStudentCollection } from './useStudentCollection';

export interface CourseCategoryItem { id: string; name: string; }
const decode = (rows: unknown[]) => mapEntityIds<CourseCategoryItem>(rows).map(({ id, name }) => ({ id, name }));
export function useCourseCategories(ownerFilter?: string) {
  const endpoint = ownerFilter ? `/courses/categories?ownerFilter=${encodeURIComponent(ownerFilter)}` : '/courses/categories';
  const { items: categories, ...state } = useStudentCollection<CourseCategoryItem>(endpoint, 'data', 'course-category-mutation', 'phân loại khóa học', decode);
  return { categories, ...state };
}

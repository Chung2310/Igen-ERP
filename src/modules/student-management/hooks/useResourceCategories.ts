import { mapEntityIds, useStudentCollection } from './useStudentCollection';

export interface ResourceCategoryItem { id: string; name: string; }
const decode = (rows: unknown[]) => mapEntityIds<ResourceCategoryItem>(rows).map(({ id, name }) => ({ id, name }));
export function useResourceCategories() {
  const { items: categories, ...state } = useStudentCollection<ResourceCategoryItem>('/student-resources/categories', 'data', 'resource-category-mutation', 'phân loại tài nguyên', decode);
  return { categories, ...state };
}

import type { ResourceItem, ResourceBooking } from '../types';
import { mapEntityIds, useStudentCollection } from './useStudentCollection';

type ApiResource = Omit<ResourceItem, 'id' | 'bookings'> & { _id: string; bookings?: (Omit<ResourceBooking, 'id'> & { _id: string })[] };
const decode = (rows: unknown[]) => mapEntityIds<ApiResource & { id: string }>(rows).map((row) => ({ ...row, bookings: mapEntityIds<ResourceBooking>(row.bookings || []) })) as ResourceItem[];
export function useResources() {
  const { items: resources, ...state } = useStudentCollection<ResourceItem>('/student-resources', 'resources', 'resource-mutation', 'tài nguyên', decode);
  return { resources, ...state };
}
export type UseResourcesReturn = ReturnType<typeof useResources>;

import type { Batch } from '../types';
import { useStudentCollection } from './useStudentCollection';

export function useBatches(ownerFilter?: string) {
  const endpoint = ownerFilter ? `/batches?ownerFilter=${encodeURIComponent(ownerFilter)}` : '/batches';
  const { items: batches, ...state } = useStudentCollection<Batch>(endpoint, 'batches', 'batch-mutation', 'danh sách lớp học');
  return { batches, ...state };
}
export type UseBatchesReturn = ReturnType<typeof useBatches>;

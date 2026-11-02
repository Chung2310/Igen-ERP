import type { ScheduleEvent } from '../types';
import { useStudentCollection } from './useStudentCollection';

const decode = (rows: unknown[]) => rows as ScheduleEvent[];
/** Lịch tổng hợp (lớp học định kỳ + kỳ thi + booking tài nguyên) trong một khoảng ngày */
export function useSchedule(from?: string, to?: string, ownerFilter?: string) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries({ from, to, ownerFilter })) if (value) params.set(name, value);
  const query = params.toString();
  const { items: events, ...state } = useStudentCollection<ScheduleEvent>(`/schedule${query ? `?${query}` : ''}`, 'events', 'exam-mutation resource-mutation batch-mutation', 'lịch tổng hợp', decode);
  return { events, ...state };
}
export type UseScheduleReturn = ReturnType<typeof useSchedule>;

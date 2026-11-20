import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/ToastProvider';
import { api } from '../../services/api';
import type { PaginationMeta, UserRole } from '../../types';
import { errorMessage } from '../../types';

// Components (mảnh UI)
import CalendarFilter from '../../components/calendar/CalendarFilter';
import CalendarEventList from '../../components/calendar/CalendarEventList';
import CalendarEventModal, { type CalendarItem } from '../../components/calendar/CalendarEventModal';

export default function CalendarPage({ role }: { role: UserRole }) {
  const toast = useToast();

  // === STATE ===
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 0 });
  const [dates, setDates] = useState({ fromDate: '', toDate: '' });
  const [editing, setEditing] = useState<CalendarItem | null | undefined>(undefined);

  // === DATA FETCHING ===
  const load = useCallback(async (page = 1) => {
    try {
      const query = new URLSearchParams({ page: String(page), limit: '20' });
      if (dates.fromDate) query.set('fromDate', dates.fromDate);
      if (dates.toDate) query.set('toDate', dates.toDate);
      const result = await api.get<CalendarItem[]>(`/api/calendar-events?${query}`);
      setItems(result.data);
      if (result.meta) setMeta(result.meta);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }, [dates.fromDate, dates.toDate, toast]);

  useEffect(() => { void load(); }, [load]);

  // === ACTION HANDLERS ===
  const handleRemove = async (item: CalendarItem) => {
    try {
      await api.delete(`/api/calendar-events/${item._id}`);
      void load(meta.page);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  // === LẮP RÁP COMPONENTS ===
  return (
    <section>
      <div className="section-header">
        <div>
          <h1>Lịch nội bộ</h1>
          <p>Lịch tập và công việc theo khoảng ngày.</p>
        </div>
        {role === 'PT' && (
          <button className="button button-primary" onClick={() => setEditing(null)}>
            <Plus size={18} /> Tạo lịch
          </button>
        )}
      </div>

      <CalendarFilter dates={dates} onDatesChange={setDates} />

      <CalendarEventList
        items={items}
        role={role}
        onEdit={(item) => setEditing(item)}
        onRemove={handleRemove}
      />

      <Pagination page={meta.page || 1} totalPages={meta.totalPages || 0} onPageChange={load} />

      <CalendarEventModal
        open={editing !== undefined}
        event={editing}
        onClose={() => setEditing(undefined)}
        onSaved={() => void load(meta.page)}
      />
    </section>
  );
}

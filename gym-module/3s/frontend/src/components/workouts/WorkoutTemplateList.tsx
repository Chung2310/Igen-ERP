import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dumbbell, Filter, RotateCcw, Search } from 'lucide-react';
import Pagination from '../ui/Pagination';
import { useToast } from '../ui/ToastProvider';
import { api } from '../../services/api';
import type { PaginationMeta } from '../../types';
import { errorMessage } from '../../types';
import WorkoutTemplateCard from './WorkoutTemplateCard';
import type { TrackingPrescription, TrackingType } from '../../types';

export interface WorkoutTemplate {
  [key: string]: unknown;
  _id: string;
  title: string;
  goal: string;
  level: string;
  version: number;
  status: 'ACTIVE' | 'ARCHIVED';
  sessions: Array<{
    name: string;
    exercises: Array<{ exerciseId?: string; name: string; trackingType?: TrackingType; prescription?: TrackingPrescription; sets?: number; reps?: string; weight?: string; rpe?: number; rir?: number; tempo?: string; restSeconds?: number; notes?: string }>;
  }>;
  durationDays?: number;
  muscleGroups?: string[];
  defaultSets?: number;
  defaultReps?: string;
  defaultWeight?: string;
  defaultTempo?: string;
  technicalNotes?: string;
  scheduledExercises?: Array<Record<string, unknown>>;
  unscheduledExercises?: Array<Record<string, unknown>>;
}

interface Props {
  refreshKey: number;
  onEdit: (template: WorkoutTemplate) => void;
  onAssign?: (template: WorkoutTemplate) => void;
}

const WORKOUT_TEMPLATES_PER_PAGE = 12;

export default function WorkoutTemplateList({ refreshKey, onEdit, onAssign }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<WorkoutTemplate[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 0 });
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), limit: String(WORKOUT_TEMPLATES_PER_PAGE) });
      if (status) query.set('status', status);
      const result = await api.get<WorkoutTemplate[]>(`/api/workout-templates?${query}`);
      setItems(result.data);
      if (result.meta) setMeta(result.meta);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [status, toast]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const archive = async (item: WorkoutTemplate) => {
    try {
      const result = await api.patch(`/api/workout-templates/${item._id}/archive`);
      toast.success(result.message);
      void load(meta.page);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const remove = async (item: WorkoutTemplate) => {
    try {
      const result = await api.delete(`/api/workout-templates/${item._id}`);
      toast.success(result.message);
      void load(meta.page);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const visibleItems = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi');
    if (!keyword) return items;
    return items.filter((item) => `${item.title} ${item.goal}`.toLocaleLowerCase('vi').includes(keyword));
  }, [items, search]);

  return (
    <section className="workout-template-list" aria-labelledby="workout-template-list-title">
      <div className="module-toolbar workout-toolbar">
        <div>
          <h2 id="workout-template-list-title" className="workout-toolbar-title"><Filter size={18} aria-hidden="true" /> Tìm giáo án</h2>
        </div>
        <label className="workout-search">
          <span className="sr-only">Tìm giáo án</span>
          <Search size={17} className="workout-search-icon" aria-hidden="true" />
          <input aria-label="Tìm giáo án" placeholder="Tìm theo tên hoặc mục tiêu giáo án..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <select
          className="workout-status-filter"
          aria-label="Trạng thái giáo án"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang dùng</option>
          <option value="ARCHIVED">Đã lưu trữ</option>
        </select>
        {(status || search) && <button type="button" className="workout-filter-reset" onClick={() => { setStatus(''); setSearch(''); }}><RotateCcw size={13} aria-hidden="true" /> Xóa bộ lọc</button>}
      </div>

      {loading ? (
        <div aria-label="Đang tải giáo án" className="workout-template-grid">{Array.from({ length: 6 }, (_, index) => <div key={index} className="module-skeleton workout-template-skeleton" />)}</div>
      ) : visibleItems.length ? (
        <div className="workout-template-grid" role="list" aria-label="Danh sách giáo án">
          {visibleItems.map((item) => <div className="workout-template-grid-item" role="listitem" key={item._id}><WorkoutTemplateCard template={item} onEdit={onEdit} onAssign={onAssign} onArchive={(value) => void archive(value)} onDelete={(value) => void remove(value)} /></div>)}
        </div>
      ) : (
        <div className={`module-empty workout-template-empty ${search || status ? 'module-filtered-empty' : ''}`}><Dumbbell aria-hidden="true" /><h3>{search || status ? 'Không tìm thấy giáo án phù hợp' : 'Chưa có giáo án nào'}</h3><p>{search || status ? 'Thử đổi từ khóa hoặc xóa bộ lọc hiện tại.' : 'Hãy tạo giáo án đầu tiên để bắt đầu xây dựng thư viện.'}</p></div>
      )}
      <Pagination
        page={meta.page || 1}
        totalPages={meta.totalPages || 0}
        totalItems={meta.total}
        pageSize={meta.limit || WORKOUT_TEMPLATES_PER_PAGE}
        itemLabel="giáo án"
        loading={loading}
        onPageChange={load}
      />
    </section>
  );
}

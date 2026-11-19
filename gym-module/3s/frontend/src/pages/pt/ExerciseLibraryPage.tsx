import { useCallback, useEffect, useState } from 'react';
import { Dumbbell, Layers, Plus, Sparkles } from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/ToastProvider';
import { api } from '../../services/api';
import type { Exercise, MuscleGroupItem, PaginationMeta } from '../../types';
import { errorMessage } from '../../types';

// Components (mảnh UI)
import ExerciseFilter from '../../components/exercises/ExerciseFilter';
import ExerciseFormModal from '../../components/exercises/ExerciseFormModal';
import ExerciseLibraryCard from '../../components/exercises/ExerciseLibraryCard';
import AiExerciseWizard from '../../components/exercises/AiExerciseWizard';
import MuscleGroupModal from '../../components/exercises/MuscleGroupModal';

const EXERCISES_PER_PAGE = 12;

export default function ExerciseLibraryPage() {
  const toast = useToast();

  // === STATE ===
  const [items, setItems] = useState<Exercise[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 0 });
  const [keyword, setKeyword] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [level, setLevel] = useState('');
  const [trackingType, setTrackingType] = useState('');
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroupItem[]>([]);
  const [muscleModalOpen, setMuscleModalOpen] = useState(false);
  const [formExercise, setFormExercise] = useState<Exercise | null | undefined>(undefined);
  const [aiOpen, setAiOpen] = useState(false);
  const [deleteExercise, setDeleteExercise] = useState<Exercise | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasFilters = Boolean(keyword || muscleGroup || level || trackingType);

  // === DATA FETCHING ===
  const loadMuscleGroups = useCallback(async () => {
    try {
      const result = await api.get<MuscleGroupItem[]>('/api/exercises/muscle-groups');
      setMuscleGroups(result.data || []);
    } catch {
      // Fallback silently if not available
    }
  }, []);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    const query = new URLSearchParams({ page: String(page), limit: String(EXERCISES_PER_PAGE) });
    if (keyword.trim()) query.set('keyword', keyword.trim());
    if (muscleGroup.trim()) query.set('muscleGroup', muscleGroup.trim());
    if (level) query.set('level', level);
    if (trackingType) query.set('defaultTrackingType', trackingType);
    try {
      const result = await api.get<Exercise[]>(`/api/exercises?${query}`);
      setItems(result.data);
      if (result.meta) setMeta(result.meta);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [keyword, level, muscleGroup, toast, trackingType]);

  useEffect(() => {
    void loadMuscleGroups();
  }, [loadMuscleGroups]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const handleClearFilters = () => {
    setKeyword('');
    setMuscleGroup('');
    setLevel('');
    setTrackingType('');
  };

  const confirmDelete = async () => {
    if (!deleteExercise) return;
    setDeleting(true);
    try {
      const result = await api.delete(`/api/exercises/${deleteExercise._id}`);
      toast.success(result.message);
      const currentPage = meta.page || 1;
      const targetPage = items.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      setDeleteExercise(null);
      await load(targetPage);
      void loadMuscleGroups();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const muscleNames = muscleGroups.map((g) => g.name);

  // === LẮP RÁP COMPONENTS ===
  return (
    <section className="module-page exercise-page" aria-label="Thư viện bài tập">
      <header className="module-header exercise-header">
        <div>
          <h1 className="module-heading">Thư viện bài tập</h1>
        </div>
        <div className="module-actions">
          <span className="exercise-count">{meta.total ?? items.length} bài tập</span>
          <button type="button" className="button button-secondary" onClick={() => setMuscleModalOpen(true)}>
            <Layers size={18} aria-hidden="true" /> Quản lý nhóm cơ
          </button>
          <button type="button" className="button button-secondary" onClick={() => setAiOpen(true)}>
            <Sparkles size={18} aria-hidden="true" /> Tạo bằng AI
          </button>
          <button type="button" className="button button-primary" onClick={() => setFormExercise(null)}>
            <Plus size={18} aria-hidden="true" /> Tạo bài tập
          </button>
        </div>
      </header>

      <ExerciseFilter
        keyword={keyword}
        muscleGroup={muscleGroup}
        level={level}
        trackingType={trackingType}
        muscleGroups={muscleNames}
        onKeywordChange={setKeyword}
        onMuscleGroupChange={setMuscleGroup}
        onLevelChange={setLevel}
        onTrackingTypeChange={setTrackingType}
        onFilter={() => void load(1)}
        onClear={handleClearFilters}
      />

      {loading ? (
        <div className="exercise-grid" aria-label="Đang tải bài tập">
          {Array.from({ length: 6 }, (_, index) => <div className="module-skeleton exercise-card-skeleton" key={index} />)}
        </div>
      ) : items.length ? (
        <div className="exercise-grid" role="list" aria-label="Danh sách bài tập">
          {items.map((item) => <div className="exercise-grid-item" role="listitem" key={item._id}><ExerciseLibraryCard exercise={item} onEdit={setFormExercise} onDelete={setDeleteExercise} /></div>)}
        </div>
      ) : (
        <div className={`module-empty exercise-empty ${hasFilters ? 'module-filtered-empty' : ''}`}>
          <Dumbbell className="exercise-empty-icon" aria-hidden="true" />
          <h2>{hasFilters ? 'Không có bài tập phù hợp' : 'Chưa có bài tập'}</h2>
          <p>{hasFilters ? 'Xóa bộ lọc để xem toàn bộ thư viện.' : 'Tạo bài tập đầu tiên để bắt đầu xây dựng thư viện.'}</p>
          {hasFilters && <button type="button" className="button button-secondary" onClick={handleClearFilters}>Xóa bộ lọc</button>}
        </div>
      )}
      <Pagination
        page={meta.page || 1}
        totalPages={meta.totalPages || 0}
        totalItems={meta.total}
        pageSize={meta.limit || EXERCISES_PER_PAGE}
        itemLabel="bài tập"
        loading={loading}
        onPageChange={load}
      />

      <ExerciseFormModal
        open={formExercise !== undefined}
        exercise={formExercise}
        muscleGroups={muscleNames}
        onClose={() => setFormExercise(undefined)}
        onSaved={() => { setFormExercise(undefined); void load(meta.page || 1); void loadMuscleGroups(); }}
        onMuscleGroupCreated={() => void loadMuscleGroups()}
      />
      <AiExerciseWizard
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onSaved={() => { setAiOpen(false); void load(meta.page || 1); void loadMuscleGroups(); }}
      />
      <MuscleGroupModal
        open={muscleModalOpen}
        muscleGroups={muscleGroups}
        onClose={() => setMuscleModalOpen(false)}
        onUpdated={() => { void loadMuscleGroups(); void load(meta.page || 1); }}
      />
      <ConfirmModal
        open={deleteExercise !== null}
        title="Xóa bài tập"
        description={deleteExercise ? `Bạn có chắc muốn xóa “${deleteExercise.name}”? Thao tác này không thể hoàn tác.` : undefined}
        confirmLabel="Xóa bài tập"
        danger
        loading={deleting}
        onClose={() => { if (!deleting) setDeleteExercise(null); }}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

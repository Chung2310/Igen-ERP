import { useEffect, useState, type FormEvent } from 'react';
import FormModal from '../ui/FormModal';
import { useToast } from '../ui/ToastProvider';
import { api } from '../../services/api';
import { errorMessage, type Exercise, type TrackingType } from '../../types';
import ExerciseVideoFields, { type ExerciseVideo } from './ExerciseVideoFields';

interface ExerciseFormModalProps {
  open: boolean;
  exercise?: Exercise | null;
  muscleGroups?: string[];
  onClose: () => void;
  onSaved: () => void;
  onMuscleGroupCreated?: (name: string) => void;
}

interface ExerciseFormState {
  name: string;
  muscleGroups: string[];
  level: Exercise['level'];
  defaultTrackingType: TrackingType | '';
  equipment: string;
  technique: string;
  videos: ExerciseVideo[];
}

const DEFAULT_FALLBACK_GROUPS = [
  'Ngực',
  'Lưng',
  'Vai',
  'Tay trước',
  'Tay sau',
  'Chân',
  'Mông',
  'Bụng / Core',
  'Toàn thân',
  'Tim mạch / Cardio',
];

const emptyForm: ExerciseFormState = {
  name: '',
  muscleGroups: [],
  level: 'BEGINNER',
  defaultTrackingType: '',
  equipment: '',
  technique: '',
  videos: [],
};

export default function ExerciseFormModal({
  open,
  exercise,
  muscleGroups = [],
  onClose,
  onSaved,
  onMuscleGroupCreated,
}: ExerciseFormModalProps) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUploading(false);
    setIsAddingCustom(false);
    setNewGroupName('');

    const baseList = muscleGroups.length > 0 ? muscleGroups : DEFAULT_FALLBACK_GROUPS;
    const initialExerciseGroups = exercise?.muscleGroups && exercise.muscleGroups.length > 0
      ? exercise.muscleGroups
      : exercise?.muscleGroup
        ? exercise.muscleGroup.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    const merged = Array.from(new Set([...baseList, ...initialExerciseGroups]));
    setAvailableGroups(merged);

    setForm(
      exercise
        ? {
            name: exercise.name,
            muscleGroups: initialExerciseGroups,
            level: exercise.level,
            defaultTrackingType: exercise.defaultTrackingType ?? '',
            equipment: exercise.equipment?.join(', ') ?? '',
            technique: exercise.technique ?? '',
            videos: exercise.videos ?? [],
          }
        : {
            ...emptyForm,
            muscleGroups: merged[0] ? [merged[0]] : [],
            videos: [],
          },
    );
  }, [exercise, muscleGroups, open]);

  const toggleMuscleGroup = (group: string) => {
    setForm((current) => {
      const exists = current.muscleGroups.includes(group);
      const next = exists
        ? current.muscleGroups.filter((item) => item !== group)
        : [...current.muscleGroups, group];
      return { ...current, muscleGroups: next };
    });
  };

  const handleAddMuscleGroup = async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    setCreatingGroup(true);
    try {
      const res = await api.post<{ name: string }>('/api/exercises/muscle-groups', { name: trimmed });
      const createdName = res.data?.name || trimmed;
      setAvailableGroups((prev) => (prev.includes(createdName) ? prev : [...prev, createdName]));
      setForm((current) => ({
        ...current,
        muscleGroups: current.muscleGroups.includes(createdName)
          ? current.muscleGroups
          : [...current.muscleGroups, createdName],
      }));
      onMuscleGroupCreated?.(createdName);
      toast.success(`Đã thêm nhóm cơ "${createdName}".`);
      setIsAddingCustom(false);
      setNewGroupName('');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setCreatingGroup(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.muscleGroups.length === 0) {
      toast.error('Vui lòng chọn ít nhất một nhóm cơ.');
      return;
    }
    setLoading(true);
    if (uploading) return;
    const body = {
      name: form.name,
      muscleGroups: form.muscleGroups,
      muscleGroup: form.muscleGroups.join(', '),
      level: form.level,
      defaultTrackingType: form.defaultTrackingType,
      equipment: form.equipment.split(',').map((item) => item.trim()).filter(Boolean),
      technique: form.technique,
      videos: form.videos,
    };
    try {
      const result = exercise
        ? await api.patch(`/api/exercises/${exercise._id}`, body)
        : await api.post('/api/exercises', { ...body, scope: 'GLOBAL' });
      toast.success(result.message);
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const change = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <FormModal
      className="module-modal exercise-form-modal"
      open={open}
      title={exercise ? 'Sửa bài tập' : 'Tạo bài tập'}
      dirty={Object.values(form).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)))}
      loading={loading || uploading}
      submitLabel="Lưu bài tập"
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="module-form exercise-form">
        <section className="exercise-form-section" aria-labelledby="exercise-form-basics">
          <div className="exercise-form-section-heading">
            <h3 id="exercise-form-basics">Thông tin cơ bản</h3>
          </div>
          <div className="module-field-grid">
            <label className="module-field">
              <span>Tên bài tập</span>
              <input
                aria-label="Tên bài tập"
                placeholder="Ví dụ: Barbell Squat"
                value={form.name}
                onChange={(event) => change('name', event.target.value)}
                required
              />
            </label>
            <div className="module-field exercise-form-muscle-field">
              <div className="exercise-form-muscle-header">
                <span>
                  Nhóm cơ{' '}
                  {form.muscleGroups.length > 0 && (
                    <strong className="exercise-form-muscle-count">({form.muscleGroups.length})</strong>
                  )}
                </span>
                {!isAddingCustom && (
                  <button
                    type="button"
                    className="exercise-form-muscle-toggle"
                    onClick={() => {
                      setIsAddingCustom(true);
                      setNewGroupName('');
                    }}
                  >
                    + Thêm nhóm cơ mới
                  </button>
                )}
              </div>
              {isAddingCustom && (
                <div className="exercise-form-custom-muscle">
                  <input
                    aria-label="Tên nhóm cơ mới"
                    placeholder="Nhập tên nhóm cơ..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleAddMuscleGroup();
                      }
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="button button-secondary exercise-form-muscle-btn"
                    disabled={creatingGroup || !newGroupName.trim()}
                    onClick={() => void handleAddMuscleGroup()}
                  >
                    {creatingGroup ? '...' : 'Lưu'}
                  </button>
                  <button
                    type="button"
                    className="button button-ghost exercise-form-muscle-btn"
                    disabled={creatingGroup}
                    onClick={() => {
                      setIsAddingCustom(false);
                      setNewGroupName('');
                    }}
                  >
                    Hủy
                  </button>
                </div>
              )}
              <div className="exercise-muscle-chips" role="group" aria-label="Danh sách nhóm cơ">
                {availableGroups.map((group) => {
                  const isSelected = form.muscleGroups.includes(group);
                  return (
                    <button
                      key={group}
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={group}
                      className={`exercise-muscle-chip ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => toggleMuscleGroup(group)}
                    >
                      <span className="exercise-muscle-chip-icon" aria-hidden="true">
                        {isSelected ? '✓' : '+'}
                      </span>
                      <span>{group}</span>
                    </button>
                  );
                })}
              </div>
              {form.muscleGroups.length > 0 ? (
                <p className="exercise-muscle-summary">
                  Đã chọn: <strong>{form.muscleGroups.join(', ')}</strong>
                </p>
              ) : (
                <p className="exercise-muscle-hint">Chọn một hoặc nhiều nhóm cơ phù hợp với bài tập.</p>
              )}
            </div>
            <label className="module-field">
              <span>Cấp độ</span>
              <select
                aria-label="Cấp độ"
                value={form.level}
                onChange={(event) => change('level', event.target.value)}
              >
                <option value="BEGINNER">Cơ bản</option>
                <option value="INTERMEDIATE">Trung cấp</option>
                <option value="ADVANCED">Nâng cao</option>
              </select>
            </label>
            <label className="module-field">
              <span>Cách ghi nhận</span>
              <select
                aria-label="Cách ghi nhận"
                value={form.defaultTrackingType}
                onChange={(event) => change('defaultTrackingType', event.target.value)}
                required
              >
                <option value="" disabled>Chọn cách ghi nhận...</option>
                <option value="STRENGTH">Sức mạnh · mức tạ</option>
                <option value="BODYWEIGHT">Trọng lượng cơ thể</option>
                <option value="CARDIO">Cardio · quãng đường/thời gian</option>
                <option value="INTERVAL">Interval · hiệp làm/nghỉ</option>
                <option value="MOBILITY">Mobility · thời lượng/biên độ</option>
              </select>
            </label>
          </div>
        </section>
        <section className="exercise-form-section" aria-labelledby="exercise-form-technique">
          <div className="exercise-form-section-heading">
            <h3 id="exercise-form-technique">Thiết bị & kỹ thuật</h3>
          </div>
          <label className="module-field">
            <span>Thiết bị</span>
            <input
              aria-label="Thiết bị"
              value={form.equipment}
              onChange={(event) => change('equipment', event.target.value)}
              placeholder="Phân cách bằng dấu phẩy"
            />
          </label>
          <label className="module-field">
            <span>Kỹ thuật</span>
            <textarea
              aria-label="Kỹ thuật"
              placeholder="Mô tả cách thực hiện đúng..."
              value={form.technique}
              onChange={(event) => change('technique', event.target.value)}
            />
          </label>
        </section>
        <ExerciseVideoFields
          videos={form.videos}
          onChange={(videos) => setForm((current) => ({ ...current, videos }))}
          onUploadingChange={setUploading}
        />
      </div>
    </FormModal>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import FormModal from '../ui/FormModal';
import { useToast } from '../ui/ToastProvider';
import { api } from '../../services/api';
import { useExerciseDuplicates } from '../../hooks/useExerciseDuplicates';
import {
  errorMessage,
  type AiExerciseDraft,
  type AiExerciseGenerationRequest,
  type ClassifiedTrackingType,
  type Exercise,
} from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const trackingOptions: Array<{ value: ClassifiedTrackingType; label: string }> = [
  { value: 'STRENGTH', label: 'Sức mạnh · mức tạ' },
  { value: 'BODYWEIGHT', label: 'Trọng lượng cơ thể' },
  { value: 'CARDIO', label: 'Cardio · quãng đường/thời gian' },
  { value: 'INTERVAL', label: 'Interval · hiệp làm/nghỉ' },
  { value: 'MOBILITY', label: 'Mobility · thời lượng/biên độ' },
];

const arrayFields = ['equipment', 'commonMistakes', 'contraindications', 'variants'] as const;
type ArrayField = typeof arrayFields[number];

function lines(value: string): string[] {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function isValidDraft(draft: AiExerciseDraft): boolean {
  const hasMuscle = Boolean(
    (draft.muscleGroups && draft.muscleGroups.length > 0) || draft.muscleGroup?.trim(),
  );
  return Boolean(
    draft.name.trim() && hasMuscle && draft.level && draft.defaultTrackingType
    && draft.description.trim() && draft.technique.trim(),
  );
}

export default function AiExerciseWizard({ open, onClose, onSaved }: Props) {
  const toast = useToast();
  const [prompt, setPrompt] = useState('');
  const [drafts, setDrafts] = useState<AiExerciseDraft[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<'CONFIG' | 'REVIEW'>('CONFIG');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [discardedCount, setDiscardedCount] = useState(0);
  const duplicates = useExerciseDuplicates(drafts.map((draft) => draft.name), open && step === 'REVIEW');
  const duplicateKey = JSON.stringify(duplicates.reasons.map(Boolean));
  useEffect(() => {
    if (!duplicates.ready) return;
    const blocked = JSON.parse(duplicateKey) as boolean[];
    setSelected((current) => new Set([...current].filter((index) => !blocked[index])));
  }, [duplicateKey, duplicates.ready]);
  const selectable = drafts.map((_, index) => index).filter((index) => !duplicates.reasons[index]);
  const selectedCount = selectable.filter((index) => selected.has(index)).length;

  const reset = () => {
    setPrompt('');
    setDrafts([]);
    setSelected(new Set());
    setStep('CONFIG');
    setError('');
    setDiscardedCount(0);
  };

  const close = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const generate = async () => {
    const normalizedPrompt = prompt.trim();
    if (normalizedPrompt.length < 3) {
      setError('Vui lòng nhập yêu cầu tạo bài tập.');
      return;
    }
    const payload: AiExerciseGenerationRequest = { prompt: normalizedPrompt };
    setLoading(true);
    setError('');
    try {
      const result = await api.post<{ drafts: AiExerciseDraft[]; discardedCount: number }>('/api/ai/exercise-generations', payload);
      const sanitizedDrafts = (result.data.drafts || []).map((d) => ({
        ...d,
        name: d.name.replace(/[()[\]{}]/g, '').replace(/\s+/g, ' ').trim(),
      }));
      setDrafts(sanitizedDrafts);
      setSelected(new Set(sanitizedDrafts.map((_, index) => index)));
      setDiscardedCount(result.data.discardedCount);
      setStep('REVIEW');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = <K extends keyof AiExerciseDraft>(index: number, key: K, value: AiExerciseDraft[K]) => {
    setDrafts((current) => current.map((draft, position) => position === index ? { ...draft, [key]: value } : draft));
  };

  const toggle = (index: number) => {
    if (!duplicates.ready || duplicates.reasons[index] || loading) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectedDrafts = drafts
    .filter((draft, index) => selected.has(index) && !duplicates.reasons[index] && isValidDraft(draft))
    .map((draft) => {
      const groups = draft.muscleGroups && draft.muscleGroups.length > 0
        ? draft.muscleGroups
        : draft.muscleGroup.split(',').map((s) => s.trim()).filter(Boolean);
      return {
        ...draft,
        name: draft.name.replace(/[()[\]{}]/g, '').replace(/\s+/g, ' ').trim(),
        muscleGroups: groups,
        muscleGroup: groups.join(', '),
      };
    });
  const selectedInvalid = drafts.some((draft, index) => selected.has(index) && !duplicates.reasons[index] && !isValidDraft(draft));

  const save = async () => {
    if (!duplicates.ready || loading) return;
    if (!selectedCount) {
      setError('Vui lòng chọn ít nhất một bài tập.');
      return;
    }
    if (selectedInvalid) {
      setError('Vui lòng điền đủ tên, nhóm cơ, cấp độ, cách ghi nhận, mô tả và kỹ thuật cho các bài đã chọn.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api.post<AiExerciseDraft[]>('/api/exercises/bulk', { exercises: selectedDrafts });
      toast.success(result.message);
      reset();
      onSaved();
    } catch (cause) {
      setError(errorMessage(cause));
      duplicates.retry();
    } finally {
      setLoading(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (step === 'CONFIG') void generate();
    else void save();
  };

  const saveLabel = `Lưu ${selectedCount} bài tập`;

  return (
    <FormModal
      open={open}
      title="Tạo bài tập bằng AI"
      description="Nhập yêu cầu tự nhiên, AI sẽ tự xác định số lượng và điền đầy đủ thông tin từng bài."
      size="xl"
      className="max-h-[94vh] overflow-hidden"
      dirty={Boolean(prompt || drafts.length)}
      loading={loading}
      submitLabel={step === 'CONFIG' ? 'Tạo bản nháp' : saveLabel}
      submitDisabled={step === 'REVIEW' && (!duplicates.ready || !selectedCount || selectedInvalid)}
      onClose={close}
      onSubmit={submit}
    >
      <ol className="mb-5 grid grid-cols-2 gap-2" aria-label="Tiến trình tạo bài tập AI">
        {['Cấu hình', 'Duyệt & lưu'].map((label, index) => {
          const active = step === (index === 0 ? 'CONFIG' : 'REVIEW');
          return <li key={label} aria-current={active ? 'step' : undefined} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${active ? 'border-sky-500 bg-sky-50 text-primary' : 'border-slate-200 text-slate-500'}`}><span className="flex size-6 items-center justify-center rounded-full bg-white text-xs">{index + 1}</span>{label}</li>;
        })}
      </ol>

      {step === 'CONFIG' ? (
        <div className="grid gap-4">
          <label className="module-field"><span>Yêu cầu tạo bài tập</span><textarea aria-label="Yêu cầu tạo bài tập" rows={5} placeholder="Ví dụ: Tạo 5 bài tập cơ bụng cho người mới, không cần dụng cụ (Tên bài tập sẽ tự động đặt bằng tiếng Anh, không chứa dấu ngoặc)" value={prompt} disabled={loading} onChange={(event) => setPrompt(event.target.value)} required /></label>        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="button button-secondary" disabled={loading} onClick={() => { setError(''); setStep('CONFIG'); }}><ArrowLeft size={16} /> Quay lại cấu hình</button>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" disabled={loading || !duplicates.ready || selectable.length === 0} checked={selectedCount === selectable.length && selectable.length > 0} onChange={(event) => setSelected(event.target.checked ? new Set(selectable) : new Set())} /> Chọn tất cả</label>
          </div>
          {!duplicates.ready && !duplicates.error && <p role="status" className="text-sm text-slate-600">Đang kiểm tra bài tập trong thư viện…</p>}
          {duplicates.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Không thể kiểm tra bài trùng: {duplicates.error} <button type="button" className="font-semibold underline hover:no-underline focus-visible:outline-2" onClick={duplicates.retry}>Thử lại</button></div>}
          {duplicates.ready && duplicates.reasons.some(Boolean) && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Đã bỏ chọn {duplicates.reasons.filter(Boolean).length} bài trùng. {selectable.length ? 'Bạn có thể lưu các bài mới còn lại.' : 'Tất cả bài tập đều bị trùng. Bạn có thể quay lại cấu hình để tạo bài khác.'}</p>}
          {discardedCount > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">AI có {discardedCount} kết quả không hợp lệ đã được loại bỏ.</p>}
          <div className="space-y-4">
            {drafts.map((draft, index) => (
              <section key={index} className={`rounded-2xl border p-4 transition-colors ${selected.has(index) ? 'border-sky-300 bg-white' : 'border-slate-200 bg-slate-50 opacity-70'}`}>
                <header className="mb-4 flex flex-wrap items-center justify-between gap-3"><label className="flex cursor-pointer items-center gap-2 font-bold text-primary"><input aria-label={`Chọn bài tập ${index + 1}`} type="checkbox" disabled={loading || !duplicates.ready || Boolean(duplicates.reasons[index])} checked={selected.has(index) && !duplicates.reasons[index]} onChange={() => toggle(index)} /> Bài tập {index + 1}</label>{duplicates.reasons[index] ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{duplicates.reasons[index]}</span> : selected.has(index) && <Check className="text-emerald-600" size={18} aria-hidden="true" />}</header>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="module-field"><span>Tên bài tập</span><input aria-label={`Tên bài tập ${index + 1}`} placeholder="Nhập tên bài tập tiếng Anh" value={draft.name} onChange={(event) => updateDraft(index, 'name', event.target.value.replace(/[()[\]{}]/g, ''))} /></label>
                  <label className="module-field">
                    <span>Nhóm cơ</span>
                    <input
                      aria-label={`Nhóm cơ ${index + 1}`}
                      placeholder="Ví dụ: Ngực, Vai, Tay sau"
                      value={draft.muscleGroup}
                      onChange={(event) => {
                        const val = event.target.value;
                        const groups = val.split(',').map((s) => s.trim()).filter(Boolean);
                        setDrafts((current) =>
                          current.map((item, position) =>
                            position === index
                              ? { ...item, muscleGroup: val, muscleGroups: groups }
                              : item,
                          ),
                        );
                      }}
                    />
                  </label>
                  <label className="module-field"><span>Cấp độ</span><select aria-label={`Cấp độ ${index + 1}`} value={draft.level} onChange={(event) => updateDraft(index, 'level', event.target.value as Exercise['level'])}><option value="BEGINNER">Cơ bản</option><option value="INTERMEDIATE">Trung cấp</option><option value="ADVANCED">Nâng cao</option></select></label>
                  <label className="module-field"><span>Cách ghi nhận</span><select aria-label={`Cách ghi nhận ${index + 1}`} value={draft.defaultTrackingType} onChange={(event) => updateDraft(index, 'defaultTrackingType', event.target.value as ClassifiedTrackingType)}>{trackingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  <label className="module-field md:col-span-2"><span>Thiết bị, mỗi dòng một mục</span><textarea aria-label={`Thiết bị ${index + 1}`} placeholder="Ví dụ: Tạ đơn" value={draft.equipment.join('\n')} onChange={(event) => updateDraft(index, 'equipment', lines(event.target.value))} /></label>
                  <label className="module-field md:col-span-2"><span>Mô tả</span><textarea aria-label={`Mô tả ${index + 1}`} placeholder="Mô tả mục đích bài tập" value={draft.description} onChange={(event) => updateDraft(index, 'description', event.target.value)} /></label>
                  <label className="module-field md:col-span-2"><span>Kỹ thuật</span><textarea aria-label={`Kỹ thuật ${index + 1}`} placeholder="Hướng dẫn kỹ thuật chính" value={draft.technique} onChange={(event) => updateDraft(index, 'technique', event.target.value)} /></label>
                  {arrayFields.filter((field) => field !== 'equipment').map((field) => {
                    const labels: Record<Exclude<ArrayField, 'equipment'>, string> = { commonMistakes: 'Lỗi thường gặp', contraindications: 'Chống chỉ định', variants: 'Biến thể' };
                    return <label className="module-field" key={field}><span>{labels[field]}</span><textarea aria-label={`${labels[field]} ${index + 1}`} placeholder="Mỗi dòng một mục" value={draft[field].join('\n')} onChange={(event) => updateDraft(index, field, lines(event.target.value))} /></label>;
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{error}</p>}
    </FormModal>
  );
}

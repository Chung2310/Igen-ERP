import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import type { ProgressPhotoAngle, WorkoutProgressPhotoDraft } from '../../types';

const MAX_PHOTOS = 4;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const suggestedAngles: ProgressPhotoAngle[] = ['FRONT', 'SIDE', 'BACK', 'OTHER'];
const angleLabels: Record<ProgressPhotoAngle, string> = {
  FRONT: 'Chính diện',
  SIDE: 'Nghiêng',
  BACK: 'Phía sau',
  OTHER: 'Khác',
};

const key = () => globalThis.crypto?.randomUUID?.() || `photo-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function WorkoutProgressPhotoFields({ value, onChange, disabled = false }: { value: WorkoutProgressPhotoDraft[]; onChange: (value: WorkoutProgressPhotoDraft[]) => void; disabled?: boolean }) {
  const [error, setError] = useState('');
  const previewUrls = useRef(new Set<string>());

  useEffect(() => () => {
    for (const url of previewUrls.current) URL.revokeObjectURL?.(url);
  }, []);

  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (selected.length === 0) return;

    const invalid = selected.find((file) => !acceptedTypes.has(file.type) || file.size > MAX_FILE_SIZE);
    if (invalid) {
      setError('Chỉ nhận ảnh JPG, PNG hoặc WebP, tối đa 5 MB mỗi ảnh.');
      return;
    }

    const available = MAX_PHOTOS - value.length;
    if (available <= 0) {
      setError(`Mỗi buổi tập tải tối đa ${MAX_PHOTOS} ảnh.`);
      return;
    }

    const additions = selected.slice(0, available).map((file, index) => {
      const previewUrl = URL.createObjectURL?.(file) || '';
      if (previewUrl) previewUrls.current.add(previewUrl);
      return {
        id: key(),
        file,
        previewUrl,
        angle: suggestedAngles[value.length + index] || 'OTHER',
      } satisfies WorkoutProgressPhotoDraft;
    });

    setError(selected.length > available ? `Đã chọn ${available} ảnh đầu tiên. Mỗi buổi tập tối đa ${MAX_PHOTOS} ảnh.` : '');
    onChange([...value, ...additions]);
  };

  const remove = (draft: WorkoutProgressPhotoDraft) => {
    if (draft.previewUrl) {
      URL.revokeObjectURL?.(draft.previewUrl);
      previewUrls.current.delete(draft.previewUrl);
    }
    onChange(value.filter((item) => item.id !== draft.id));
    setError('');
  };

  const updateAngle = (id: string, angle: ProgressPhotoAngle) => onChange(value.map((item) => item.id === id ? { ...item, angle } : item));

  return (
    <fieldset className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/50 p-4 sm:p-5">
      <legend className="px-2">
        <span className="flex items-center gap-2 font-oswald text-lg font-bold uppercase text-primary">
          <Camera size={19} className="text-secondary" aria-hidden="true" />
          Ảnh tiến độ
          <span className="rounded-full bg-white px-2 py-1 font-montserrat text-[0.65rem] font-bold normal-case tracking-normal text-slate-500 ring-1 ring-slate-200">Không bắt buộc</span>
        </span>
      </legend>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-slate-600">Ảnh được lưu ở mốc ngày tập và tự động phân loại là ảnh trong quá trình tập luyện.</p>
        <label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-secondary bg-white px-4 py-2 text-sm font-bold text-primary transition hover:bg-sky-50 focus-within:ring-2 focus-within:ring-secondary focus-within:ring-offset-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 motion-reduce:transition-none">
          <ImagePlus size={17} aria-hidden="true" />
          Chọn ảnh tiến độ
          <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} aria-label="Chọn ảnh tiến độ" onChange={selectFiles} />
        </label>
      </div>

      {error && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900" role="alert">{error}</p>}

      {value.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {value.map((draft, index) => (
            <article className="overflow-hidden rounded-xl border border-slate-200 bg-white" key={draft.id}>
              <div className="relative aspect-[3/4] bg-slate-100">
                {draft.previewUrl ? <img className="h-full w-full object-cover" src={draft.previewUrl} alt={`Ảnh tiến độ ${index + 1}`} /> : <span className="flex h-full items-center justify-center text-slate-400"><Camera size={28} aria-hidden="true" /></span>}
                <button type="button" className="absolute right-2 top-2 inline-flex size-9 items-center justify-center rounded-full bg-white/95 text-red-600 shadow-sm transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 motion-reduce:transition-none" aria-label={`Xóa ảnh tiến độ ${index + 1}`} disabled={disabled} onClick={() => remove(draft)}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
              <label className="grid gap-1.5 p-3 text-xs font-bold text-slate-700">
                <span>Góc chụp</span>
                <select className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20" aria-label={`Góc chụp ảnh ${index + 1}`} value={draft.angle} disabled={disabled} onChange={(event) => updateAngle(draft.id, event.target.value as ProgressPhotoAngle)}>
                  {Object.entries(angleLabels).map(([angle, label]) => <option value={angle} key={angle}>{label}</option>)}
                </select>
              </label>
            </article>
          ))}
        </div>
      )}
    </fieldset>
  );
}

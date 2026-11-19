import type { TrackingType } from '../../../types';

interface Props { exerciseName: string; value: TrackingType; onChange: (value: TrackingType) => void; disabled?: boolean }

export default function TrackingTypeSelect({ exerciseName, value, onChange, disabled }: Props) {
  return <label className="grid gap-1 text-xs font-semibold text-slate-600"><span>Cách ghi nhận</span><select className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:border-secondary focus-visible:ring-2 focus-visible:ring-secondary/20" aria-label={`Cách ghi nhận cho ${exerciseName}`} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as TrackingType)}>
    <option value="UNCLASSIFIED" disabled>Chưa phân loại</option><option value="STRENGTH">Sức mạnh · mức tạ</option><option value="BODYWEIGHT">Trọng lượng cơ thể</option><option value="CARDIO">Cardio · quãng đường/thời gian</option><option value="INTERVAL">Interval · hiệp làm/nghỉ</option><option value="MOBILITY">Mobility · thời lượng/biên độ</option>
  </select></label>;
}

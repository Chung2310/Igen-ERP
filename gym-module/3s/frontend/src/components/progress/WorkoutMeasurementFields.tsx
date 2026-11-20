import { Ruler, Scale } from 'lucide-react';
import type { BodyMeasurementDraft, BodyMeasurementFieldKey } from '../../types';

interface MeasurementField {
  key: BodyMeasurementFieldKey;
  label: string;
  placeholder: string;
  min?: number;
  max?: number;
}

const primaryFields: MeasurementField[] = [
  { key: 'weight', label: 'Cân nặng (kg)', placeholder: 'Ví dụ: 72.5', min: 0.1 },
  { key: 'bodyFatPercentage', label: 'Tỷ lệ mỡ (%)', placeholder: 'Ví dụ: 18.5', max: 100 },
  { key: 'muscleMass', label: 'Khối lượng cơ (kg)', placeholder: 'Ví dụ: 32.4' },
];

const circumferenceFields: MeasurementField[] = [
  { key: 'chest', label: 'Vòng ngực (cm)', placeholder: 'Ví dụ: 96' },
  { key: 'waist', label: 'Vòng eo (cm)', placeholder: 'Ví dụ: 78' },
  { key: 'hips', label: 'Vòng hông (cm)', placeholder: 'Ví dụ: 94' },
  { key: 'arm', label: 'Vòng tay (cm)', placeholder: 'Ví dụ: 32' },
  { key: 'thigh', label: 'Vòng đùi (cm)', placeholder: 'Ví dụ: 55' },
  { key: 'calf', label: 'Bắp chân (cm)', placeholder: 'Ví dụ: 37' },
];

const inputClass = 'min-h-11 rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 motion-reduce:transition-none';

function MeasurementGrid({ fields, value, onChange }: { fields: MeasurementField[]; value: BodyMeasurementDraft; onChange: (value: BodyMeasurementDraft) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((field) => (
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700" key={field.key}>
          <span>{field.label}</span>
          <input
            className={inputClass}
            type="number"
            min={field.min ?? 0}
            max={field.max}
            step="0.1"
            inputMode="decimal"
            aria-label={field.label}
            placeholder={field.placeholder}
            value={value[field.key] || ''}
            onChange={(event) => onChange({ ...value, [field.key]: event.target.value })}
          />
        </label>
      ))}
    </div>
  );
}

export default function WorkoutMeasurementFields({ value, onChange }: { value: BodyMeasurementDraft; onChange: (value: BodyMeasurementDraft) => void }) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/50 p-4 sm:p-5">
      <legend className="px-2">
        <span className="flex items-center gap-2 font-oswald text-lg font-bold uppercase text-primary">
          <Scale size={19} className="text-secondary" aria-hidden="true" />
          Chỉ số tiến độ
          <span className="rounded-full bg-white px-2 py-1 font-montserrat text-[0.65rem] font-bold normal-case tracking-normal text-slate-500 ring-1 ring-slate-200">Không bắt buộc</span>
        </span>
      </legend>
      <p className="text-sm leading-6 text-slate-600">Số đo được lưu theo ngày tập và dùng để tạo biểu đồ thay đổi qua từng buổi.</p>
      <MeasurementGrid fields={primaryFields} value={value} onChange={onChange} />
      <details className="group rounded-xl border border-slate-200 bg-white p-3 open:pb-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary [&::-webkit-details-marker]:hidden">
          <Ruler size={17} className="text-secondary" aria-hidden="true" />
          Thêm số đo vòng
          <span className="ml-auto text-slate-400 transition group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true">⌄</span>
        </summary>
        <div className="mt-3 border-t border-slate-100 pt-4">
          <MeasurementGrid fields={circumferenceFields} value={value} onChange={onChange} />
        </div>
      </details>
    </fieldset>
  );
}

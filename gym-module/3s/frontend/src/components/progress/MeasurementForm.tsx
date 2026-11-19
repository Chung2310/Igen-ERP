import { useState, type FormEvent } from 'react';
import { api } from '../../services/api';
import { errorMessage } from '../../types';
import { useToast } from '../ui/ToastProvider';

const fields = [
  ['weight', 'Cân nặng (kg)'],
  ['bodyFatPercentage', 'Tỷ lệ mỡ (%)'],
  ['muscleMass', 'Khối lượng cơ (kg)'],
  ['chest', 'Vòng ngực (cm)'],
  ['waist', 'Vòng eo (cm)'],
  ['hips', 'Vòng hông (cm)'],
  ['arm', 'Vòng tay (cm)'],
  ['thigh', 'Vòng đùi (cm)'],
  ['calf', 'Bắp chân (cm)'],
] as const;

const circumference = new Set(['chest', 'waist', 'hips', 'arm', 'thigh', 'calf']);
const fieldClass = 'min-h-11 rounded-xl border border-slate-300 px-3 outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20';
const submitClass = 'inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 motion-reduce:transition-none';

export default function MeasurementForm({ customerId, onSaved }: { customerId: string; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<Record<string, string>>({ measuredAt: '' });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const body: Record<string, unknown> = {
        customerId,
        measuredAt: form.measuredAt,
        measurements: {},
      };

      for (const [key] of fields) {
        if (form[key] === undefined || form[key] === '') continue;
        const value = Number(form[key]);
        if (circumference.has(key)) {
          (body.measurements as Record<string, number>)[key] = value;
        } else {
          body[key] = value;
        }
      }

      const result = await api.post('/api/body-measurements', body);
      toast.success(result.message);
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <form
      aria-label="Ghi số đo"
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 font-montserrat sm:p-6"
      onSubmit={submit}
    >
      <div>
        <h2 className="font-oswald text-2xl font-bold uppercase text-primary">Ghi số đo</h2>
        <p className="mt-1 text-sm text-slate-500">Lưu các chỉ số InBody và số đo vòng để theo dõi thay đổi.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          <span>Ngày đo</span>
          <input
            className={fieldClass}
            type="date"
            aria-label="Ngày đo"
            value={form.measuredAt}
            onChange={(event) => setForm({ ...form, measuredAt: event.target.value })}
            required
          />
        </label>
        {fields.map(([key, label]) => (
          <label className="grid gap-1 text-sm font-semibold text-slate-700" key={key}>
            <span>{label}</span>
            <input
              className={fieldClass}
              type="number"
              min="0"
              step="0.1"
              aria-label={label}
              placeholder="Nhập số đo..."
              value={form[key] || ''}
              onChange={(event) => setForm({ ...form, [key]: event.target.value })}
            />
          </label>
        ))}
      </div>
      <button className={submitClass}>Lưu số đo</button>
    </form>
  );
}

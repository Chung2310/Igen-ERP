import { Trash2 } from 'lucide-react';
import type { CompletedSetResult } from '../../../types';
import TrackingNumberField from './TrackingNumberField';

interface Props {
  exerciseName: string;
  value: CompletedSetResult[];
  mode: 'STRENGTH' | 'BODYWEIGHT';
  targetReps?: string;
  targetWeight?: number;
  onChange: (sets: CompletedSetResult[]) => void;
}

const resultId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `set-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function SetResultEditor({
  exerciseName,
  value,
  mode,
  targetReps,
  targetWeight,
  onChange,
}: Props) {
  const update = (index: number, patch: Partial<CompletedSetResult>) =>
    onChange(
      value.map((set, position) => (position === index ? { ...set, ...patch } : set)),
    );

  const weightField =
    mode === 'STRENGTH'
      ? {
          key: 'weight' as const,
          label: 'Mức tạ (kg)',
          aria: 'mức tạ',
          placeholder: targetWeight,
        }
      : {
          key: 'addedWeight' as const,
          label: 'Tạ thêm (kg)',
          aria: 'tạ thêm',
          placeholder: targetWeight,
        };

  return (
    <div className="flex flex-col gap-2.5">
      {value.map((set, index) => (
        <div
          className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3"
          key={set.id || index}
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-[#003b70]">Set {index + 1}</span>
            {value.length > 1 && (
              <button
                className="text-button text-danger flex items-center gap-1 text-xs"
                type="button"
                aria-label={`Xóa set ${index + 1} của ${exerciseName}`}
                onClick={() => onChange(value.filter((_, position) => position !== index))}
              >
                <Trash2 size={13} />
                <span>Xóa set</span>
              </button>
            )}
          </div>

          <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-5 items-end">
            <TrackingNumberField
              label="REPS"
              ariaLabel={`${exerciseName} set ${index + 1} REPS`}
              value={set.reps}
              placeholder={targetReps}
              onChange={(reps) => update(index, { reps })}
            />
            <TrackingNumberField
              label={weightField.label}
              ariaLabel={`${exerciseName} set ${index + 1} ${weightField.aria}`}
              value={set[weightField.key]}
              placeholder={weightField.placeholder}
              step="0.5"
              onChange={(weight) => update(index, { [weightField.key]: weight })}
            />
            <TrackingNumberField
              label="RPE (1-10)"
              ariaLabel={`${exerciseName} set ${index + 1} RPE`}
              value={set.rpe}
              max={10}
              step="0.5"
              onChange={(rpe) => update(index, { rpe })}
            />
            <TrackingNumberField
              label="RIR"
              ariaLabel={`${exerciseName} set ${index + 1} RIR`}
              value={set.rir}
              onChange={(rir) => update(index, { rir })}
            />
            <label className="col-span-2 lg:col-span-1 flex items-center gap-2 h-10 px-3 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                checked={set.completed}
                onChange={(event) => update(index, { completed: event.target.checked })}
              />
              <span>Hoàn thành</span>
            </label>
          </div>
        </div>
      ))}

      <button
        className="button button-secondary self-start mt-1"
        type="button"
        aria-label={`Thêm set cho ${exerciseName}`}
        onClick={() => onChange([...value, { id: resultId(), completed: true }])}
      >
        + Thêm set
      </button>
    </div>
  );
}

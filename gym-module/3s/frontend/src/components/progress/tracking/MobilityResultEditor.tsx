import type { MobilityPrescription, MobilityResult } from '../../../types';
import TrackingNumberField from './TrackingNumberField';

interface Props {
  exerciseName: string;
  prescription: MobilityPrescription;
  value: MobilityResult;
  onChange: (value: MobilityResult) => void;
}

export default function MobilityResultEditor({
  exerciseName,
  prescription,
  value,
  onChange,
}: Props) {
  const set = (field: keyof MobilityResult, next: number | string | undefined) =>
    onChange({ ...(value || {}), [field]: next });

  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      <TrackingNumberField
        label="Thời lượng (phút)"
        ariaLabel={`${exerciseName} thời lượng (phút)`}
        value={value?.durationMinutes}
        placeholder={prescription?.durationMinutes}
        onChange={(next) => set('durationMinutes', next)}
      />
      <TrackingNumberField
        label="REPS"
        ariaLabel={`${exerciseName} REPS`}
        value={value?.reps}
        placeholder={prescription?.reps}
        onChange={(next) => set('reps', next)}
      />
      <div className="field">
        <label>Bên tập</label>
        <select
          aria-label={`${exerciseName} bên tập`}
          value={value?.side ?? prescription?.side ?? 'BOTH'}
          onChange={(event) => set('side', event.target.value)}
        >
          <option value="BOTH">Hai bên</option>
          <option value="LEFT">Trái</option>
          <option value="RIGHT">Phải</option>
        </select>
      </div>
      <TrackingNumberField
        label="Mức khó chịu (1-10)"
        ariaLabel={`${exerciseName} mức khó chịu`}
        value={value?.discomfort}
        placeholder={prescription?.targetDiscomfort}
        max={10}
        step="0.5"
        onChange={(next) => set('discomfort', next)}
      />
    </div>
  );
}

import type { StrengthPrescription, StrengthResult } from '../../../types';
import SetResultEditor from './SetResultEditor';

interface Props { exerciseName: string; prescription: StrengthPrescription; value: StrengthResult; onChange: (value: StrengthResult) => void }

export default function StrengthResultEditor({ exerciseName, prescription, value, onChange }: Props) {
  return <SetResultEditor exerciseName={exerciseName} mode="STRENGTH" value={value?.sets || []} targetReps={prescription?.reps} targetWeight={prescription?.targetWeight} onChange={(sets) => onChange({ sets })} />;
}

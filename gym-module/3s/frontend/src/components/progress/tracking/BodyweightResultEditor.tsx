import type { BodyweightPrescription, BodyweightResult } from '../../../types';
import SetResultEditor from './SetResultEditor';

interface Props { exerciseName: string; prescription: BodyweightPrescription; value: BodyweightResult; onChange: (value: BodyweightResult) => void }

export default function BodyweightResultEditor({ exerciseName, prescription, value, onChange }: Props) {
  return <SetResultEditor exerciseName={exerciseName} mode="BODYWEIGHT" value={value?.sets || []} targetReps={prescription?.reps} targetWeight={prescription?.addedWeight} onChange={(sets) => onChange({ sets })} />;
}

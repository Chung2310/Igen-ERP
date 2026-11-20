import type { TemplateMetadata } from '../../types/workoutStudio';

interface Props {
  value: TemplateMetadata;
  muscleGroupOptions: string[];
  readOnly?: boolean;
  onChange: (value: TemplateMetadata) => void;
}

export default function TemplateMetadataForm({ value, muscleGroupOptions, readOnly, onChange }: Props) {
  const patch = (next: Partial<TemplateMetadata>) => onChange({ ...value, ...next });
  const toggleMuscleGroup = (group: string) => patch({ muscleGroups: value.muscleGroups.includes(group) ? value.muscleGroups.filter((item) => item !== group) : [...value.muscleGroups, group] });
  return <div className="studio-metadata">
    <fieldset disabled={readOnly} className="studio-metadata-muscles">
      <legend>Nhóm cơ</legend>
      {muscleGroupOptions.length ? <div className="studio-muscle-options">{muscleGroupOptions.map((group) => <label key={group} className="studio-muscle-option"><input type="checkbox" checked={value.muscleGroups.includes(group)} onChange={() => toggleMuscleGroup(group)} /> {group}</label>)}</div> : <p className="studio-metadata-empty">Chưa có nhóm cơ trong thư viện.</p>}
    </fieldset>
    <div className="studio-metadata-grid">
      <label>Sets
        <input aria-label="Sets chung" placeholder="Ví dụ: 4" type="number" min="1" max="100" value={value.defaultSets ?? ''} disabled={readOnly} onChange={(event) => patch({ defaultSets: event.target.value ? Number(event.target.value) : undefined })} />
      </label>
      <label>Reps
        <input aria-label="Reps chung" placeholder="Ví dụ: 8-12" value={value.defaultReps} disabled={readOnly} onChange={(event) => patch({ defaultReps: event.target.value })} />
      </label>
      <label>Weight
        <input aria-label="Weight chung" placeholder="Ví dụ: 60-70% 1RM" value={value.defaultWeight} disabled={readOnly} onChange={(event) => patch({ defaultWeight: event.target.value })} />
      </label>
      <label>Tempo
        <input aria-label="Tempo chung" placeholder="Ví dụ: 3-1-1-0" value={value.defaultTempo} disabled={readOnly} onChange={(event) => patch({ defaultTempo: event.target.value })} />
      </label>
      <label className="studio-metadata-notes">Ghi chú kỹ thuật
        <textarea aria-label="Ghi chú kỹ thuật chung" placeholder="Nguyên tắc kỹ thuật áp dụng cho giáo án..." maxLength={2000} value={value.technicalNotes} disabled={readOnly} onChange={(event) => patch({ technicalNotes: event.target.value })} />
      </label>
    </div>
  </div>;
}

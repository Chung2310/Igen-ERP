import type { ScheduledExercise, TemplateMetadata } from '../../types/workoutStudio';
import ExerciseInspector from './ExerciseInspector';
import TemplateMetadataForm from './TemplateMetadataForm';

interface Props {
  activeTab: 'template' | 'exercise';
  metadata: TemplateMetadata;
  muscleGroupOptions: string[];
  readOnly?: boolean;
  selected?: ScheduledExercise;
  days: number[];
  onTabChange: (tab: 'template' | 'exercise') => void;
  onMetadataChange: (value: TemplateMetadata) => void;
  onExerciseUpdate: (patch: Partial<ScheduledExercise>) => void;
  onUnscheduled: () => void;
  onClose?: () => void;
}

export default function StudioSidebar(props: Props) {
  return <div className="studio-sidebar">
    <div className="studio-sidebar-tabs" role="tablist" aria-label="Thuộc tính Studio">
      <button type="button" role="tab" aria-selected={props.activeTab === 'template'} onClick={() => props.onTabChange('template')}>Giáo án</button>
      <button type="button" role="tab" aria-selected={props.activeTab === 'exercise'} onClick={() => props.onTabChange('exercise')}>Bài tập</button>
    </div>
    {props.activeTab === 'template'
      ? <TemplateMetadataForm value={props.metadata} muscleGroupOptions={props.muscleGroupOptions} readOnly={props.readOnly} onChange={props.onMetadataChange} />
      : <ExerciseInspector selected={props.selected} days={props.days} readOnly={props.readOnly} onUpdate={props.onExerciseUpdate} onUnscheduled={props.onUnscheduled} onClose={props.onClose} />}
  </div>;
}

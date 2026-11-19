import { Dumbbell, Film, Pencil, Trash2 } from 'lucide-react';
import { TRACKING_TYPE_LABELS, type Exercise } from '../../types';

interface Props {
  exercise: Exercise;
  onEdit: (exercise: Exercise) => void;
  onDelete: (exercise: Exercise) => void;
}

const levelLabels: Record<string, string> = {
  BEGINNER: 'Cơ bản',
  INTERMEDIATE: 'Trung cấp',
  ADVANCED: 'Nâng cao',
};

export default function ExerciseLibraryCard({ exercise, onEdit, onDelete }: Props) {
  const levelClass = exercise.level === 'ADVANCED' ? 'is-advanced' : exercise.level === 'INTERMEDIATE' ? 'is-intermediate' : 'is-beginner';
  return (
    <article aria-label={exercise.name} className="module-card exercise-card">
      <header className="exercise-card-header">
        <div className="exercise-card-identity">
          <span className="exercise-card-icon"><Dumbbell size={19} aria-hidden="true" /></span>
          <div className="exercise-card-copy">
            <h2 className="exercise-card-title">{exercise.name}</h2>
            <p className="exercise-card-equipment">{exercise.equipment?.length ? exercise.equipment.join(' · ') : 'Không yêu cầu thiết bị'}</p>
          </div>
        </div>
        <span className="exercise-badge is-global">Dùng chung</span>
      </header>

      <dl className="exercise-card-metrics">
        <div><dt>Nhóm cơ</dt><dd>{exercise.muscleGroup}</dd></div>
        <div><dt>Cấp độ</dt><dd><span className={`exercise-level ${levelClass}`}>{levelLabels[exercise.level] || exercise.level}</span></dd></div>
      </dl>

      <div className="exercise-card-tracking">
        <span className={`exercise-badge ${exercise.defaultTrackingType && exercise.defaultTrackingType !== 'UNCLASSIFIED' ? 'is-global' : 'is-unclassified'}`}>
          {TRACKING_TYPE_LABELS[exercise.defaultTrackingType ?? 'UNCLASSIFIED']}
        </span>
      </div>

      <div className="exercise-card-video">
        <p className="exercise-card-video-heading"><Film size={14} aria-hidden="true" /> {exercise.videos?.length || 0} video</p>
        {exercise.videos?.length ? <div className="exercise-card-video-links">{exercise.videos.map((video, index) => <a className="exercise-video-link" key={`${video.url}-${index}`} href={video.url} target="_blank" rel="noopener noreferrer">{video.title}</a>)}</div> : <p className="exercise-card-video-empty">Chưa có video hướng dẫn.</p>}
      </div>

      {exercise.canManage && <footer className="module-card-actions exercise-card-actions">
        <button type="button" aria-label={`Sửa ${exercise.name}`} className="exercise-card-action is-edit" onClick={() => onEdit(exercise)}><Pencil size={16} aria-hidden="true" /> Sửa</button>
        <button type="button" aria-label={`Xóa ${exercise.name}`} className="exercise-card-action is-delete" onClick={() => onDelete(exercise)}><Trash2 size={16} aria-hidden="true" /> Xóa</button>
      </footer>}
    </article>
  );
}

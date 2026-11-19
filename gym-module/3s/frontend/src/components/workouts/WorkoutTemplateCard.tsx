import { Archive, CalendarDays, Dumbbell, Pencil, Trash2, UserPlus } from 'lucide-react';
import type { WorkoutTemplate } from './WorkoutTemplateList';

interface Props {
  template: WorkoutTemplate;
  onEdit: (template: WorkoutTemplate) => void;
  onArchive: (template: WorkoutTemplate) => void;
  onDelete: (template: WorkoutTemplate) => void;
  onAssign?: (template: WorkoutTemplate) => void;
}

const levelLabels: Record<string, string> = {
  BEGINNER: 'Cơ bản',
  INTERMEDIATE: 'Trung cấp',
  ADVANCED: 'Nâng cao',
};

export default function WorkoutTemplateCard({ template, onEdit, onArchive, onDelete, onAssign }: Props) {
  const sessionCount = template.sessions.length;
  const exerciseCount = template.sessions.reduce((total, session) => total + session.exercises.length, 0);
  const statusLabel = template.status === 'ACTIVE' ? 'Đang dùng' : 'Đã lưu trữ';

  return (
    <article aria-label={template.title} className="module-card workout-template-card">
      <header className="workout-template-header">
        <div className="workout-template-copy">
          <p className="workout-template-kicker">Giáo án mẫu · v{template.version}</p>
          <h3 className="workout-template-title">{template.title}</h3>
        </div>
        <span className={`workout-template-status ${template.status === 'ACTIVE' ? 'is-active' : 'is-archived'}`}>
          {statusLabel}
        </span>
      </header>

      <dl className="workout-template-metrics">
        <div>
          <dt><CalendarDays size={13} aria-hidden="true" /> Lịch tập</dt>
          <dd>{sessionCount} buổi</dd>
        </div>
        <div>
          <dt><Dumbbell size={13} aria-hidden="true" /> Bài tập</dt>
          <dd>{exerciseCount} bài</dd>
        </div>
        <div>
          <dt>Cấp độ</dt>
          <dd>{levelLabels[template.level] || template.level}</dd>
        </div>
      </dl>

      <footer className="module-card-actions workout-template-actions">
        <button type="button" aria-label={`Chỉnh sửa ${template.title}`} className="workout-template-action is-primary" onClick={() => onEdit(template)}>
          <Pencil size={14} aria-hidden="true" /> Sửa
        </button>
        {onAssign && (
          <button type="button" aria-label={`Gán ${template.title} cho học viên`} className="workout-template-action is-secondary" onClick={() => onAssign(template)}>
            <UserPlus size={14} aria-hidden="true" /> Gán học viên
          </button>
        )}
        {template.status === 'ACTIVE' ? (
          <button type="button" aria-label={`Lưu trữ ${template.title}`} className="workout-template-action is-tertiary" onClick={() => onArchive(template)}>
            <Archive size={14} aria-hidden="true" /> Lưu trữ
          </button>
        ) : (
          <button type="button" aria-label={`Xóa ${template.title}`} className="workout-template-action is-danger" onClick={() => onDelete(template)}>
            <Trash2 size={14} aria-hidden="true" /> Xóa
          </button>
        )}
      </footer>
    </article>
  );
}

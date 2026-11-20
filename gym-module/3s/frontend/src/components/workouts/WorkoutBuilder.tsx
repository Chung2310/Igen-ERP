import { useEffect, useState, type FormEvent } from 'react';
import { useToast } from '../ui/ToastProvider';
import { api } from '../../services/api';
import { errorMessage } from '../../types';
import type { Exercise, TrackingPrescription, TrackingType } from '../../types';
import type { WorkoutTemplate } from './WorkoutTemplateList';
import FormModal from '../ui/FormModal';
import PrescriptionEditor from './tracking/PrescriptionEditor';
import TrackingTypeSelect from './tracking/TrackingTypeSelect';
import { changeTrackingType, normalizePlanExercise, planExerciseFromLibrary } from '../../utils/exerciseTracking';

interface TemplateExercise { exerciseId?: string; name: string; trackingType: TrackingType; prescription: TrackingPrescription; sets?: number; reps?: string; restSeconds?: number }
interface TemplateSession { name: string; exercises: TemplateExercise[] }
interface WorkoutBuilderProps { open?: boolean; onClose?: () => void; onSaved: () => void; template?: WorkoutTemplate | null }

export default function WorkoutBuilder({ open = true, onClose = () => undefined, onSaved, template = null }: WorkoutBuilderProps) {
  const toast = useToast();
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [level, setLevel] = useState('BEGINNER');
  const [sessions, setSessions] = useState<TemplateSession[]>([{ name: '', exercises: [] }]);
  const [loading, setLoading] = useState(false);
  const [invalidExercise, setInvalidExercise] = useState('');
  useEffect(() => { if (open) api.get<Exercise[]>('/api/exercises?page=1&limit=100').then(({ data }) => setLibrary(data)).catch((error: unknown) => toast.error(errorMessage(error))); }, [open, toast]);
  useEffect(() => {
    if (!open) return;
    if (template) {
      setTitle(template.title); setGoal(template.goal); setLevel(template.level);
      setSessions(template.sessions.map((session) => ({ ...session, exercises: session.exercises.map((exercise) => normalizePlanExercise({ ...exercise, exerciseId: exercise.exerciseId || '' }) as TemplateExercise) })));
    } else {
      setTitle(''); setGoal(''); setLevel('BEGINNER'); setSessions([{ name: '', exercises: [] }]);
    }
  }, [open, template]);
  const updateSessionName = (index: number, name: string) => setSessions((current) => current.map((session, sessionIndex) => sessionIndex === index ? { ...session, name } : session));
  const addExercise = (sessionIndex: number, exercise: Exercise) => setSessions((current) => current.map((session, index) => index === sessionIndex ? { ...session, exercises: [...session.exercises, planExerciseFromLibrary(exercise)] } : session));
  const updateExercise = (sessionIndex: number, exerciseIndex: number, value: TemplateExercise) => setSessions((current) => current.map((session, index) => index === sessionIndex ? { ...session, exercises: session.exercises.map((exercise, itemIndex) => itemIndex === exerciseIndex ? value : exercise) } : session));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !goal.trim()) {
      return toast.error('Vui lòng nhập tên giáo án và mục tiêu.');
    }
    if (!sessions.length) {
      return toast.error('Giáo án phải có ít nhất một buổi tập.');
    }
    const emptySessionIndex = sessions.findIndex((session) => !session.exercises.length);
    if (emptySessionIndex !== -1) {
      return toast.error(`Buổi ${emptySessionIndex + 1} (${sessions[emptySessionIndex].name || 'Chưa đặt tên'}) chưa có bài tập nào. Vui lòng thêm bài tập cho tất cả các buổi.`);
    }
    const unclassified = sessions.flatMap((session) => session.exercises).find((exercise) => exercise.trackingType === 'UNCLASSIFIED');
    if (unclassified) { setInvalidExercise(unclassified.name); return; }
    setInvalidExercise('');
    setLoading(true);
    try {
      const payload = { title, goal, level, sessions };
      const result = template ? await api.patch(`/api/workout-templates/${template._id}`, payload) : await api.post('/api/workout-templates', payload);
      toast.success(result.message);
      onSaved();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setLoading(false); }
  };
  const dirty = Boolean(title || goal || sessions.some((session) => session.name || session.exercises.length));
  return <FormModal open={open} title={template ? 'Sửa giáo án' : 'Tạo giáo án'} size="xl" dirty={dirty} loading={loading} submitLabel="Lưu giáo án" onClose={onClose} onSubmit={submit}><div className="form-grid"><label className="field"><span>Tên giáo án</span><input aria-label="Tên giáo án" placeholder="Ví dụ: Tăng cơ toàn thân 3 buổi/tuần..." value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label className="field"><span>Mục tiêu</span><input aria-label="Mục tiêu" placeholder="Ví dụ: Tăng cơ, giảm mỡ hoặc cải thiện sức bền..." value={goal} onChange={(event) => setGoal(event.target.value)} required /></label><label className="field"><span>Cấp độ</span><select aria-label="Cấp độ giáo án" value={level} onChange={(event) => setLevel(event.target.value)}><option value="BEGINNER">Cơ bản</option><option value="INTERMEDIATE">Trung cấp</option><option value="ADVANCED">Nâng cao</option></select></label></div>
    {invalidExercise && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">{invalidExercise} chưa có cách ghi nhận. Hãy phân loại trước khi lưu giáo án.</p>}
    {sessions.map((session, sessionIndex) => <fieldset key={sessionIndex}><legend>Buổi {sessionIndex + 1}</legend><label className="field"><span>Tên buổi</span><input aria-label={`Tên buổi ${sessionIndex + 1}`} placeholder="Ví dụ: Buổi 1 - Ngực và tay sau..." value={session.name} onChange={(event) => updateSessionName(sessionIndex, event.target.value)} required /></label><div className="inline-actions">{library.map((exercise) => <button className="button button-secondary" type="button" key={exercise._id} onClick={() => addExercise(sessionIndex, exercise)}>Thêm bài {exercise.name}</button>)}</div>{session.exercises.map((exercise, index) => <section className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4" key={`${exercise.exerciseId || exercise.name}-${index}`}><strong className="text-sm text-primary">{exercise.name}</strong><TrackingTypeSelect exerciseName={exercise.name} value={exercise.trackingType} onChange={(trackingType) => updateExercise(sessionIndex, index, changeTrackingType(exercise, trackingType))} /><p className="text-xs text-slate-500">Chỉ áp dụng cho giáo án này.</p><PrescriptionEditor exerciseName={exercise.name} trackingType={exercise.trackingType} value={exercise.prescription} onChange={(prescription) => updateExercise(sessionIndex, index, { ...exercise, prescription })} /></section>)}</fieldset>)}
    <div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => setSessions((current) => [...current, { name: '', exercises: [] }])}>Thêm buổi tập</button></div>
  </FormModal>;
}

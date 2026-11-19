import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { DAY_MINUTES, DAYS_PER_WEEK, hasOverlap, planDayIndex, planDaysForWeek, planWeekCount } from '../../services/workoutStudioModel';
import { recommendExercises } from '../../services/workoutExerciseRecommendations';
import { errorMessage, type Exercise } from '../../types';
import { useToast } from '../../components/ui/ToastProvider';
import ConfirmModal from '../../components/ui/ConfirmModal';
import StudioHeader from '../../components/workout-studio/StudioHeader';
import StudioDayNavigator from '../../components/workout-studio/StudioDayNavigator';
import DayTimeline from '../../components/workout-studio/DayTimeline';
import StudioSettingsModal from '../../components/workout-studio/StudioSettingsModal';
import StudioExerciseModal from '../../components/workout-studio/StudioExerciseModal';
import StudioUnscheduledSection from '../../components/workout-studio/StudioUnscheduledSection';
import StudioQuickLibrary from '../../components/workout-studio/StudioQuickLibrary';
import ExerciseLibraryModal from '../../components/workout-studio/ExerciseLibraryModal';
import type { WorkoutAvailabilitySlot } from '../../types/workoutAvailability';
import type { AiWorkoutStudioDraft, ScheduledExercise, StudioTemplate, TemplateMetadata } from '../../types/workoutStudio';
import { normalizePlanExercise, planExerciseFromLibrary } from '../../utils/exerciseTracking';

const createScheduled = (exercise: Exercise, weekNumber: number, dayNumber: number, startMinute: number): ScheduledExercise => ({
  id: crypto.randomUUID(),
  weekNumber,
  dayNumber,
  startMinute,
  durationMinutes: 60,
  muscleGroup: exercise.muscleGroup,
  ...planExerciseFromLibrary(exercise),
});

const hydrateScheduled = (item: Omit<ScheduledExercise, 'id'>): ScheduledExercise => {
  const normalizedWeek = item.dayNumber > DAYS_PER_WEEK ? Math.max(item.weekNumber || 1, Math.ceil(item.dayNumber / DAYS_PER_WEEK)) : item.weekNumber || 1;
  const normalizedDay = item.dayNumber > DAYS_PER_WEEK ? ((item.dayNumber - 1) % DAYS_PER_WEEK) + 1 : item.dayNumber;
  return normalizePlanExercise({ ...item, weekNumber: normalizedWeek, dayNumber: normalizedDay, id: crypto.randomUUID() });
};

const emptyMetadata: TemplateMetadata = { muscleGroups: [], defaultReps: '', defaultWeight: '', defaultTempo: '', technicalNotes: '' };
type PendingConfirmation = { kind: 'back' | 'navigate'; destination: string } | { kind: 'duration'; nextDays: number; affectedCount: number };

export default function WorkoutStudioPage() {
  const { templateId, customerId, planId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const customerMode = Boolean(customerId && planId);
  const readOnly = searchParams.get('readonly') === '1';

  // Plan basic info
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [level, setLevel] = useState('BEGINNER');
  const [durationDays, setDurationDays] = useState(7);
  const [metadata, setMetadata] = useState<TemplateMetadata>(emptyMetadata);
  const [customerName, setCustomerName] = useState('');

  // Active navigation
  const [activeWeek, setActiveWeek] = useState(1);
  const [activeDay, setActiveDay] = useState(1);

  // Exercises
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [items, setItems] = useState<ScheduledExercise[]>([]);
  const [unscheduled, setUnscheduled] = useState<ScheduledExercise[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [generatedExercises, setGeneratedExercises] = useState<unknown[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<WorkoutAvailabilitySlot[]>([]);

  // State flags & modals
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduledExercise | null>(null);

  // Filtered day items
  const dayItems = useMemo(
    () => items.filter((item) => (item.weekNumber || 1) === activeWeek && item.dayNumber === activeDay),
    [items, activeWeek, activeDay]
  );
  const totalMinutes = useMemo(
    () => dayItems.reduce((sum, item) => sum + item.durationMinutes, 0),
    [dayItems]
  );

  const weekButtons = useMemo(
    () => Array.from({ length: planWeekCount(durationDays) }, (_, index) => index + 1),
    [durationDays]
  );
  const dayButtons = useMemo(
    () => planDaysForWeek(durationDays, activeWeek),
    [durationDays, activeWeek]
  );

  const dayExerciseCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    items
      .filter((item) => (item.weekNumber || 1) === activeWeek)
      .forEach((item) => {
        counts[item.dayNumber] = (counts[item.dayNumber] || 0) + 1;
      });
    return counts;
  }, [items, activeWeek]);

  const recommendedExercises = useMemo(
    () => recommendExercises(library, { goal, level, muscleGroups: metadata.muscleGroups }),
    [library, goal, level, metadata.muscleGroups]
  );

  // Load exercise library
  useEffect(() => {
    api
      .get<Exercise[]>('/api/exercises?page=1&limit=100')
      .then(({ data }) => setLibrary(data))
      .catch((error: unknown) => toast.error(errorMessage(error)));
  }, [toast]);

  // Load from AI draft
  useEffect(() => {
    const draft = (location.state as { aiWorkoutDraft?: AiWorkoutStudioDraft } | null)?.aiWorkoutDraft;
    if (templateId || customerMode || !draft) {
      setAvailabilitySlots([]);
      return;
    }
    setTitle(draft.title || 'Giáo án AI');
    setGoal(draft.goal || '');
    setLevel(draft.level || 'BEGINNER');
    setDurationDays(Math.max(1, (draft.durationWeeks || 1) * 7));
    setItems((draft.scheduledExercises || []).map(hydrateScheduled));
    setGeneratedExercises(draft.generatedExercises || []);
    setAvailabilitySlots(draft.availabilitySlots || []);
    setDirty(true);
  }, [location.state, templateId, customerMode]);

  // Load from backend template / customer plan
  useEffect(() => {
    if (!templateId && !customerMode) return;
    setAvailabilitySlots([]);
    const resourcePath = customerMode ? `/api/customers/${customerId}/workout-plans/${planId}` : `/api/workout-templates/${templateId}`;
    api
      .get<StudioTemplate & { customerName?: string; customerId?: { fullName?: string } }>(resourcePath)
      .then(({ data }) => {
        setCustomerName(data.customerName || data.customerId?.fullName || 'Khách hàng');
        setTitle(data.title);
        setGoal(data.goal);
        setLevel(data.level);
        setDurationDays(data.durationDays || Math.max(1, data.sessions.length));
        setMetadata({
          muscleGroups: data.muscleGroups || [],
          defaultSets: data.defaultSets,
          defaultReps: data.defaultReps || '',
          defaultWeight: data.defaultWeight || '',
          defaultTempo: data.defaultTempo || '',
          technicalNotes: data.technicalNotes || '',
        });
        if (data.scheduledExercises?.length) setItems(data.scheduledExercises.map(hydrateScheduled));
        const persistedUnscheduled = data.unscheduledExercises?.map((exercise) => normalizePlanExercise({ ...exercise, id: crypto.randomUUID(), dayNumber: 1, startMinute: 0 })) || [];
        const legacyUnscheduled =
          !data.scheduledExercises?.length && !persistedUnscheduled.length
            ? data.sessions.flatMap((session) =>
                session.exercises.map((exercise) =>
                  normalizePlanExercise({
                    id: crypto.randomUUID(),
                    dayNumber: 1,
                    startMinute: 0,
                    durationMinutes: 60,
                    exerciseId: exercise.exerciseId,
                    name: exercise.name,
                    sets: exercise.sets,
                    reps: exercise.reps,
                    weight: exercise.weight == null ? '' : String(exercise.weight),
                    rpe: exercise.rpe,
                    rir: exercise.rir,
                    tempo: exercise.tempo,
                    restSeconds: exercise.restSeconds,
                    notes: exercise.notes,
                  })
                )
              )
            : [];
        setUnscheduled([...persistedUnscheduled, ...legacyUnscheduled]);
        setDirty(false);
      })
      .catch((error: unknown) => toast.error(errorMessage(error)));
  }, [templateId, customerMode, customerId, planId, toast]);

  // Before unload warning
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Link navigation guard
  useEffect(() => {
    if (!dirty) return;
    const guardInternalLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!target || target.target === '_blank' || target.hasAttribute('download')) return;
      const destination = new URL(target.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingConfirmation({ kind: 'navigate', destination: `${destination.pathname}${destination.search}${destination.hash}` });
    };
    document.addEventListener('click', guardInternalLink, true);
    return () => document.removeEventListener('click', guardInternalLink, true);
  }, [dirty]);

  const mutate = (next: ScheduledExercise[]) => {
    setItems(next);
    setDirty(true);
  };

  const getNextAvailableMinute = (targetItems: ScheduledExercise[]) => {
    const currentDayItems = targetItems.filter((item) => (item.weekNumber || 1) === activeWeek && item.dayNumber === activeDay);
    if (currentDayItems.length === 0) return 480; // 08:00
    const maxEnd = Math.max(...currentDayItems.map((item) => item.startMinute + item.durationMinutes));
    if (maxEnd + 60 <= DAY_MINUTES) return maxEnd;
    for (let m = 360; m <= 1320; m += 30) {
      const test = { weekNumber: activeWeek, dayNumber: activeDay, startMinute: m, durationMinutes: 60 };
      if (!hasOverlap(currentDayItems, test as ScheduledExercise)) return m;
    }
    return 480;
  };

  const place = (exercise: Exercise, startMinute?: number) => {
    const minute = startMinute ?? getNextAvailableMinute(items);
    const candidate = createScheduled(exercise, activeWeek, activeDay, Math.min(minute, 1380));
    if (hasOverlap(items, candidate)) {
      const fallbackMinute = getNextAvailableMinute(items);
      const fallbackCandidate = createScheduled(exercise, activeWeek, activeDay, Math.min(fallbackMinute, 1380));
      if (hasOverlap(items, fallbackCandidate)) {
        return toast.error('Ngày này đã kín khung giờ tập.');
      }
      mutate([...items, fallbackCandidate]);
      setSelectedId(fallbackCandidate.id);
      toast.success(`Đã thêm bài ${exercise.name} vào Ngày ${activeDay}`);
      return;
    }
    mutate([...items, candidate]);
    setSelectedId(candidate.id);
    toast.success(`Đã thêm bài ${exercise.name} vào Ngày ${activeDay}`);
  };

  const removeScheduled = (id: string) => {
    const removed = items.find((item) => item.id === id);
    mutate(items.filter((item) => item.id !== id));
    if (removed) {
      setUnscheduled((current) => [...current, removed]);
      toast.success(`Đã xóa bài ${removed.name} khỏi Ngày ${activeDay}`);
    }
    if (selectedId === id) {
      setSelectedId(undefined);
    }
    if (editingItem?.id === id) {
      setEditingItem(null);
    }
  };

  const placeUnscheduled = (item: ScheduledExercise) => {
    const nextMinute = getNextAvailableMinute(items);
    const candidate = {
      ...item,
      weekNumber: activeWeek,
      dayNumber: activeDay,
      startMinute: Math.min(nextMinute, DAY_MINUTES - (item.durationMinutes || 60)),
    };
    if (hasOverlap(items, candidate)) {
      return toast.error('Khung giờ này đã có bài tập.');
    }
    mutate([...items, candidate]);
    setUnscheduled((current) => current.filter((value) => value.id !== item.id));
    setSelectedId(item.id);
    toast.success(`Đã xếp bài ${item.name} vào Ngày ${activeDay}`);
  };

  const updateSelected = (patch: Partial<ScheduledExercise>) => {
    const target = editingItem;
    if (!target) return;
    const candidate = { ...target, ...patch };
    const otherItems = items.filter((x) => x.id !== target.id);
    if (candidate.startMinute + candidate.durationMinutes > DAY_MINUTES || hasOverlap(otherItems, candidate)) {
      return toast.error('Thời gian bài tập không hợp lệ hoặc bị trùng.');
    }
    mutate(items.map((item) => (item.id === target.id ? candidate : item)));
    setEditingItem(candidate);
    toast.success('Đã cập nhật thông số bài tập.');
  };

  const handleUnscheduleFromModal = () => {
    if (!editingItem) return;
    mutate(items.filter((item) => item.id !== editingItem.id));
    setUnscheduled((current) => [...current, editingItem]);
    setSelectedId(undefined);
    setEditingItem(null);
    toast.success(`Đã chuyển bài ${editingItem.name} về Chưa xếp lịch.`);
  };

  const applyDurationDays = (next: number) => {
    const affected = items.filter((item) => planDayIndex(item) > next);
    if (affected.length) {
      setUnscheduled((current) => [...current, ...affected]);
      setItems((current) => current.filter((item) => planDayIndex(item) <= next));
    }
    setDurationDays(next);
    const nextActiveWeek = Math.min(activeWeek, planWeekCount(next));
    const nextWeekDays = planDaysForWeek(next, nextActiveWeek);
    setActiveWeek(nextActiveWeek);
    setActiveDay((day) => Math.min(day, nextWeekDays.length));
    setDirty(true);
  };

  const changeDurationDays = (raw: number) => {
    const next = Math.max(1, Math.min(365, raw));
    const affectedCount = items.filter((item) => planDayIndex(item) > next).length;
    if (affectedCount) {
      setPendingConfirmation({ kind: 'duration', nextDays: next, affectedCount });
      return;
    }
    applyDurationDays(next);
  };

  const save = async () => {
    if (readOnly) return;
    if (!title.trim() || !goal.trim() || !items.length) {
      return toast.error('Vui lòng nhập thông tin giáo án và xếp ít nhất một bài tập vào lịch.');
    }

    const invalid = [...items, ...unscheduled].find((item) => item.trackingType === 'UNCLASSIFIED' || !item.trackingType);
    if (invalid) {
      const scheduledInvalid = items.find((item) => item.id === invalid.id);
      if (scheduledInvalid) {
        setSelectedId(scheduledInvalid.id);
        setEditingItem(scheduledInvalid);
      }
      return toast.error(`Bài tập ${invalid.name} chưa có cách ghi nhận. Vui lòng cập nhật thông số bài tập.`);
    }

    setSaving(true);
    try {
      const scheduledExercises = items.map((item) => ({
        exerciseId: item.exerciseId,
        name: item.name,
        muscleGroup: item.muscleGroup || '',
        trackingType: item.trackingType,
        prescription: item.prescription,
        weekNumber: item.weekNumber || 1,
        dayNumber: item.dayNumber,
        startMinute: item.startMinute,
        durationMinutes: item.durationMinutes,
        ...(item.sets !== undefined ? { sets: item.sets } : {}),
        ...(item.reps !== undefined ? { reps: item.reps } : {}),
        ...(item.weight !== undefined ? { weight: item.weight } : {}),
        ...(item.rpe !== undefined ? { rpe: item.rpe } : {}),
        ...(item.rir !== undefined ? { rir: item.rir } : {}),
        ...(item.tempo !== undefined ? { tempo: item.tempo } : {}),
        ...(item.restSeconds !== undefined ? { restSeconds: item.restSeconds } : {}),
        ...(item.notes !== undefined ? { notes: item.notes } : {}),
      }));

      const unscheduledExercises = unscheduled.map((item) => ({
        exerciseId: item.exerciseId,
        name: item.name,
        muscleGroup: item.muscleGroup || '',
        trackingType: item.trackingType,
        prescription: item.prescription,
        durationMinutes: item.durationMinutes,
        ...(item.sets !== undefined ? { sets: item.sets } : {}),
        ...(item.reps !== undefined ? { reps: item.reps } : {}),
        ...(item.weight !== undefined ? { weight: item.weight } : {}),
        ...(item.rpe !== undefined ? { rpe: item.rpe } : {}),
        ...(item.rir !== undefined ? { rir: item.rir } : {}),
        ...(item.tempo !== undefined ? { tempo: item.tempo } : {}),
        ...(item.restSeconds !== undefined ? { restSeconds: item.restSeconds } : {}),
        ...(item.notes !== undefined ? { notes: item.notes } : {}),
      }));

      const payload = {
        title,
        goal,
        level,
        durationDays,
        ...metadata,
        scheduledExercises,
        unscheduledExercises,
        ...(generatedExercises.length ? { generatedExercises } : {}),
      };

      const result = customerMode
        ? await api.patch<{ _id: string }>(`/api/customers/${customerId}/workout-plans/${planId}`, payload)
        : templateId
          ? await api.patch<{ _id: string }>(`/api/workout-templates/${templateId}`, payload)
          : await api.post<{ _id: string }>('/api/workout-templates', payload);

      toast.success(result.message || 'Đã lưu giáo án thành công!');
      setDirty(false);
      if (!templateId && !customerMode) {
        navigate(`/pt/my-workout-plans/${result.data._id}/edit`, { replace: true });
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const confirmPendingAction = () => {
    const pending = pendingConfirmation;
    setPendingConfirmation(undefined);
    if (!pending) return;
    if (pending.kind === 'back' || pending.kind === 'navigate') navigate(pending.destination);
    if (pending.kind === 'duration') applyDurationDays(pending.nextDays);
  };

  return (
    <section aria-label="Workout Studio" className="module-page workout-studio w-full max-w-[1720px] mx-auto px-2 sm:px-4 py-2 pb-24">
      {/* Studio Header: Compact & Unified */}
      <StudioHeader
        contextLabel={customerMode ? `Giáo án của ${customerName}` : undefined}
        readOnly={readOnly}
        title={title}
        goal={goal}
        level={level}
        durationDays={durationDays}
        dirty={dirty}
        saving={saving}
        activeWeek={activeWeek}
        activeDay={activeDay}
        dayItemsCount={dayItems.length}
        totalScheduledCount={items.length}
        unscheduledCount={unscheduled.length}
        onBack={() => {
          const destination = customerMode ? '/pt/customers' : '/pt/my-workout-plans';
          if (dirty) setPendingConfirmation({ kind: 'back', destination });
          else navigate(destination);
        }}
        onTitleChange={(value) => {
          setTitle(value);
          setDirty(true);
        }}
        onGoalChange={(value) => {
          setGoal(value);
          setDirty(true);
        }}
        onLevelChange={(value) => {
          setLevel(value);
          setDirty(true);
        }}
        onDurationDaysChange={changeDurationDays}
        onSave={() => void save()}
        onOpenSettings={() => setShowSettingsModal(true)}
      />

      {/* Week Selector Bar (if plan > 1 week) */}
      {weekButtons.length > 1 && (
        <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto pb-0.5 no-scrollbar">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
            Tuần:
          </span>
          {weekButtons.map((week) => (
            <button
              key={week}
              type="button"
              onClick={() => {
                setActiveWeek(week);
                setActiveDay((day) => Math.min(day, planDaysForWeek(durationDays, week).length));
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                week === activeWeek
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              Tuần {week}
            </button>
          ))}
        </div>
      )}

      {/* 2-Column Responsive Studio Workspace (No Side Blank Spaces) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* Left Column (Main Agenda Timeline): ~65% width */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-3">
          {/* Day Switcher / Navigator */}
          <StudioDayNavigator
            days={dayButtons}
            activeDay={activeDay}
            activeWeek={activeWeek}
            totalDays={durationDays}
            dayExerciseCounts={dayExerciseCounts}
            totalMinutes={totalMinutes}
            onChange={setActiveDay}
          />

          {/* Main Agenda Timeline */}
          <DayTimeline
            activeDay={activeDay}
            items={dayItems}
            selectedId={selectedId}
            onSelect={(id) => {
              const it = items.find((x) => x.id === id);
              if (it) setEditingItem(it);
              setSelectedId(id);
            }}
            onAddExercise={() => setShowLibraryModal(true)}
            onRemoveExercise={removeScheduled}
            onUnscheduleExercise={(id) => {
              const removed = items.find((item) => item.id === id);
              if (removed) {
                mutate(items.filter((item) => item.id !== id));
                setUnscheduled((current) => [...current, removed]);
                toast.success(`Đã chuyển bài ${removed.name} về Chưa xếp lịch`);
              }
            }}
            readOnly={readOnly}
          />
        </div>

        {/* Right Column (Side Utility Panels): ~35% width */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-3 lg:sticky lg:top-2">
          {/* Quick Exercise Library Picker */}
          <StudioQuickLibrary
            library={library}
            activeDay={activeDay}
            onPlaceExercise={place}
            onOpenFullModal={() => setShowLibraryModal(true)}
            readOnly={readOnly}
          />

          {/* Unscheduled Exercises Section */}
          <StudioUnscheduledSection
            unscheduled={unscheduled}
            activeDay={activeDay}
            onPlaceUnscheduled={placeUnscheduled}
            onRemoveUnscheduled={(id) => {
              setUnscheduled((current) => current.filter((x) => x.id !== id));
              toast.success('Đã xóa bài khỏi danh sách chưa xếp lịch');
            }}
            readOnly={readOnly}
          />
        </div>
      </div>

      {/* Modal: Cài đặt thông tin giáo án */}
      <StudioSettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title={title}
        goal={goal}
        level={level}
        durationDays={durationDays}
        technicalNotes={metadata.technicalNotes}
        onTitleChange={(value) => {
          setTitle(value);
          setDirty(true);
        }}
        onGoalChange={(value) => {
          setGoal(value);
          setDirty(true);
        }}
        onLevelChange={(value) => {
          setLevel(value);
          setDirty(true);
        }}
        onDurationDaysChange={changeDurationDays}
        onTechnicalNotesChange={(notes) => {
          setMetadata((prev) => ({ ...prev, technicalNotes: notes }));
          setDirty(true);
        }}
        readOnly={readOnly}
      />

      {/* Modal: Chỉnh sửa bài tập chuyên sâu */}
      <StudioExerciseModal
        open={Boolean(editingItem)}
        item={editingItem}
        days={dayButtons}
        onClose={() => setEditingItem(null)}
        onUpdate={updateSelected}
        onUnscheduled={handleUnscheduleFromModal}
        onRemove={() => {
          if (editingItem) removeScheduled(editingItem.id);
        }}
        readOnly={readOnly}
      />

      {/* Modal: Thư viện chọn bài tập mở rộng */}
      <ExerciseLibraryModal
        open={showLibraryModal}
        onClose={() => setShowLibraryModal(false)}
        library={library}
        recommendations={recommendedExercises}
        activeDay={activeDay}
        onSelectExercise={place}
      />

      {/* Confirm modal for leaving or reducing days */}
      <ConfirmModal
        open={Boolean(pendingConfirmation)}
        title={
          pendingConfirmation?.kind === 'back'
            ? 'Bỏ thay đổi chưa lưu?'
            : pendingConfirmation?.kind === 'navigate'
              ? 'Rời Studio?'
              : 'Giảm số ngày giáo án?'
        }
        description={
          pendingConfirmation?.kind === 'duration'
            ? `${pendingConfirmation.affectedCount} bài tập ở các ngày bị cắt sẽ chuyển về Chưa xếp lịch.`
            : 'Các chỉnh sửa chưa lưu trong Studio sẽ bị mất.'
        }
        danger={pendingConfirmation?.kind !== 'duration'}
        confirmLabel={
          pendingConfirmation?.kind === 'back'
            ? 'Bỏ thay đổi'
            : pendingConfirmation?.kind === 'navigate'
              ? 'Rời Studio'
              : 'Tiếp tục'
        }
        onClose={() => setPendingConfirmation(undefined)}
        onConfirm={confirmPendingAction}
      />
    </section>
  );
}

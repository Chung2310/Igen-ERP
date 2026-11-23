import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  Plus,
  Save,
  Search,
  Settings2,
} from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { ErpModal } from "../../components/common/ErpModal";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import type { GymList, GymRecord } from "../../../shared/gym/types";
import type { GymApi } from "./api";
import { Feedback, Field, GymEmptyState, messageOf, primary, secondary, useGymQuery } from "./ui";
import { Dropdown } from "./GymDropdown";
import { DAY_MINUTES, hasScheduleOverlap, nextAvailableMinute, validSchedule } from "./workoutSchedule";
import WorkoutLibraryModal from "./WorkoutLibraryModal";
import { recommendExercises } from "./workoutExerciseRecommendations";
import WorkoutDayAgenda from "./WorkoutDayAgenda";

type Item = {
  key: string;
  exerciseId?: string;
  name: string;
  muscleGroup?: string;
  trackingType: string;
  prescription: Record<string, string | number>;
  weekNumber?: number;
  dayNumber?: number;
  startMinute?: number;
  durationMinutes: number;
  notes?: string;
};

const trackingOptions: [string, string][] = [
  ["STRENGTH", "Sức mạnh"],
  ["BODYWEIGHT", "Trọng lượng cơ thể"],
  ["CARDIO", "Cardio"],
  ["INTERVAL", "Interval"],
  ["MOBILITY", "Linh hoạt"],
];

const fields: Record<string, Array<[string, string, ("text" | "number")?]>> = {
  STRENGTH: [
    ["sets", "Sets"],
    ["reps", "Reps", "text"],
    ["targetWeight", "Tạ (kg)"],
    ["targetRpe", "RPE"],
    ["targetRir", "RIR"],
    ["restSeconds", "Nghỉ (giây)"],
  ],
  BODYWEIGHT: [
    ["sets", "Sets"],
    ["reps", "Reps", "text"],
    ["addedWeight", "Tạ thêm (kg)"],
    ["targetRpe", "RPE"],
    ["targetRir", "RIR"],
    ["restSeconds", "Nghỉ (giây)"],
  ],
  CARDIO: [
    ["durationMinutes", "Thời gian (phút)"],
    ["distanceKm", "Quãng đường (km)"],
    ["targetPaceSecondsPerKm", "Pace (s/km)"],
    ["targetHeartRate", "Nhịp tim (bpm)"],
    ["inclinePercent", "Độ dốc (%)"],
    ["targetRpe", "RPE"],
  ],
  INTERVAL: [
    ["rounds", "Vòng"],
    ["workSeconds", "Tập (giây)"],
    ["restSeconds", "Nghỉ (giây)"],
    ["distanceMetersPerRound", "Mét/vòng"],
    ["repsPerRound", "Reps/vòng"],
    ["targetRpe", "RPE"],
  ],
  MOBILITY: [
    ["durationMinutes", "Thời gian (phút)"],
    ["reps", "Reps"],
    ["targetDiscomfort", "Mức khó chịu (1–10)"],
  ],
};

const key = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

const fromRecord = (record?: GymRecord, initialSchedule?: any[]): Item[] => {
  if (record?.scheduledExercises?.length)
    return record.scheduledExercises.map((item: any) => ({ ...item, key: key() }));
  return (record?.schedule || initialSchedule || []).flatMap((day: any) =>
    (day.exercises || []).map((exercise: any, index: number) => ({
      key: key(),
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      trackingType: exercise.trackingType || "STRENGTH",
      prescription: exercise.prescription || {
        sets: exercise.sets || 3,
        reps: exercise.reps || "12",
        targetWeight: exercise.weight || 0,
        restSeconds: exercise.restSeconds || 60,
      },
      weekNumber: Math.floor((Number(day.day || 1) - 1) / 7) + 1,
      dayNumber: ((Number(day.day || 1) - 1) % 7) + 1,
      startMinute: index * 60,
      durationMinutes: 60,
      notes: exercise.notes,
    })),
  );
};

export default function WorkoutStudio({
  api,
  record,
  initialValues,
  initialSchedule,
  customerId,
  readOnly = false,
  onBack,
  onSaved,
}: {
  api: GymApi;
  record?: GymRecord;
  initialValues?: Record<string, any>;
  initialSchedule?: any[];
  customerId?: string;
  readOnly?: boolean;
  onBack: () => void;
  onSaved: () => void;
}) {
  const seed = { ...record, ...initialValues };
  const [liveRecord, setLiveRecord] = useState<GymRecord | undefined>(record);
  const [title, setTitle] = useState(String(seed.title || ""));
  const [goal, setGoal] = useState(String(seed.goal || ""));
  const [level, setLevel] = useState(String(seed.level || "BEGINNER"));
  const [templateStatus, setTemplateStatus] = useState(String(seed.status || "ACTIVE"));
  const [durationDays, setDurationDays] = useState(
    Number(seed.durationDays || (seed.durationWeeks ? seed.durationWeeks * 7 : 7)),
  );
  const [metadata, setMetadata] = useState({
    muscleGroups: (seed.muscleGroups || []) as string[],
    defaultSets: Number(seed.defaultSets || 3),
    defaultReps: String(seed.defaultReps || "12"),
    defaultWeight: String(seed.defaultWeight || ""),
    defaultTempo: String(seed.defaultTempo || ""),
    technicalNotes: String(seed.technicalNotes || ""),
  });
  const [items, setItems] = useState<Item[]>(() => fromRecord(record, initialSchedule));
  const [unscheduled, setUnscheduled] = useState<Item[]>(() =>
    (record?.unscheduledExercises || []).map((item: any) => ({ ...item, key: key() })),
  );
  const [week, setWeek] = useState(1);
  const [day, setDay] = useState(1);
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editKey, setEditKey] = useState<string>();
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [confirmBackOpen, setConfirmBackOpen] = useState(false);
  const [pendingDurationDays, setPendingDurationDays] = useState<number | null>(null);

  const library = useGymQuery<GymList>(api, "/exercises?limit=100");
  const exercises = library.data?.data || [];
  const groups = [...new Set(exercises.map((item) => item.muscleGroup).filter(Boolean))];
  const filtered = exercises.filter(
    (item) =>
      (!search ||
        String(item.name)
          .toLocaleLowerCase("vi")
          .includes(search.toLocaleLowerCase("vi"))) &&
      (!muscle || item.muscleGroup === muscle),
  );
  const recommendations = useMemo(
    () =>
      recommendExercises(exercises as any[], {
        goal,
        level,
        muscleGroups: metadata.muscleGroups,
      }),
    [exercises, goal, level, metadata.muscleGroups],
  );
  const daysThisWeek = Array.from(
    { length: Math.min(7, durationDays - (week - 1) * 7) },
    (_, i) => i + 1,
  );
  const dayItems = items.filter((item) => item.weekNumber === week && item.dayNumber === day);
  const selected = [...items, ...unscheduled].find((item) => item.key === editKey);
  const weekCount = Math.ceil(durationDays / 7);
  const totalMinutes = dayItems.reduce((sum, item) => sum + Number(item.durationMinutes || 0), 0);
  const ordered = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          (a.weekNumber || 1) * 7 +
            (a.dayNumber || 1) -
            ((b.weekNumber || 1) * 7 + (b.dayNumber || 1)) ||
          (a.startMinute || 0) - (b.startMinute || 0),
      ),
    [items],
  );
  const mutate = (fn: () => void) => {
    if (readOnly) return;
    setDirty(true);
    fn();
  };

  const editItem = (patch: Partial<Item>) => {
    if (readOnly) return;
    if (selected?.dayNumber !== undefined && selected.startMinute !== undefined) {
      const candidate = { ...selected, ...patch };
      if (
        candidate.startMinute === undefined ||
        candidate.startMinute < 0 ||
        candidate.durationMinutes < 1 ||
        candidate.startMinute + candidate.durationMinutes > DAY_MINUTES ||
        hasScheduleOverlap(items, candidate)
      ) {
        setError("Thời gian bài tập vượt quá một ngày hoặc trùng với bài tập khác.");
        return;
      }
    }
    setError("");
    mutate(() => {
      setItems((list) => list.map((item) => (item.key === editKey ? { ...item, ...patch } : item)));
      setUnscheduled((list) =>
        list.map((item) => (item.key === editKey ? { ...item, ...patch } : item)),
      );
    });
  };

  const place = (exercise: GymRecord) => {
    if (readOnly) return;
    const minute = nextAvailableMinute(items, week, day);
    if (minute === null) {
      setError("Ngày này không còn khoảng trống 60 phút để xếp bài tập.");
      return;
    }
    setError("");
    mutate(() =>
      setItems((list) => [
        ...list,
        {
          key: key(),
          exerciseId: exercise._id,
          name: exercise.name,
          muscleGroup: exercise.muscleGroup,
          trackingType:
            exercise.defaultTrackingType || exercise.trackingType || "STRENGTH",
          prescription: {
            sets: metadata.defaultSets,
            reps: metadata.defaultReps,
            targetWeight: metadata.defaultWeight || 0,
            restSeconds: 60,
          },
          weekNumber: week,
          dayNumber: day,
          startMinute: minute,
          durationMinutes: 60,
        },
      ]),
    );
  };

  const placeUnscheduled = (item: Item) => {
    if (readOnly) return;
    const minute = nextAvailableMinute(items, week, day, item.durationMinutes);
    if (minute === null) {
      setError(`Ngày này không còn khoảng trống cho ${item.name}.`);
      return;
    }
    setError("");
    mutate(() => {
      setUnscheduled((list) => list.filter((entry) => entry.key !== item.key));
      setItems((list) => [
        ...list,
        { ...item, weekNumber: week, dayNumber: day, startMinute: minute },
      ]);
    });
  };

  const navigateBack = () => {
    if (readOnly || !dirty) {
      onBack();
      return;
    }
    setConfirmBackOpen(true);
  };

  const save = async () => {
    if (readOnly) return;
    if (!title.trim() || !goal.trim() || !items.length) {
      setError("Nhập tên, mục tiêu và xếp ít nhất một bài tập vào lịch.");
      return;
    }
    const unclassified = [...items, ...unscheduled].find(
      (item) => !item.trackingType || item.trackingType === "UNCLASSIFIED",
    );
    if (unclassified) {
      setEditKey(unclassified.key);
      setError(`Bài tập ${unclassified.name} chưa có cách ghi nhận.`);
      return;
    }
    if (!validSchedule(items)) {
      setError("Lịch bài tập có giờ trùng nhau hoặc vượt quá một ngày. Hãy sửa trước khi lưu.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const clean = ({ key: _key, ...rest }: Item) => rest;
      const schedule = Array.from(
        new Set(
          ordered.map(
            (item) => (Number(item.weekNumber || 1) - 1) * 7 + Number(item.dayNumber || 1),
          ),
        ),
      ).map((globalDay) => ({
        day: globalDay,
        title: `Tuần ${Math.ceil(globalDay / 7)} · Ngày ${((globalDay - 1) % 7) + 1}`,
        exercises: ordered
          .filter(
            (item) =>
              (Number(item.weekNumber || 1) - 1) * 7 + Number(item.dayNumber || 1) ===
              globalDay,
          )
          .map((item) => ({
            exerciseId: item.exerciseId,
            name: item.name,
            trackingType: item.trackingType,
            prescription: item.prescription,
            sets: Number(item.prescription.sets || 0),
            reps: String(item.prescription.reps || ""),
            weight: Number(item.prescription.targetWeight || 0),
            restSeconds: Number(item.prescription.restSeconds || 0),
            notes: item.notes || "",
          })),
      }));
      const saved = await api.save(
        customerId ? "workout-plans" : "workout-templates",
        {
          ...(customerId
            ? {
                customerId,
                startDate: liveRecord?.startDate || null,
                endDate: liveRecord?.endDate || null,
              }
            : {}),
          ...(!customerId && !liveRecord && seed.generatedExercises?.length
            ? { generatedExercises: seed.generatedExercises }
            : {}),
          title: title.trim(),
          goal: goal.trim(),
          level,
          durationWeeks: weekCount,
          durationDays,
          ...metadata,
          scheduledExercises: ordered.map(clean),
          unscheduledExercises: unscheduled.map(clean),
          schedule,
          status: customerId ? liveRecord?.status || "ACTIVE" : templateStatus,
          description: liveRecord?.description || "",
        },
        liveRecord,
      );
      setLiveRecord(saved);
      setDirty(false);
      onSaved();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  };

  const togglePublishCustomerPlan = async () => {
    if (!customerId || !liveRecord?._id || readOnly) return;
    setPublishing(true);
    setError("");
    const isPub = liveRecord.publicationStatus === "PUBLISHED";
    try {
      const updated = await api.request<GymRecord>(
        `/workout-plans/${liveRecord._id}/${isPub ? "unpublish" : "publish"}`,
        "PATCH",
        { revision: liveRecord.revision },
      );
      setLiveRecord(updated);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPublishing(false);
    }
  };

  const isPublishedPlan = liveRecord?.publicationStatus === "PUBLISHED";

  return (
    <section className="flex min-h-full flex-1 flex-col gap-3" aria-label="Studio giáo án">
      <header className="space-y-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className={secondary}
              onClick={navigateBack}
              aria-label="Về danh sách giáo án"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant">
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                  {level === "BEGINNER"
                    ? "Cơ bản"
                    : level === "INTERMEDIATE"
                      ? "Trung cấp"
                      : "Nâng cao"}
                </span>
                <span>{durationDays} NGÀY</span>
                {liveRecord?.revision && <span>· v{liveRecord.revision}</span>}
                {readOnly && <HrStatusBadge tone="neutral">Chỉ xem (Đã lưu trữ)</HrStatusBadge>}
                {customerId && liveRecord && !readOnly && (
                  <HrStatusBadge tone={isPublishedPlan ? "success" : "warning"}>
                    {isPublishedPlan ? "Đã công bố" : "Bản nháp"}
                  </HrStatusBadge>
                )}
              </div>
              <h1 className="text-lg font-semibold text-on-surface">
                {title || "Giáo án mới"}
              </h1>
            </div>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-on-surface-variant">
                {dirty ? "Chưa lưu" : "Đã lưu"}
              </span>
              {customerId && liveRecord?._id && liveRecord.status === "ACTIVE" && (
                <button
                  type="button"
                  className={secondary}
                  disabled={publishing || dirty}
                  title={dirty ? "Hãy lưu thay đổi trước khi công bố" : undefined}
                  onClick={() => void togglePublishCustomerPlan()}
                >
                  {isPublishedPlan ? (
                    <EyeOff className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Eye className="size-3.5" aria-hidden="true" />
                  )}
                  {publishing
                    ? "Đang cập nhật..."
                    : isPublishedPlan
                      ? "Thu hồi về nháp"
                      : "Công bố giáo án"}
                </button>
              )}
              <button
                type="button"
                className={secondary}
                onClick={() => setSettingsOpen(true)}
              >
                <Settings2 className="size-4" /> Cài đặt
              </button>
              <button
                type="button"
                className={primary}
                disabled={saving}
                onClick={() => void save()}
              >
                <Save className="size-4" />
                {saving ? "Đang lưu..." : "Lưu giáo án"}
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-4 border-t border-outline-variant pt-2 text-xs text-on-surface-variant">
          <span>
            Tuần {week} · Ngày {day} ({dayItems.length} bài)
          </span>
          <span>{items.length} bài đã xếp</span>
          {unscheduled.length > 0 && <span>{unscheduled.length} bài chưa xếp</span>}
          {metadata.technicalNotes && (
            <span className="truncate text-on-surface">Lưu ý: {metadata.technicalNotes}</span>
          )}
        </div>
      </header>

      <Feedback error={error} />

      <div
        className={
          readOnly
            ? "space-y-3"
            : "grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_340px]"
        }
      >
        <div className="space-y-3">
          {weekCount > 1 && (
            <div className="flex gap-1.5 overflow-x-auto">
              {Array.from({ length: weekCount }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className={week === i + 1 ? primary : secondary}
                  onClick={() => {
                    setWeek(i + 1);
                    setDay(1);
                  }}
                >
                  Tuần {i + 1}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2 rounded-md border border-outline-variant bg-surface-container-lowest p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={secondary}
                  disabled={day === 1}
                  onClick={() => setDay(day - 1)}
                  aria-label="Ngày trước"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <strong className="text-sm">
                  Tuần {week} · Ngày {day}
                </strong>
                <span className="text-xs text-on-surface-variant">
                  (ngày {(week - 1) * 7 + day}/{durationDays})
                </span>
                <button
                  type="button"
                  className={secondary}
                  disabled={day === daysThisWeek.length}
                  onClick={() => setDay(day + 1)}
                  aria-label="Ngày sau"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
              <span className="inline-flex items-center gap-1 text-xs tabular-nums text-on-surface-variant">
                <Clock3 className="size-3.5" />
                {totalMinutes} phút
              </span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto">
              {daysThisWeek.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={day === n ? primary : secondary}
                  onClick={() => setDay(n)}
                >
                  Ngày {n}
                  {items.filter((item) => item.weekNumber === week && item.dayNumber === n)
                    .length > 0 &&
                    ` (${items.filter((item) => item.weekNumber === week && item.dayNumber === n).length})`}
                </button>
              ))}
            </div>
          </div>

          {!readOnly && (
            <div className="flex items-center justify-between rounded-md border border-outline-variant bg-surface-container-lowest p-3">
              <div>
                <strong className="text-sm text-on-surface">Ngày {day}</strong>
                <p className="text-xs text-on-surface-variant">
                  {dayItems.length} bài tập · {totalMinutes} phút
                </p>
              </div>
              <button
                type="button"
                className={primary}
                onClick={() =>
                  document.getElementById("gym-studio-library-search")?.focus()
                }
              >
                <Plus className="size-4" /> Thêm bài tập
              </button>
            </div>
          )}

          <WorkoutDayAgenda
            day={day}
            items={dayItems}
            onAdd={() => {
              if (!readOnly) setLibraryOpen(true);
            }}
            onEdit={(item) => {
              if (!readOnly) setEditKey(item.key);
            }}
            onUnschedule={(item) => {
              if (readOnly) return;
              mutate(() => {
                setItems((list) => list.filter((entry) => entry.key !== item.key));
                setUnscheduled((list) => [
                  ...list,
                  {
                    ...item,
                    weekNumber: undefined,
                    dayNumber: undefined,
                    startMinute: undefined,
                  } as Item,
                ]);
              });
            }}
            onRemove={(item) => {
              if (readOnly) return;
              mutate(() =>
                setItems((list) => list.filter((entry) => entry.key !== item.key)),
              );
            }}
          />

          {!readOnly && unscheduled.length > 0 && (
            <div className="space-y-2 rounded-md border border-outline-variant bg-surface-container-lowest p-3">
              <h3 className="text-sm font-semibold">
                Chưa xếp lịch ({unscheduled.length})
              </h3>
              {unscheduled.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span>{item.name}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className={secondary}
                      onClick={() => placeUnscheduled(item)}
                    >
                      + Ngày {day}
                    </button>
                    <button
                      type="button"
                      className={secondary}
                      onClick={() => setEditKey(item.key)}
                    >
                      Sửa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!readOnly && (
          <aside className="space-y-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Thư viện bài tập ({exercises.length})
              </h2>
              <button
                type="button"
                className="cursor-pointer text-xs text-primary hover:underline"
                onClick={() => setLibraryOpen(true)}
              >
                Mở rộng
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-on-surface-variant" />
              <input
                id="gym-studio-library-search"
                aria-label="Tìm bài tập"
                className="w-full rounded-md border border-outline-variant bg-surface-container-low px-8 py-2 text-xs"
                placeholder="Tìm bài tập nhanh..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Dropdown
              aria-label="Nhóm cơ"
              className="w-full"
              value={muscle}
              onChange={setMuscle}
              options={[
                { value: "", label: `Tất cả nhóm cơ (${exercises.length})` },
                ...groups.map((group) => ({ value: group, label: group })),
              ]}
            />
            <Feedback loading={library.loading} error={library.error} />
            <div className="max-h-[480px] space-y-1.5 overflow-y-auto">
              {!library.loading && !library.error && !filtered.length && (
                <GymEmptyState
                  kind="training"
                  filtered={Boolean(search || muscle)}
                  title={
                    search || muscle
                      ? "Không tìm thấy bài tập phù hợp."
                      : "Chưa có bài tập trong thư viện."
                  }
                />
              )}
              {filtered.map((exercise) => (
                <div
                  key={exercise._id}
                  className="flex items-center justify-between gap-2 rounded-md border border-outline-variant p-2"
                >
                  <div className="min-w-0">
                    <span className="text-[10px] text-on-surface-variant">
                      {exercise.muscleGroup || "Toàn thân"} ·{" "}
                      {exercise.defaultTrackingType || "STRENGTH"}
                    </span>
                    <p className="truncate text-xs font-semibold">{exercise.name}</p>
                  </div>
                  <button
                    type="button"
                    className={primary}
                    onClick={() => place(exercise)}
                  >
                    <Plus className="size-3.5" /> Ngày {day}
                  </button>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {!readOnly && libraryOpen && (
        <WorkoutLibraryModal
          exercises={exercises}
          recommendations={recommendations}
          day={day}
          onPlace={place}
          onClose={() => setLibraryOpen(false)}
        />
      )}

      {!readOnly && settingsOpen && (
        <ErpModal
          native
          title="Cài đặt giáo án"
          onClose={() => setSettingsOpen(false)}
          maxWidth="max-w-xl"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                label="Tên giáo án"
                required
                value={title}
                onChange={(value) => mutate(() => setTitle(value))}
              />
            </div>
            <div className="sm:col-span-2">
              <Field
                label="Mục tiêu"
                required
                value={goal}
                onChange={(value) => mutate(() => setGoal(value))}
              />
            </div>
            <Field
              label="Cấp độ"
              value={level}
              onChange={(value) => mutate(() => setLevel(value))}
              options={[
                ["BEGINNER", "Cơ bản"],
                ["INTERMEDIATE", "Trung cấp"],
                ["ADVANCED", "Nâng cao"],
              ]}
            />
            <Field
              label="Số ngày"
              type="number"
              min={1}
              max={365}
              value={durationDays}
              onChange={(value) => {
                const nextDays = Number(value) || 1;
                if (
                  items.some(
                    (item) =>
                      ((item.weekNumber || 1) - 1) * 7 + (item.dayNumber || 1) >
                      nextDays,
                  )
                ) {
                  setPendingDurationDays(nextDays);
                  return;
                }
                mutate(() => {
                  setDurationDays(nextDays);
                  setWeek(1);
                  setDay(1);
                });
              }}
            />
            {!customerId && (
              <Field
                label="Trạng thái mẫu"
                value={templateStatus}
                onChange={(value) => mutate(() => setTemplateStatus(value))}
                options={[
                  ["ACTIVE", "Đang dùng"],
                  ["DRAFT", "Bản nháp"],
                  ["ARCHIVED", "Đã lưu trữ"],
                ]}
              />
            )}
            <Field
              label="Sets mặc định"
              type="number"
              min={1}
              value={metadata.defaultSets}
              onChange={(value) =>
                mutate(() =>
                  setMetadata((v) => ({ ...v, defaultSets: Number(value) || 3 })),
                )
              }
            />
            <Field
              label="Reps mặc định"
              value={metadata.defaultReps}
              onChange={(value) =>
                mutate(() => setMetadata((v) => ({ ...v, defaultReps: value })))
              }
            />
            <Field
              label="Mức tạ mặc định"
              value={metadata.defaultWeight}
              onChange={(value) =>
                mutate(() => setMetadata((v) => ({ ...v, defaultWeight: value })))
              }
              placeholder="VD: 20kg hoặc RPE 7"
            />
            <Field
              label="Tempo mặc định"
              value={metadata.defaultTempo}
              onChange={(value) =>
                mutate(() => setMetadata((v) => ({ ...v, defaultTempo: value })))
              }
              placeholder="VD: 3-1-1-0"
            />
            <div className="sm:col-span-2">
              <Field
                label="Lưu ý kỹ thuật"
                multiline
                value={metadata.technicalNotes}
                onChange={(value) =>
                  mutate(() => setMetadata((v) => ({ ...v, technicalNotes: value })))
                }
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className={primary}
              onClick={() => setSettingsOpen(false)}
            >
              Xong
            </button>
          </div>
        </ErpModal>
      )}

      {!readOnly && selected && (
        <ErpModal
          native
          title={`Thông số bài tập: ${selected.name}`}
          onClose={() => setEditKey(undefined)}
          maxWidth="max-w-xl"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Cách ghi nhận"
              value={selected.trackingType}
              options={trackingOptions}
              onChange={(value) => editItem({ trackingType: value, prescription: {} })}
            />
            <Field
              label="Thời lượng (phút)"
              type="number"
              min={1}
              value={selected.durationMinutes}
              onChange={(value) =>
                editItem({ durationMinutes: Number(value) || 1 })
              }
            />
            {selected.dayNumber && (
              <Field
                label="Bắt đầu (phút từ 00:00)"
                type="number"
                min={0}
                value={selected.startMinute || 0}
                onChange={(value) => editItem({ startMinute: Number(value) || 0 })}
              />
            )}
            {(fields[selected.trackingType] || []).map(([field, label, fieldType]) => (
              <Field
                key={field}
                label={label}
                type={fieldType || "number"}
                min={0}
                value={selected.prescription?.[field] ?? ""}
                onChange={(value) =>
                  editItem({
                    prescription: { ...selected.prescription, [field]: value },
                  })
                }
              />
            ))}
            <div className="sm:col-span-2">
              <Field
                label="Ghi chú"
                multiline
                value={selected.notes || ""}
                onChange={(value) => editItem({ notes: value })}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className={primary}
              onClick={() => setEditKey(undefined)}
            >
              Xong
            </button>
          </div>
        </ErpModal>
      )}

      <ConfirmDialog
        native
        appearance="erp"
        isOpen={confirmBackOpen}
        title="Giáo án chưa lưu"
        description="Bạn có thay đổi chưa lưu. Bạn có chắc muốn quay lại danh sách giáo án?"
        confirmLabel="Quay lại danh sách"
        cancelLabel="Tiếp tục chỉnh sửa"
        onClose={() => setConfirmBackOpen(false)}
        onConfirm={() => {
          setConfirmBackOpen(false);
          onBack();
        }}
      />

      <ConfirmDialog
        native
        appearance="erp"
        isOpen={pendingDurationDays !== null}
        title="Thay đổi thời lượng giáo án"
        description="Các bài tập ngoài thời hạn mới sẽ được chuyển về mục Chưa xếp lịch. Bạn có muốn tiếp tục?"
        confirmLabel="Tiếp tục"
        cancelLabel="Hủy"
        onClose={() => setPendingDurationDays(null)}
        onConfirm={() => {
          if (pendingDurationDays === null) return;
          const nextDays = pendingDurationDays;
          setPendingDurationDays(null);
          mutate(() => {
            setUnscheduled((list) => [
              ...list,
              ...items.filter(
                (item) =>
                  ((item.weekNumber || 1) - 1) * 7 + (item.dayNumber || 1) >
                  nextDays,
              ),
            ]);
            setItems((list) =>
              list.filter(
                (item) =>
                  ((item.weekNumber || 1) - 1) * 7 + (item.dayNumber || 1) <=
                  nextDays,
              ),
            );
            setDurationDays(nextDays);
            setWeek(1);
            setDay(1);
          });
        }}
      />
    </section>
  );
}

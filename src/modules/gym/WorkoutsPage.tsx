import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Calendar, Database, Dumbbell, Eye, Layers, Pencil, PlayCircle, Plus, Sparkles, Trash2, UserPlus } from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { Dropdown } from "./GymDropdown";
import { ErpModal } from "../../components/common/ErpModal";
import { ErpRefreshButton } from "../../components/common/ErpRefreshButton";
import { primaryCreateButtonClass } from "../../components/common/primaryCreateButton";
import { TableFilterToolbar } from "../../components/common/TableFilterToolbar";
import { TablePagination } from "../../components/common/TablePagination";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import type { GymList, GymRecord } from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import { AssignPlan } from "./CustomerDetail";
import RecordEditor from "./RecordEditor";
import WorkoutStudio from "./WorkoutStudio";
import { MuscleGroupDialog, type MuscleGroup } from "./MuscleGroupDialog";
import { Feedback, Field, GymEmptyState, messageOf, panel, secondary, useGymQuery } from "./ui";

const templateStatusMeta: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  ACTIVE: { label: "Đang dùng", tone: "success" },
  DRAFT: { label: "Bản nháp", tone: "warning" },
  ARCHIVED: { label: "Đã lưu trữ", tone: "neutral" },
};

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Cơ bản",
  INTERMEDIATE: "Trung cấp",
  ADVANCED: "Nâng cao",
};

const TRACKING_LABELS: Record<string, string> = {
  STRENGTH: "Sức mạnh",
  BODYWEIGHT: "Trọng lượng cơ thể",
  CARDIO: "Cardio",
  INTERVAL: "Interval",
  MOBILITY: "Mobility",
};

export default function WorkoutsPage({
  api,
  canWrite,
}: {
  api: GymApi;
  canWrite: boolean;
}) {
  const [sub, setSub] = useState<"workout-templates" | "exercises">("workout-templates");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [trackingFilter, setTrackingFilter] = useState("");
  const [seedingExercises, setSeedingExercises] = useState(false);
  const autoSeededRef = useRef(false);
  const [muscleDialogOpen, setMuscleDialogOpen] = useState(false);
  const [muscleRevision, setMuscleRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{
    entity: "workout-templates" | "exercises";
    record?: GymRecord;
    initialValues?: Record<string, any>;
    initialSchedule?: any[];
  }>();
  const [aiModal, setAiModal] = useState<"workout-templates" | "exercises">();
  const [detail, setDetail] = useState<GymRecord>();
  const [assign, setAssign] = useState<GymRecord>();
  const [deleting, setDeleting] = useState<{ entity: "workout-templates" | "exercises"; record: GymRecord }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = () => { setRevision(v => v + 1); setMuscleRevision(v => v + 1); };
  const query = new URLSearchParams({
    page: String(page),
    limit: "12",
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
  });
  const result = useGymQuery<GymList>(api, `/workout-templates?${query}`, revision);
  const customersQuery = useGymQuery<GymList>(api, "/customers?limit=200", 0);
  const exercisesQuery = useGymQuery<GymList>(
    api,
    `/exercises?limit=200${search && sub === "exercises" ? `&search=${encodeURIComponent(search)}` : ""}`,
    revision,
  );
  const muscleQuery = useGymQuery<MuscleGroup[]>(api, "/muscle-groups", muscleRevision);
  const rows = result.data?.data || [];
  const allExercises = exercisesQuery.data?.data || [];
  const muscleGroups = muscleQuery.data?.map(group => group.name) || [];

  const seedDefaultExercises = async () => {
    if (seedingExercises) return;
    setSeedingExercises(true);
    setError("");
    try {
      await api.request("/exercises/seed-defaults", "POST", {});
      refresh();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSeedingExercises(false);
    }
  };

  useEffect(() => {
    if (
      sub === "exercises" &&
      canWrite &&
      !autoSeededRef.current &&
      !exercisesQuery.loading &&
      exercisesQuery.data &&
      exercisesQuery.data.meta.total === 0 &&
      !search.trim()
    ) {
      autoSeededRef.current = true;
      void seedDefaultExercises();
    }
  }, [sub, canWrite, exercisesQuery.loading, exercisesQuery.data, search]);

  const filteredExercises = useMemo(
    () =>
      allExercises.filter((e) => {
        if (muscleFilter) {
          const list = Array.isArray(e.muscleGroups) && e.muscleGroups.length > 0
            ? e.muscleGroups
            : String(e.muscleGroup || "").split(",").map((s) => s.trim());
          if (!list.includes(muscleFilter)) return false;
        }
        if (levelFilter && (e.level || "BEGINNER") !== levelFilter) return false;
        if (trackingFilter && (e.trackingType || "STRENGTH") !== trackingFilter) return false;
        return true;
      }),
    [allExercises, muscleFilter, levelFilter, trackingFilter],
  );

  if (editor?.entity === "workout-templates") return <WorkoutStudio api={api} record={editor.record} initialValues={editor.initialValues} initialSchedule={editor.initialSchedule} onBack={() => setEditor(undefined)} onSaved={() => { setEditor(undefined); refresh(); }} />;

  return (
    <section className="flex min-h-full flex-1 flex-col gap-3" aria-label="Giáo án">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant">
        <nav aria-label="Giáo án và bài tập" className="flex gap-1 overflow-x-auto">
          {([
            ["workout-templates", "Giáo án mẫu", BookOpen],
            ["exercises", "Bài tập", Dumbbell],
          ] as const).map(([key, label, Icon]) => {
            const active = sub === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setSub(key)}
                className={cn(
                  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3.5 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
                  active
                    ? "border-primary font-semibold text-primary"
                    : "border-transparent font-medium text-on-surface-variant hover:border-outline-variant hover:text-on-surface",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </nav>
        <div className="flex flex-wrap items-center gap-2 pb-1.5">
          <ErpRefreshButton loading={result.loading || exercisesQuery.loading} onClick={refresh} />
          {sub === "exercises" && <button type="button" className={secondary} onClick={() => setMuscleDialogOpen(true)}>
            <Layers className="size-4" aria-hidden="true" /> Quản lý nhóm cơ
          </button>}
          {canWrite && (
            <>
              <button
                type="button"
                className="inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-primary"
                onClick={() => setAiModal(sub)}
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                {sub === "exercises" ? "AI tạo bài tập" : "AI tạo giáo án"}
              </button>
              <button
                type="button"
                className={cn(primaryCreateButtonClass, "min-h-9")}
                onClick={() => setEditor({ entity: sub })}
              >
                <Plus className="size-3.5 stroke-[2.5]" aria-hidden="true" />
                {sub === "exercises" ? "Thêm bài tập" : "Tạo giáo án"}
              </button>
            </>
          )}
        </div>
      </div>

      {sub === "workout-templates" ? (
        <div className="flex flex-1 flex-col gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 sm:p-4">
          <TableFilterToolbar
            appearance="plain"
            search={{
              value: search,
              onChange: value => { setSearch(value); setPage(1); },
              placeholder: "Tìm theo tên hoặc mục tiêu giáo án...",
              ariaLabel: "Tìm giáo án",
              className: "min-w-0",
            }}
            totalCount={result.data?.meta.total}
            countLabel="giáo án"
            hasActiveFilters={Boolean(search.trim() || status)}
            onResetFilters={() => { setSearch(""); setStatus(""); setPage(1); }}
          >
            <Dropdown
              aria-label="Trạng thái giáo án"
              variant="filter"
              value={status}
              onChange={value => { setStatus(value); setPage(1); }}
              options={[
                { value: "", label: "Tất cả trạng thái" },
                { value: "ACTIVE", label: "Đang dùng" },
                { value: "DRAFT", label: "Bản nháp" },
                { value: "ARCHIVED", label: "Đã lưu trữ" },
              ]}
            />
          </TableFilterToolbar>

          <Feedback error={result.error || error} loading={result.loading} />

          {!result.loading && !result.error && !rows.length && (
            <GymEmptyState
              kind="training"
              filtered={Boolean(search.trim() || status)}
              title="Chưa có giáo án mẫu."
            />
          )}

          {!result.loading && !result.error && rows.length > 0 && (
            <div className="flex-1">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map(row => {
                const statusInfo = templateStatusMeta[row.status] || { label: row.status || "Bản nháp", tone: "neutral" as const };
                const schedule: any[] = Array.isArray(row.schedule) ? row.schedule : [];
                const exerciseCount = schedule.reduce((sum, day) => sum + (Array.isArray(day.exercises) ? day.exercises.length : 0), 0);
                return (
                  <article
                    key={row._id}
                    className="flex flex-col justify-between rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs transition-colors hover:border-primary/40"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium tabular-nums text-on-surface-variant">
                          {row.durationWeeks || 4} tuần
                        </span>
                        <HrStatusBadge dot tone={statusInfo.tone}>{statusInfo.label}</HrStatusBadge>
                      </div>

                      <div>
                        <h3 className="text-balance text-base font-semibold text-on-surface">{row.title}</h3>
                        {row.goal && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-on-surface-variant">{row.goal}</p>
                        )}
                      </div>

                      <dl className="grid grid-cols-3 divide-x divide-outline-variant/60 rounded-md border border-outline-variant/60 bg-surface-container-low/60 py-2 text-center tabular-nums">
                        <div className="px-2">
                          <dt className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant">
                            <Calendar className="size-3" aria-hidden="true" />
                            Lịch tập
                          </dt>
                          <dd className="mt-0.5 text-sm font-semibold text-on-surface">{schedule.length} buổi</dd>
                        </div>
                        <div className="px-2">
                          <dt className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant">
                            <Dumbbell className="size-3" aria-hidden="true" />
                            Bài tập
                          </dt>
                          <dd className="mt-0.5 text-sm font-semibold text-on-surface">{exerciseCount} bài</dd>
                        </div>
                        <div className="px-2">
                          <dt className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant">
                            <Layers className="size-3" aria-hidden="true" />
                            Cấp độ
                          </dt>
                          <dd className="mt-0.5 truncate text-sm font-semibold text-on-surface">{row.level || "Cơ bản"}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/70 pt-3">
                      <div className="flex items-center gap-1.5">
                        {canWrite && (
                          <button
                            type="button"
                            className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
                            onClick={() => setEditor({ entity: "workout-templates", record: row })}
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                            Sửa
                          </button>
                        )}
                        {canWrite && row.status !== "ARCHIVED" && (
                          <button
                            type="button"
                            className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-primary"
                            onClick={() => setAssign(row)}
                          >
                            <UserPlus className="size-3.5" aria-hidden="true" />
                            Giao giáo án
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Xem chi tiết giáo án"
                          title="Chi tiết"
                          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-outline-variant text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                          onClick={() => setDetail(row)}
                        >
                          <Eye className="size-4" aria-hidden="true" />
                        </button>
                        {canWrite && (
                          <button
                            type="button"
                            aria-label="Xóa giáo án"
                            title="Xóa"
                            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-error/30 text-error hover:bg-error-container/30"
                            onClick={() => { setError(""); setDeleting({ entity: "workout-templates", record: row }); }}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
              </div>
            </div>
          )}

          {result.data && (
            <TablePagination
              appearance="erp"
              currentPage={page}
              totalPages={result.data.meta.totalPages}
              pageSize={12}
              totalItems={result.data.meta.total}
              pageSizeOptions={[12]}
              onPageChange={setPage}
              onPageSizeChange={() => {}}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 sm:p-4">
          <TableFilterToolbar
            appearance="plain"
            actions={
              canWrite ? (
                <button
                  type="button"
                  disabled={seedingExercises}
                  aria-label="Khôi phục danh sách bài tập mặc định"
                  title="Khôi phục danh sách bài tập mặc định"
                  className={cn(secondary, "size-9 p-0")}
                  onClick={() => void seedDefaultExercises()}
                >
                  <Database className="size-3.5" aria-hidden="true" />
                </button>
              ) : undefined
            }
            search={{
              value: search,
              onChange: value => setSearch(value),
              placeholder: "Tìm bài tập theo tên, nhóm cơ, dụng cụ...",
              ariaLabel: "Tìm bài tập",
              className: "min-w-0",
            }}
            totalCount={filteredExercises.length}
            countLabel="bài tập"
            hasActiveFilters={Boolean(search.trim() || muscleFilter || levelFilter || trackingFilter)}
            onResetFilters={() => { setSearch(""); setMuscleFilter(""); setLevelFilter(""); setTrackingFilter(""); }}
          >
            <Dropdown
              aria-label="Lọc theo cấp độ"
              variant="filter"
              value={levelFilter}
              onChange={setLevelFilter}
              options={[
                { value: "", label: "Tất cả cấp độ" },
                { value: "BEGINNER", label: "Cơ bản" },
                { value: "INTERMEDIATE", label: "Trung cấp" },
                { value: "ADVANCED", label: "Nâng cao" },
              ]}
            />
            <Dropdown
              aria-label="Lọc theo cách ghi nhận"
              variant="filter"
              value={trackingFilter}
              onChange={setTrackingFilter}
              options={[
                { value: "", label: "Tất cả cách ghi nhận" },
                { value: "STRENGTH", label: "Sức mạnh" },
                { value: "BODYWEIGHT", label: "Trọng lượng cơ thể" },
                { value: "CARDIO", label: "Cardio" },
                { value: "INTERVAL", label: "Interval" },
                { value: "MOBILITY", label: "Mobility" },
              ]}
            />
          </TableFilterToolbar>

          {muscleGroups.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                aria-pressed={!muscleFilter}
                onClick={() => setMuscleFilter("")}
                className={cn(
                  "cursor-pointer rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
                  !muscleFilter ? "border-primary bg-primary text-on-primary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container",
                )}
              >
                Tất cả ({allExercises.length})
              </button>
              {muscleGroups.map(group => (
                <button
                  key={group}
                  type="button"
                  aria-pressed={muscleFilter === group}
                  onClick={() => setMuscleFilter(group)}
                  className={cn(
                    "cursor-pointer rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
                    muscleFilter === group ? "border-primary bg-primary text-on-primary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container",
                  )}
                >
                  {group}
                </button>
              ))}
            </div>
          )}

          <Feedback error={exercisesQuery.error || error} loading={exercisesQuery.loading} />
          {!exercisesQuery.loading && !filteredExercises.length && (
            <GymEmptyState
              kind="training"
              filtered={Boolean(search.trim() || muscleFilter)}
              title="Chưa có bài tập."
            />
          )}

          {filteredExercises.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredExercises.map(ex => (
                <article key={ex._id} className="flex flex-col justify-between rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs transition-colors hover:border-primary/40">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <HrStatusBadge tone="info" className="normal-case">{ex.muscleGroup || "Nhóm cơ"}</HrStatusBadge>
                      <div className="flex flex-wrap items-center gap-1">
                        {ex.level && (
                          <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                            {LEVEL_LABELS[ex.level] || ex.level}
                          </span>
                        )}
                        {ex.trackingType && (
                          <span className="rounded bg-surface-container px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">
                            {TRACKING_LABELS[ex.trackingType] || ex.trackingType}
                          </span>
                        )}
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-on-surface">{ex.name}</h3>
                    {ex.equipment && (
                      <p className="text-xs text-on-surface-variant">Dụng cụ: <strong className="text-on-surface">{Array.isArray(ex.equipment) ? ex.equipment.join(", ") : ex.equipment}</strong></p>
                    )}
                    {ex.instructions && (
                      <p className="line-clamp-2 text-pretty text-xs text-on-surface-variant">{ex.instructions}</p>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-outline-variant/60 pt-2.5">
                    {ex.videoUrl || (Array.isArray(ex.videos) && ex.videos.length > 0) ? (
                      <a
                        href={ex.videoUrl || ex.videos[0]?.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <PlayCircle className="size-3.5" aria-hidden="true" />
                        {Array.isArray(ex.videos) && ex.videos.length > 1
                          ? `${ex.videos.length} video hướng dẫn`
                          : "Video hướng dẫn"}
                      </a>
                    ) : <span />}
                    {canWrite && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Sửa ${ex.name}`}
                          title="Sửa"
                          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-outline-variant text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                          onClick={() => setEditor({ entity: "exercises", record: ex })}
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Xóa ${ex.name}`}
                          title="Xóa"
                          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-error/30 text-error hover:bg-error-container/30"
                          onClick={() => { setError(""); setDeleting({ entity: "exercises", record: ex }); }}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {editor?.entity === "exercises" && (
        <RecordEditor
          api={api}
          entity={editor.entity}
          muscleGroups={muscleGroups}
          record={editor.record}
          initialValues={editor.initialValues}
          initialSchedule={editor.initialSchedule}
          onClose={() => setEditor(undefined)}
          onSaved={() => { setEditor(undefined); refresh(); }}
        />
      )}

      {muscleDialogOpen && <MuscleGroupDialog
        api={api}
        groups={muscleQuery.data || []}
        loading={muscleQuery.loading}
        error={muscleQuery.error}
        onClose={() => setMuscleDialogOpen(false)}
        onUpdated={refresh}
      />}

      {aiModal === "exercises" && (
        <AiExerciseModal
          api={api}
          onClose={() => setAiModal(undefined)}
          onBulkSaved={() => {
            setAiModal(undefined);
            refresh();
          }}
        />
      )}

      {aiModal === "workout-templates" && (
        <AiWorkoutTemplateModal
          api={api}
          customers={customersQuery.data?.data || []}
          onClose={() => setAiModal(undefined)}
          onGenerated={(result) => {
            setAiModal(undefined);
            const { schedule, ...values } = result;
            setEditor({
              entity: "workout-templates",
              initialValues: values,
              initialSchedule: schedule,
            });
          }}
        />
      )}

      {assign && (
        <AssignPlan api={api} template={assign} onClose={() => setAssign(undefined)} />
      )}

      {detail && (
        <ErpModal native title={detail.title || "Chi tiết giáo án"} onClose={() => setDetail(undefined)} maxWidth="max-w-3xl">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
              <HrStatusBadge tone="info" className="normal-case">
                <BookOpen className="mr-1 inline size-3" aria-hidden="true" />
                {detail.durationWeeks || 4} tuần · {detail.level || "Cơ bản"}
              </HrStatusBadge>
              {detail.goal && <span>Mục tiêu: <strong className="text-on-surface">{detail.goal}</strong></span>}
            </div>
            {detail.description && <p className="text-pretty text-sm text-on-surface-variant">{detail.description}</p>}
            {Array.isArray(detail.schedule) && detail.schedule.map((day: any, i: number) => (
              <div key={i} className={panel}>
                <strong className="text-sm text-on-surface">Ngày {day.day}: {day.title}</strong>
                <div className="mt-2 space-y-1 text-xs text-on-surface-variant">
                  {(day.exercises || []).map((ex: any, j: number) => (
                    <p key={j} className="tabular-nums">
                      {ex.name} — <strong className="text-on-surface">{ex.sets} × {ex.reps}</strong>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ErpModal>
      )}

      <ConfirmDialog
        native
        appearance="erp"
        isOpen={Boolean(deleting)}
        title={deleting?.entity === "exercises" ? "Xóa bài tập?" : "Xóa giáo án mẫu?"}
        description="Dữ liệu đã xóa không thể khôi phục."
        confirmLabel="Xóa vĩnh viễn"
        isSubmitting={busy}
        error={error}
        onClose={() => { if (!busy) setDeleting(undefined); }}
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          try {
            await api.remove(deleting.entity, deleting.record);
            setDeleting(undefined);
            refresh();
          } catch (e) {
            setError(messageOf(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </section>
  );
}

function AiExerciseModal({
  api,
  onClose,
  onBulkSaved,
}: {
  api: GymApi;
  onClose: () => void;
  onBulkSaved: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Array<Record<string, any>>>([]);
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!prompt.trim() && !muscleGroup.trim()) {
      setError("Vui lòng nhập yêu cầu hoặc nhóm cơ.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.request<{ drafts?: Array<Record<string, any>> }>("/workouts/generate-exercise", "POST", {
        prompt: prompt.trim(),
        muscleGroup: muscleGroup.trim(),
        equipment: equipment.trim(),
      });
      const list = Array.isArray(res.drafts) ? res.drafts : [res];
      setDrafts(list);
      setSelectedIdx(new Set(list.map((d, i) => (d.isDuplicate ? -1 : i)).filter(i => i >= 0)));
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const handleBulkSave = async () => {
    if (saving) return;
    const chosen = drafts.filter((_, i) => selectedIdx.has(i));
    if (!chosen.length) {
      setError("Vui lòng chọn ít nhất 1 bài tập chưa trùng để lưu.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.request("/exercises/bulk", "POST", { exercises: chosen });
      onBulkSaved();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ErpModal
      native
      title={drafts.length ? `Duyệt & lưu ${drafts.length} bài tập AI` : "AI tạo bài tập"}
      onClose={() => { if (!busy && !saving) onClose(); }}
      closeDisabled={busy || saving}
      maxWidth={drafts.length ? "max-w-2xl" : "max-w-lg"}
    >
      {!drafts.length ? (
        <form className="space-y-3" onSubmit={handleGenerate} aria-busy={busy}>
          <Field
            label="Mô tả bài tập cần tạo (hỗ trợ tạo 1–10 bài/lần)"
            multiline
            required
            value={prompt}
            onChange={setPrompt}
            disabled={busy}
            placeholder="VD: Tạo 5 bài tập mông đùi cho nữ mới tập, không cần dụng cụ..."
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nhóm cơ ưu tiên" value={muscleGroup} onChange={setMuscleGroup} disabled={busy} placeholder="VD: Mông, Đùi, Lưng..." />
            <Field label="Dụng cụ" value={equipment} onChange={setEquipment} disabled={busy} placeholder="VD: Tạ đơn, dây kháng lực..." />
          </div>
          <Feedback error={error} />
          <div className="flex justify-end gap-2 border-t border-outline-variant pt-3">
            <button type="button" className={secondary} disabled={busy} onClick={onClose}>
              Hủy
            </button>
            <button type="submit" disabled={busy} className={cn(primaryCreateButtonClass, "min-h-9")}>
              <Sparkles className="size-3.5" aria-hidden="true" />
              {busy ? "Đang tạo bài tập..." : "Tạo bài tập AI"}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3" aria-busy={saving}>
          <div className="max-h-[58dvh] space-y-2 overflow-y-auto pr-1">
            {drafts.map((item, idx) => {
              const checked = selectedIdx.has(idx);
              const dup = Boolean(item.isDuplicate);
              return (
                <label
                  key={`${item.name}-${idx}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-md border p-3 text-xs transition-colors",
                    dup
                      ? "border-outline-variant bg-surface-container-low/50 opacity-70"
                      : checked
                        ? "border-primary/50 bg-primary/5"
                        : "border-outline-variant bg-surface-container-lowest",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-primary"
                    checked={checked}
                    disabled={dup || saving}
                    onChange={() => {
                      setSelectedIdx(prev => {
                        const next = new Set(prev);
                        if (next.has(idx)) next.delete(idx);
                        else next.add(idx);
                        return next;
                      });
                    }}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <strong className="text-sm text-on-surface">{item.name}</strong>
                      <span className="rounded bg-surface-container px-1.5 py-0.5 text-[11px] text-on-surface-variant">
                        {item.muscleGroup}
                      </span>
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                        {item.defaultTrackingType || item.trackingType}
                      </span>
                      {dup && (
                        <span className="rounded bg-error-container/40 px-1.5 py-0.5 text-[11px] font-medium text-error">
                          Đã có trong thư viện
                        </span>
                      )}
                    </div>
                    {item.description && <p className="text-on-surface-variant">{item.description}</p>}
                    {item.technique && <p className="text-on-surface">{item.technique}</p>}
                  </div>
                </label>
              );
            })}
          </div>
          <Feedback error={error} />
          <div className="flex justify-between gap-2 border-t border-outline-variant pt-3">
            <button type="button" className={secondary} disabled={saving} onClick={() => { setDrafts([]); setError(""); }}>
              Tạo lại
            </button>
            <div className="flex gap-2">
              <button type="button" className={secondary} disabled={saving} onClick={onClose}>
                Hủy
              </button>
              <button type="button" disabled={saving || selectedIdx.size === 0} onClick={handleBulkSave} className={cn(primaryCreateButtonClass, "min-h-9")}>
                <Plus className="size-3.5" aria-hidden="true" />
                {saving ? "Đang lưu..." : `Lưu ${selectedIdx.size} bài tập`}
              </button>
            </div>
          </div>
        </div>
      )}
    </ErpModal>
  );
}

const WEEKDAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"] as const;

function AiWorkoutTemplateModal({
  api,
  customers,
  onClose,
  onGenerated,
}: {
  api: GymApi;
  customers: GymRecord[];
  onClose: () => void;
  onGenerated: (result: Record<string, any>) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [customerId, setCustomerId] = useState("");
  const selectedCustomer = customers.find(c => c._id === customerId);
  const [availability, setAvailability] = useState<Record<string, Array<{ start: string; end: string }>>>({});
  const [proposal, setProposal] = useState<{
    durationWeeks: number;
    sessionsPerWeek: number;
    minutesPerSession: number;
    level: string;
    trainingMethod: string;
    trainingSplit: string;
    priorityMuscleGroups: string[];
    restrictions: string[];
  } | null>(null);
  const [additionalRequest, setAdditionalRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const addSlot = (day: string) => {
    setAvailability(prev => ({
      ...prev,
      [day]: [...(prev[day] || []), { start: "18:00", end: "19:30" }],
    }));
  };

  const updateSlot = (day: string, idx: number, field: "start" | "end", value: string) => {
    setAvailability(prev => ({
      ...prev,
      [day]: (prev[day] || []).map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }));
  };

  const removeSlot = (day: string, idx: number) => {
    setAvailability(prev => {
      const next = (prev[day] || []).filter((_, i) => i !== idx);
      const copy = { ...prev };
      if (next.length) copy[day] = next;
      else delete copy[day];
      return copy;
    });
  };

  const availabilityPayload = WEEKDAYS.filter(d => (availability[d] || []).length > 0).map(d => ({
    dayOfWeek: d,
    slots: availability[d],
  }));

  const handleAnalyzeProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!customerId) {
      setError("Vui lòng chọn học viên trước khi phân tích giáo án.");
      return;
    }
    if (!availabilityPayload.length) {
      setError("Vui lòng thêm ít nhất 1 khung giờ rảnh trong tuần của học viên.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.request<NonNullable<typeof proposal>>("/workouts/proposal", "POST", {
        customerId,
        availability: availabilityPayload,
      });
      setProposal(res);
      setStep(2);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !proposal) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.request<Record<string, any>>("/workouts/generate-template", "POST", {
        customerId,
        proposal,
        availability: availabilityPayload,
        additionalRequest: additionalRequest.trim(),
      });
      onGenerated(res);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ErpModal
      native
      title={step === 1 ? "Tạo giáo án bằng AI — Bước 1/2: Chọn học viên & lịch rảnh" : "Tạo giáo án bằng AI — Bước 2/2: Duyệt đề xuất & cấu hình"}
      onClose={() => { if (!busy) onClose(); }}
      closeDisabled={busy}
      maxWidth="max-w-2xl"
    >
      {step === 1 ? (
        <form className="space-y-3" onSubmit={handleAnalyzeProposal} aria-busy={busy}>
          <div className="max-h-[calc(82dvh-9rem)] space-y-3 overflow-y-auto pr-1">
            <div className="space-y-1">
              <span className="block text-sm text-on-surface">
                Học viên <span className="text-error">*</span>
              </span>
              <Dropdown
                aria-label="Chọn học viên"
                variant="filter"
                searchable
                searchPlaceholder="Nhập tên học viên hoặc SĐT..."
                disabled={busy}
                className="w-full"
                triggerClassName="w-full justify-between"
                value={customerId}
                onChange={(nextId) => { setCustomerId(nextId); setError(""); }}
                options={[
                  { value: "", label: "Chọn học viên..." },
                  ...customers.map(c => ({
                    value: c._id,
                    label: `${c.fullName}${c.phone ? ` · ${c.phone}` : ""}`,
                  })),
                ]}
              />
            </div>

            {selectedCustomer && (
              <div className="rounded-md border border-outline-variant bg-surface-container-low/50 p-2.5 text-xs text-on-surface-variant">
                <strong className="text-on-surface">{selectedCustomer.fullName}</strong>
                {" · "}
                {selectedCustomer.gender === "MALE" ? "Nam" : selectedCustomer.gender === "FEMALE" ? "Nữ" : "Chưa có giới tính"}
                {" · "}
                {selectedCustomer.height ? `${selectedCustomer.height} cm` : "Chưa có chiều cao"}
                {" · "}
                {selectedCustomer.initialWeight ? `${selectedCustomer.initialWeight} kg` : "Chưa có cân nặng"}
                {selectedCustomer.initialGoal && (
                  <p className="mt-1">Mục tiêu: <strong className="text-on-surface">{selectedCustomer.initialGoal}</strong></p>
                )}
                {selectedCustomer.medicalNotes && (
                  <p className="mt-1 text-error">Lưu ý sức khỏe: {selectedCustomer.medicalNotes}</p>
                )}
              </div>
            )}

            <div className="space-y-2 rounded-md border border-outline-variant bg-surface-container-low/30 p-3">
              <div>
                <p className="text-sm font-semibold text-on-surface">
                  Thời gian rảnh của học viên <span className="text-error">*</span>
                </p>
                <p className="text-xs text-on-surface-variant">Lịch này lặp lại mỗi tuần và chỉ dùng cho lần tạo giáo án hiện tại.</p>
              </div>
              <div className="space-y-2">
                {WEEKDAYS.map(day => {
                  const slots = availability[day] || [];
                  return (
                    <div key={day} className="rounded-md border border-outline-variant bg-surface-container-lowest p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-on-surface">{day}</span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => addSlot(day)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1 text-xs font-medium text-on-surface hover:border-primary/40 hover:text-primary"
                        >
                          <Plus className="size-3" aria-hidden="true" />
                          Thêm khung giờ {day}
                        </button>
                      </div>
                      {!slots.length ? (
                        <p className="mt-1 text-xs text-on-surface-variant">Chưa có khung giờ</p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {slots.map((slot, idx) => (
                            <div key={idx} className="inline-flex items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-low/50 px-2 py-1 text-xs">
                              <input
                                type="time"
                                aria-label={`Giờ bắt đầu ${day}`}
                                value={slot.start}
                                disabled={busy}
                                onChange={e => updateSlot(day, idx, "start", e.target.value)}
                                className="rounded border border-outline-variant bg-surface-container-lowest px-1.5 py-0.5 text-xs text-on-surface"
                              />
                              <span className="text-on-surface-variant">–</span>
                              <input
                                type="time"
                                aria-label={`Giờ kết thúc ${day}`}
                                value={slot.end}
                                disabled={busy}
                                onChange={e => updateSlot(day, idx, "end", e.target.value)}
                                className="rounded border border-outline-variant bg-surface-container-lowest px-1.5 py-0.5 text-xs text-on-surface"
                              />
                              <button
                                type="button"
                                aria-label={`Xóa khung giờ ${day}`}
                                disabled={busy}
                                onClick={() => removeSlot(day, idx)}
                                className="cursor-pointer text-error hover:opacity-80"
                              >
                                <Trash2 className="size-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <Feedback error={error} />
          <div className="flex justify-end gap-2 border-t border-outline-variant pt-3">
            <button type="button" className={secondary} disabled={busy} onClick={onClose}>
              Hủy
            </button>
            <button type="submit" disabled={busy || !customerId || !availabilityPayload.length} className={cn(primaryCreateButtonClass, "min-h-9")}>
              <Sparkles className="size-3.5" aria-hidden="true" />
              {busy ? "Đang phân tích bằng AI..." : "Phân tích bằng AI"}
            </button>
          </div>
        </form>
      ) : proposal ? (
        <form className="space-y-3" onSubmit={handleGenerateDraft} aria-busy={busy}>
          <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
            <p className="font-semibold text-on-surface">
              Đề xuất AI cho {selectedCustomer?.fullName}
            </p>
            <p className="text-on-surface-variant">
              Phương pháp: <strong className="text-on-surface">{proposal.trainingMethod}</strong> · Phân chia: <strong className="text-on-surface">{proposal.trainingSplit}</strong>
            </p>
            {proposal.priorityMuscleGroups.length > 0 && (
              <p className="text-on-surface-variant">
                Nhóm cơ ưu tiên: <strong className="text-on-surface">{proposal.priorityMuscleGroups.join(", ")}</strong>
              </p>
            )}
            {proposal.restrictions.length > 0 && (
              <p className="text-error">
                Hạn chế / cần tránh: {proposal.restrictions.join(", ")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field
              label="Số tuần (1–12)"
              type="number"
              min={1}
              max={12}
              value={proposal.durationWeeks}
              onChange={v => setProposal(p => p ? { ...p, durationWeeks: Math.min(12, Math.max(1, Number(v) || 4)) } : p)}
              disabled={busy}
            />
            <Field
              label="Buổi / tuần"
              type="number"
              min={1}
              max={7}
              value={proposal.sessionsPerWeek}
              onChange={v => setProposal(p => p ? { ...p, sessionsPerWeek: Math.min(7, Math.max(1, Number(v) || 3)) } : p)}
              disabled={busy}
            />
            <Field
              label="Phút / buổi"
              type="number"
              min={15}
              max={240}
              value={proposal.minutesPerSession}
              onChange={v => setProposal(p => p ? { ...p, minutesPerSession: Math.min(240, Math.max(15, Number(v) || 60)) } : p)}
              disabled={busy}
            />
          </div>

          <Field
            label="Yêu cầu bổ sung của PT (tùy chọn)"
            multiline
            value={additionalRequest}
            onChange={setAdditionalRequest}
            disabled={busy}
            placeholder="VD: Ưu tiên bài tập máy cho 2 tuần đầu, tăng thời gian giãn cơ..."
          />

          <Feedback error={error} />
          <div className="flex justify-between gap-2 border-t border-outline-variant pt-3">
            <button type="button" className={secondary} disabled={busy} onClick={() => { setStep(1); setError(""); }}>
              Quay lại
            </button>
            <div className="flex gap-2">
              <button type="button" className={secondary} disabled={busy} onClick={onClose}>
                Hủy
              </button>
              <button type="submit" disabled={busy} className={cn(primaryCreateButtonClass, "min-h-9")}>
                <Sparkles className="size-3.5" aria-hidden="true" />
                {busy ? "Đang tạo giáo án..." : "Tạo giáo án AI"}
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </ErpModal>
  );
}

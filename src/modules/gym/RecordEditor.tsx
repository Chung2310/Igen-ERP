import { useRef, useState } from "react";
import { Plus, Trash2, Video } from "lucide-react";
import {
  customerEntities,
  type GymEntity,
  type GymList,
  type GymRecord,
} from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import { forms, initialForm, labels } from "./forms";
import {
  CustomerPicker,
  Field,
  FormDialog,
  messageOf,
  panel,
  secondary,
  useGymQuery,
} from "./ui";

const DEFAULT_MUSCLE_GROUPS = [
  "Ngực",
  "Lưng",
  "Vai",
  "Tay trước",
  "Tay sau",
  "Chân",
  "Mông",
  "Bụng / Core",
  "Toàn thân",
  "Tim mạch / Cardio",
];

function todayVnIso() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}
import WorkoutEditor from "./WorkoutEditor";
import RoadmapEditor from "./RoadmapEditor";
import NutritionEditor, { NutritionCalculator } from "./NutritionEditor";
import SessionCapture, { type SessionCaptureHandle } from "./SessionCapture";

function localDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export default function RecordEditor({
  api,
  entity,
  record,
  customerId: fixedCustomer,
  initialValues,
  initialMacros,
  initialMenu,
  initialSchedule,
  initialPhases,
  muscleGroups = [],
  onClose,
  onSaved,
}: {
  api: GymApi;
  entity: GymEntity;
  record?: GymRecord;
  customerId?: string;
  initialValues?: Record<string, any>;
  initialMacros?: { protein: number; carbs: number; fat: number };
  initialMenu?: any[];
  initialSchedule?: any[];
  initialPhases?: any[];
  muscleGroups?: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, any>>(() => ({
    ...initialForm(entity, record),
    ...(!record && initialValues ? initialValues : {}),
    ...(entity === "measurements" && !record && !initialValues?.measurementDate
      ? { measurementDate: todayVnIso() }
      : {}),
    ...(entity === "nutrition-logs" && !record && !initialValues?.date
      ? { date: todayVnIso() }
      : {}),
    ...(entity === "exercises"
      ? {
          level: record?.level || initialValues?.level || "BEGINNER",
          equipment: Array.isArray(record?.equipment)
            ? record.equipment.join(", ")
            : record?.equipment || initialValues?.equipment || "",
          instructions: record?.instructions || record?.technique || initialValues?.instructions || "",
        }
      : {}),
    ...(entity === "sessions" && record?.performedAt
      ? { performedAt: localDateTime(record.performedAt) }
      : {}),
    ...(entity === "sessions" && !record && !initialValues?.performedAt
      ? { performedAt: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
      : {}),
  }));
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>(() => {
    if (entity !== "exercises") return [];
    if (Array.isArray(record?.muscleGroups) && record.muscleGroups.length > 0) return record.muscleGroups;
    if (record?.muscleGroup) {
      return String(record.muscleGroup).split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (initialValues?.muscleGroup) return [String(initialValues.muscleGroup)];
    return [];
  });
  const [availableMuscleGroups, setAvailableMuscleGroups] = useState<string[]>(() =>
    Array.from(
      new Set([
        ...(muscleGroups.length > 0 ? muscleGroups : DEFAULT_MUSCLE_GROUPS),
        ...(Array.isArray(record?.muscleGroups) ? record.muscleGroups : []),
        ...(record?.muscleGroup ? String(record.muscleGroup).split(",").map((s) => s.trim()).filter(Boolean) : []),
      ]),
    ),
  );
  const [addingMuscle, setAddingMuscle] = useState(false);
  const [newMuscleName, setNewMuscleName] = useState("");
  const [creatingMuscle, setCreatingMuscle] = useState(false);
  const [muscleError, setMuscleError] = useState("");
  const [exerciseVideos, setExerciseVideos] = useState<Array<{ url: string; title: string }>>(() => {
    if (entity !== "exercises") return [];
    if (Array.isArray(record?.videos) && record.videos.length > 0) {
      return record.videos.map((v: any) => ({ url: String(v.url || ""), title: String(v.title || "") }));
    }
    if (Array.isArray(record?.videoUrls) && record.videoUrls.length > 0) {
      return record.videoUrls.map((url: string) => ({ url, title: "" }));
    }
    if (record?.videoUrl) return [{ url: String(record.videoUrl), title: "" }];
    return [];
  });
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newVideoTitle, setNewVideoTitle] = useState("");
  const foodCatalogQuery = useGymQuery<GymList>(
    api,
    entity === "nutrition-logs" ? "/food-images?limit=200" : "",
    0,
  );
  const [foodPickSearch, setFoodPickSearch] = useState("");
  const [customerId, setCustomerId] = useState(
    fixedCustomer || record?.customerId || "",
  );
  const [schedule, setSchedule] = useState<any[]>(
    record?.schedule || initialSchedule || [],
  );
  const [menu, setMenu] = useState<any[]>(record?.menu || initialMenu || []);
  const [macros, setMacros] = useState(
    record?.macros || initialMacros || { protein: 0, carbs: 0, fat: 0 },
  );
  const [phases, setPhases] = useState<any[]>(() => ((record?.phases || initialPhases || []).length ? (record?.phases || initialPhases || []) : [{ order: 1, name: "", durationWeeks: 1, goals: [], weeks: [{ week: 1, focus: "", sessionTargets: 3, sessions: [] }] }]).map((phase: any, index: number) => phase.name || phase.order ? phase : ({
    order: index + 1, name: phase.title || `Giai đoạn ${index + 1}`,
    durationWeeks: phase.weeks?.length || Math.max(1, Math.round((Date.parse(phase.endDate || "") - Date.parse(phase.startDate || "")) / 604800000) || 1),
    goals: typeof phase.goals === "string" ? phase.goals.split(/[;\n]/).map((item: string) => item.trim()).filter(Boolean) : phase.goals || [],
    weeks: phase.weeks || [],
  })));
  const [strategy, setStrategy] = useState<Record<string, any>>(record?.strategy || initialValues?.strategy || {});
  const [baseline] = useState<Record<string, any>>(record?.baseline || initialValues?.baseline || {});
  const [segmentalMuscle, setSegmentalMuscle] = useState<Record<string, number | "">>(record?.segmentalMuscle || {});
  const [segmentalFat, setSegmentalFat] = useState<Record<string, number | "">>(record?.segmentalFat || {});
  const [showSegmental, setShowSegmental] = useState(Boolean(record?.segmentalMuscle || record?.segmentalFat));
  const [exerciseLogs, setLogs] = useState<any[]>(record?.exerciseLogs || []);
  const [planId, setPlanId] = useState(record?.planId || "");
  const [dirty, setDirty] = useState(false);
  const sessionCapture = useRef<SessionCaptureHandle>(null);
  const [idempotencyKey] = useState(() => globalThis.crypto?.randomUUID?.() || `gym-session-${Date.now()}`);
  const changed = (fn: () => void) => {
    setDirty(true);
    fn();
  };
  const title =
    entity === "knowledge"
      ? record
        ? "Sửa tài liệu"
        : "Thêm tài liệu"
      : entity === "measurements"
        ? record
          ? "Sửa chỉ số InBody"
          : "Nhập chỉ số InBody"
        : entity === "roadmaps"
          ? record
            ? "Sửa lộ trình"
            : "Tạo lộ trình"
          : entity === "nutrition-plans"
            ? record
              ? "Sửa thực đơn"
              : "Tạo thực đơn"
            : entity === "nutrition-logs"
              ? record
                ? "Sửa nhật ký"
                : "Ghi nhật ký"
              : entity === "workout-templates"
                ? record
                  ? "Sửa giáo án"
                  : "Tạo giáo án"
                : entity === "sessions"
                  ? record
                    ? "Sửa buổi tập"
                    : "Ghi buổi tập"
                  : `${record ? "Sửa" : "Thêm"} ${labels[entity].toLocaleLowerCase("vi")}`;
  const submitLabel = record
    ? "Lưu thay đổi"
    : entity === "measurements"
      ? "Lưu InBody"
      : entity === "roadmaps"
        ? "Lưu lộ trình"
        : entity === "nutrition-plans"
          ? "Lưu thực đơn"
          : entity === "nutrition-logs"
            ? "Lưu nhật ký"
            : entity === "workout-templates"
              ? "Lưu giáo án"
              : entity === "sessions"
                ? "Lưu buổi tập"
                : "Lưu";
  const modalWidth = ["workout-templates", "workout-plans", "nutrition-plans", "roadmaps", "sessions"].includes(entity)
    ? "max-w-4xl"
    : "max-w-3xl";

  const measurementGroups = [
    { title: "Chỉ số cơ bản", cols: "sm:grid-cols-4", keys: ["measurementDate", "weight", "height", "bmi"] },
    { title: "Thành phần cơ thể (InBody)", cols: "sm:grid-cols-3", keys: ["bodyFatPercentage", "bodyFatMass", "muscleMass", "visceralFatLevel", "bmr", "inbodyScore", "bodyWater", "boneMineral", "waistHipRatio"] },
    { title: "Số đo & Ghi chú", cols: "sm:grid-cols-3", keys: ["waist", "hip", "chest", "consultationNotes", "notes"] },
  ];

  return (
    <FormDialog
      title={title}
      dirty={dirty}
      maxWidth={modalWidth}
      submitLabel={submitLabel}
      onClose={onClose}
      onSubmit={async () => {
        const payload = Object.fromEntries(
          Object.entries(form).filter(
            ([key, value]) =>
              value !== "" ||
              !forms[entity]?.find((f) => f.key === key && f.type === "number"),
          ),
        );
        if (customerEntities.has(entity)) {
          if (!customerId)
            throw new Error("Vui lòng chọn học viên / khách hàng.");
          payload.customerId = customerId;
        }
        if (entity === "workout-plans" || entity === "workout-templates")
          payload.schedule = schedule;
        if (entity === "nutrition-plans") {
          payload.menu = menu;
          payload.macros = macros;
        }
        if (entity === "roadmaps") {
          if (!phases.length) throw new Error("Thêm ít nhất một giai đoạn cho lộ trình.");
          if (new Set(phases.map(phase => phase.order)).size !== phases.length) throw new Error("Thứ tự giai đoạn không được trùng.");
          payload.phases = phases;
          payload.strategy = strategy;
          payload.baseline = baseline;
          payload.status = "DRAFT";
          if (record?.startDate) payload.startDate = record.startDate;
          if (record?.endDate) payload.endDate = record.endDate;
        }
        if (entity === "exercises") {
          if (selectedMuscleGroups.length === 0) {
            throw new Error("Vui lòng chọn ít nhất một nhóm cơ.");
          }
          payload.muscleGroups = selectedMuscleGroups;
          payload.muscleGroup = selectedMuscleGroups.join(", ");
          payload.level = form.level || "BEGINNER";
          const validVideos = exerciseVideos
            .map((v) => ({ url: v.url.trim(), title: v.title.trim(), type: /youtu\.?be/i.test(v.url) ? "YOUTUBE" : "LINK" }))
            .filter((v) => Boolean(v.url));
          payload.videos = validVideos;
          payload.videoUrls = validVideos.map((v) => v.url);
          payload.videoUrl = validVideos[0]?.url || "";
        }
        if (entity === "measurements") {
          const numeric = (value: Record<string, number | "">) => Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== ""));
          payload.segmentalMuscle = showSegmental ? numeric(segmentalMuscle) : null;
          payload.segmentalFat = showSegmental ? numeric(segmentalFat) : null;
          payload.source = form.source || record?.source || "MANUAL";
          const weight = Number(payload.weight);
          const height = Number(payload.height);
          if (weight > 0 && height > 0) payload.bmi = Number((weight / ((height / 100) ** 2)).toFixed(1));
          if (weight > 0 && Number(payload.bodyFatPercentage) > 0 && !payload.bodyFatMass)
            payload.bodyFatMass = Number((weight * Number(payload.bodyFatPercentage) / 100).toFixed(1));
          if (weight > 0 && !payload.bmr) payload.bmr = Math.round(weight * 22);
        }
        if (entity === "sessions") {
          const capture = sessionCapture.current?.getValues();
          if (!capture) throw new Error("Không đọc được nội dung buổi tập.");
          payload.planId = planId;
          payload.sessionIndex = capture.sessionIndex;
          if (!record) {
            payload.idempotencyKey = idempotencyKey;
            if (capture.planRevision) payload.planRevision = capture.planRevision;
          }
          payload.exerciseLogs = payload.attendance === "ABSENT" ? [] : exerciseLogs;
          if (payload.attendance !== "ABSENT") {
            if (exerciseLogs.some((log) => log.result && Object.keys(log.result).length === 0))
              throw new Error("Vui lòng nhập kết quả cho đầy đủ bài tập trong buổi đã chọn.");
            if (capture.bodyMeasurement) payload.bodyMeasurement = capture.bodyMeasurement;
            if (capture.customerSignature) payload.customerSignature = capture.customerSignature;
            const progressPhotos = [...capture.existingPhotos];
            for (const photo of capture.photoFiles) {
              const upload = new FormData();
              upload.append("customerId", customerId);
              upload.append("file", photo.file);
              const result = await api.request<{ photoUrl: string }>("/sessions/photos/upload", "POST", upload);
              progressPhotos.push({ photoUrl: result.photoUrl, angle: photo.angle });
            }
            if (progressPhotos.length) payload.progressPhotos = progressPhotos;
          }
          if (
            typeof payload.performedAt === "string" &&
            !/[Z+]/.test(payload.performedAt)
          )
            payload.performedAt += ":00+07:00";
        }
        await api.save(entity, payload, record);
        if (entity === "sessions") sessionCapture.current?.clearDraft?.();
        onSaved();
      }}
    >
      {customerEntities.has(entity) && !fixedCustomer && (!record || entity === "goals") && (
        <CustomerPicker
          api={api}
          value={customerId}
          disabled={Boolean(record || fixedCustomer)}
          onChange={(value) =>
            changed(() => {
              setCustomerId(value);
              setPlanId("");
            })
          }
        />
      )}
      {entity === "nutrition-plans" && (
        <NutritionCalculator
          onApply={(value) => changed(() => setForm({ ...form, ...value }))}
        />
      )}
      {entity === "nutrition-logs" && (foodCatalogQuery.data?.data?.length || 0) > 0 && (
        <section className="space-y-2 rounded-md border border-primary/25 bg-primary/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-primary">Chọn nhanh từ Kho Món</h3>
            <input
              type="text"
              aria-label="Tìm nhanh món từ kho"
              value={foodPickSearch}
              onChange={(e) => setFoodPickSearch(e.target.value)}
              placeholder="Lọc tên món..."
              className="h-7 rounded border border-outline-variant bg-surface-container-lowest px-2 text-xs text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {(foodCatalogQuery.data?.data || [])
              .filter(
                (item) =>
                  !foodPickSearch.trim() ||
                  String(item.name || "")
                    .toLocaleLowerCase("vi")
                    .includes(foodPickSearch.trim().toLocaleLowerCase("vi")),
              )
              .slice(0, 18)
              .map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() =>
                    changed(() => {
                      const prevFoods = String(form.foods || "").trim();
                      const addition = `${item.name}${item.servingLabel ? ` (${item.servingLabel})` : ""}`;
                      setForm({
                        ...form,
                        mealType: form.mealType || "Bữa chính",
                        foods: prevFoods ? `${prevFoods}, ${addition}` : addition,
                        calories: (Number(form.calories) || 0) + Number(item.calories || 0),
                        protein: Math.round(((Number(form.protein) || 0) + Number(item.protein || 0)) * 10) / 10,
                        carbs: Math.round(((Number(form.carbs) || 0) + Number(item.carbs || 0)) * 10) / 10,
                        fat: Math.round(((Number(form.fat) || 0) + Number(item.fat || 0)) * 10) / 10,
                      });
                    })
                  }
                  className="cursor-pointer rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1 text-[11px] font-medium text-on-surface transition-colors hover:border-primary hover:text-primary"
                >
                  + {item.name} ({item.calories || 0} kcal)
                </button>
              ))}
          </div>
        </section>
      )}
      {entity === "exercises" ? (
        <div className="space-y-4">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase text-on-surface-variant">Thông tin cơ bản</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  label="Tên bài tập"
                  required
                  placeholder="Ví dụ: Barbell Squat"
                  value={form.name}
                  onChange={(value) => changed(() => setForm({ ...form, name: value }))}
                />
              </div>

              {/* Multi-select muscle groups + inline Add New Muscle Group */}
              <div className="space-y-2 sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-on-surface">
                    Nhóm cơ <span className="text-error">*</span>{" "}
                    {selectedMuscleGroups.length > 0 && (
                      <strong className="text-xs text-primary">({selectedMuscleGroups.length})</strong>
                    )}
                  </span>
                  {!addingMuscle && (
                    <button
                      type="button"
                      onClick={() => { setAddingMuscle(true); setNewMuscleName(""); setMuscleError(""); }}
                      className="cursor-pointer text-xs font-semibold text-primary hover:underline"
                    >
                      + Thêm nhóm cơ mới
                    </button>
                  )}
                </div>
                {addingMuscle && (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-2">
                    <input
                      type="text"
                      aria-label="Tên nhóm cơ mới"
                      placeholder="Nhập tên nhóm cơ..."
                      value={newMuscleName}
                      onChange={(e) => setNewMuscleName(e.target.value)}
                      className="h-8 flex-1 rounded border border-outline-variant bg-surface-container-lowest px-2.5 text-xs text-on-surface focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={creatingMuscle || !newMuscleName.trim()}
                      onClick={async () => {
                        const trimmed = newMuscleName.trim();
                        if (!trimmed) return;
                        setCreatingMuscle(true);
                        setMuscleError("");
                        try {
                          const res = await api.request<{ name?: string }>("/muscle-groups", "POST", { name: trimmed });
                          const name = res?.name || trimmed;
                          setAvailableMuscleGroups((prev) => (prev.includes(name) ? prev : [...prev, name]));
                          changed(() =>
                            setSelectedMuscleGroups((prev) => (prev.includes(name) ? prev : [...prev, name])),
                          );
                          setAddingMuscle(false);
                          setNewMuscleName("");
                        } catch (err) {
                          setMuscleError(messageOf(err));
                        } finally {
                          setCreatingMuscle(false);
                        }
                      }}
                      className={secondary}
                    >
                      {creatingMuscle ? "..." : "Lưu"}
                    </button>
                    <button
                      type="button"
                      className={secondary}
                      onClick={() => { setAddingMuscle(false); setNewMuscleName(""); setMuscleError(""); }}
                    >
                      Hủy
                    </button>
                    {muscleError && <p className="w-full text-xs text-error">{muscleError}</p>}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Danh sách nhóm cơ">
                  {availableMuscleGroups.map((group) => {
                    const checked = selectedMuscleGroups.includes(group);
                    return (
                      <button
                        key={group}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() =>
                          changed(() =>
                            setSelectedMuscleGroups((prev) =>
                              prev.includes(group) ? prev.filter((item) => item !== group) : [...prev, group],
                            ),
                          )
                        }
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                          checked
                            ? "border-primary bg-primary text-on-primary"
                            : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-primary/40 hover:text-on-surface",
                        )}
                      >
                        <span aria-hidden="true">{checked ? "✓" : "+"}</span>
                        <span>{group}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedMuscleGroups.length > 0 && (
                  <p className="text-xs text-on-surface-variant">
                    Đã chọn: <strong className="text-on-surface">{selectedMuscleGroups.join(", ")}</strong>
                  </p>
                )}
              </div>

              <Field
                label="Cấp độ"
                value={form.level || "BEGINNER"}
                options={[
                  ["BEGINNER", "Cơ bản"],
                  ["INTERMEDIATE", "Trung cấp"],
                  ["ADVANCED", "Nâng cao"],
                ]}
                onChange={(value) => changed(() => setForm({ ...form, level: value }))}
              />
              <Field
                label="Cách ghi nhận"
                required
                value={form.trackingType || "STRENGTH"}
                options={[
                  ["STRENGTH", "Sức mạnh · mức tạ"],
                  ["BODYWEIGHT", "Trọng lượng cơ thể"],
                  ["CARDIO", "Cardio · quãng đường/thời gian"],
                  ["INTERVAL", "Interval · hiệp làm/nghỉ"],
                  ["MOBILITY", "Mobility · thời lượng/biên độ"],
                ]}
                onChange={(value) => changed(() => setForm({ ...form, trackingType: value }))}
              />
            </div>
          </section>

          <section className="space-y-3 border-t border-outline-variant/60 pt-3">
            <h3 className="text-xs font-semibold uppercase text-on-surface-variant">Thiết bị &amp; Kỹ thuật</h3>
            <Field
              label="Dụng cụ / Thiết bị"
              placeholder="Phân cách bằng dấu phẩy (VD: Thanh đòn, ghế tập)"
              value={form.equipment}
              onChange={(value) => changed(() => setForm({ ...form, equipment: value }))}
            />
            <Field
              label="Hướng dẫn kỹ thuật"
              multiline
              placeholder="Mô tả cách thực hiện đúng..."
              value={form.instructions}
              onChange={(value) => changed(() => setForm({ ...form, instructions: value }))}
            />
          </section>

          <section className="space-y-2.5 border-t border-outline-variant/60 pt-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-on-surface-variant">
                <Video className="size-3.5 text-primary" aria-hidden="true" />
                Video hướng dẫn ({exerciseVideos.length})
              </h3>
            </div>
            {exerciseVideos.length > 0 && (
              <div className="space-y-1.5">
                {exerciseVideos.map((v, idx) => (
                  <div
                    key={`${v.url}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-outline-variant bg-surface-container-low/50 px-3 py-1.5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      {v.title && <p className="truncate font-semibold text-on-surface">{v.title}</p>}
                      <p className="truncate text-on-surface-variant">{v.url}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Xóa video ${idx + 1}`}
                      onClick={() =>
                        changed(() => setExerciseVideos((prev) => prev.filter((_, i) => i !== idx)))
                      }
                      className="cursor-pointer rounded p-1 text-error hover:bg-error-container/30"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)_auto]">
              <input
                type="url"
                aria-label="Đường dẫn video hướng dẫn"
                placeholder="https://youtube.com/watch?v=..."
                value={newVideoUrl}
                onChange={(e) => setNewVideoUrl(e.target.value)}
                className="h-9 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-xs text-on-surface focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                aria-label="Tiêu đề video"
                placeholder="Tiêu đề (tùy chọn)"
                value={newVideoTitle}
                onChange={(e) => setNewVideoTitle(e.target.value)}
                className="h-9 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-xs text-on-surface focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                disabled={!newVideoUrl.trim()}
                onClick={() => {
                  const url = newVideoUrl.trim();
                  if (!url) return;
                  changed(() => {
                    setExerciseVideos((prev) => [...prev, { url, title: newVideoTitle.trim() }]);
                  });
                  setNewVideoUrl("");
                  setNewVideoTitle("");
                }}
                className={secondary}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Thêm video
              </button>
            </div>
          </section>
        </div>
      ) : entity === "sessions" ? (
        <SessionCapture
          ref={sessionCapture}
          api={api}
          customerId={customerId}
          form={form}
          onForm={setForm}
          planId={planId}
          onPlan={setPlanId}
          exerciseLogs={exerciseLogs}
          onLogs={setLogs}
          onDirty={() => setDirty(true)}
          record={record}
        />
      ) : entity === "measurements" ? (
        <div className="space-y-4">
          {measurementGroups.map((group) => {
            const fields = (forms.measurements || []).filter((f) => group.keys.includes(f.key));
            return (
              <section key={group.title} className="space-y-2.5 border-t border-outline-variant/60 pt-3 first:border-t-0 first:pt-0">
                <h3 className="text-xs font-semibold uppercase text-on-surface-variant">{group.title}</h3>
                <div className={`grid gap-3 ${group.cols}`}>
                  {fields.map(({ key, ...field }) => (
                    <div key={key} className={field.multiline ? "sm:col-span-3" : ""}>
                      <Field
                        {...field}
                        min={field.type === "number" ? 0 : undefined}
                        value={form[key]}
                        onChange={(value) =>
                          changed(() => setForm({ ...form, [key]: value }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
          <section className="border-t border-outline-variant/60 pt-3">
            <button type="button" className={secondary} aria-expanded={showSegmental} onClick={() => changed(() => setShowSegmental(value => !value))}>{showSegmental ? "Ẩn" : "Thêm"} chỉ số từng vùng cơ thể</button>
            {showSegmental && <div className="mt-3 grid gap-4 sm:grid-cols-2">{([["segmentalMuscle", "Khối lượng cơ (kg)", segmentalMuscle, setSegmentalMuscle], ["segmentalFat", "Khối lượng mỡ (kg)", segmentalFat, setSegmentalFat]] as const).map(([key, label, values, setValues]) => <div key={key} className="space-y-2 rounded-md border border-outline-variant p-3"><h3 className="text-sm font-semibold text-on-surface">{label}</h3>{([["rightArm", "Tay phải"], ["leftArm", "Tay trái"], ["trunk", "Thân người"], ["rightLeg", "Chân phải"], ["leftLeg", "Chân trái"]] as const).map(([part, partLabel]) => <Field key={part} label={partLabel} type="number" min={0} value={values[part] ?? ""} onChange={value => changed(() => setValues(current => ({ ...current, [part]: value })))} />)}</div>)}</div>}
          </section>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(forms[entity] || []).map(({ key, ...field }) => (
            <div key={key} className={field.multiline ? "sm:col-span-2" : ""}>
              <Field
                {...field}
                options={field.options}
                min={field.type === "number" ? 0 : undefined}
                value={form[key]}
                onChange={(value) =>
                  changed(() => setForm({ ...form, [key]: value }))
                }
              />
            </div>
          ))}
        </div>
      )}
      {(entity === "workout-templates" || entity === "workout-plans") && (
        <WorkoutEditor
          api={api}
          schedule={schedule}
          onChange={(value) => changed(() => setSchedule(value))}
        />
      )}
      {entity === "nutrition-plans" && (
        <NutritionEditor
          api={api}
          menu={menu}
          macros={macros}
          onMenu={(value) => changed(() => setMenu(value))}
          onMacros={(value) => changed(() => setMacros(value))}
        />
      )}
      {entity === "roadmaps" && <RoadmapEditor strategy={strategy} phases={phases} onStrategy={value => changed(() => setStrategy(value))} onPhases={value => changed(() => setPhases(value))} />}
    </FormDialog>
  );
}

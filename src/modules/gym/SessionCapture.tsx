import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Camera,
  Check,
  Dumbbell,
  History,
  Maximize2,
  MessageSquare,
  PenLine,
  RotateCcw,
  Scale,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import type { GymList, GymRecord } from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import { dateLabel, Field, Feedback, panel, secondary, useGymQuery } from "./ui";

type SessionForm = Record<string, unknown>;
type SessionExercise = Record<string, unknown> & {
  exerciseId: string;
  name: string;
  trackingType?: string;
  result?: Record<string, unknown> & { sets?: Array<Record<string, unknown>> };
  notes?: string;
};
type PhotoDraft = {
  file?: File;
  photoUrl?: string;
  url: string;
  name: string;
  angle: "FRONT" | "SIDE" | "BACK" | "OTHER";
};
export type SessionCaptureValues = {
  sessionIndex: number;
  planRevision?: number;
  bodyMeasurement?: Record<string, number>;
  photoFiles: Array<{ file: File; angle: PhotoDraft["angle"] }>;
  existingPhotos: Array<{ photoUrl: string; angle: PhotoDraft["angle"] }>;
  customerSignature?: { signatureUrl: string; signerName: string; signedAt: string };
};
export type SessionCaptureHandle = {
  getValues: () => SessionCaptureValues;
  clearDraft: () => void;
};
type SignatureHandle = { getValue: () => SessionCaptureValues["customerSignature"] };
type SessionCaptureProps = {
  api: GymApi;
  customerId: string;
  form: SessionForm;
  onForm: (value: SessionForm) => void;
  planId: string;
  onPlan: (value: string) => void;
  exerciseLogs: SessionExercise[];
  onLogs: (value: SessionExercise[]) => void;
  onDirty: () => void;
  record?: GymRecord;
};

const trackingLabels: Record<string, string> = {
  STRENGTH: "Sức mạnh",
  BODYWEIGHT: "Trọng lượng cơ thể",
  CARDIO: "Cardio",
  INTERVAL: "Bài tập ngắt quãng",
  MOBILITY: "Linh hoạt",
};
const trackingFields: Record<string, ReadonlyArray<readonly [string, string]>> = {
  CARDIO: [
    ["durationMinutes", "Thời lượng (phút)"],
    ["distanceKm", "Quãng đường (km)"],
    ["paceSecondsPerKm", "Pace (giây/km)"],
    ["averageHeartRate", "Nhịp tim trung bình"],
    ["inclinePercent", "Độ dốc (%)"],
    ["calories", "Calories"],
    ["rpe", "RPE"],
  ],
  INTERVAL: [
    ["rounds", "Số vòng"],
    ["workSeconds", "Thời gian làm (giây)"],
    ["restSeconds", "Thời gian nghỉ (giây)"],
    ["distanceMetersPerRound", "Quãng đường/vòng (m)"],
    ["repsPerRound", "REPS/vòng"],
    ["rpe", "RPE"],
  ],
  MOBILITY: [
    ["durationMinutes", "Thời lượng (phút)"],
    ["reps", "REPS"],
    ["discomfort", "Mức khó chịu (1-10)"],
  ],
};
const fallbackFields = [
  ["sets", "Số hiệp"],
  ["reps", "Số lần"],
  ["weight", "Tạ (kg)"],
  ["duration", "Thời gian (phút)"],
  ["distance", "Quãng đường (m)"],
  ["restSeconds", "Nghỉ (giây)"],
] as const;

const INK_COLORS = [
  { id: "blue", label: "Xanh mực", hex: "#003b70" },
  { id: "black", label: "Đen", hex: "#0f172a" },
  { id: "red", label: "Đỏ", hex: "#dc2626" },
] as const;

const STROKE_WIDTHS = [
  { id: "thin", label: "Mảnh", value: 2 },
  { id: "medium", label: "Vừa", value: 3.5 },
  { id: "thick", label: "Đậm", value: 5.5 },
] as const;

interface NormalizedPoint {
  nx: number;
  ny: number;
}
interface Stroke {
  points: NormalizedPoint[];
  color: string;
  width: number;
}

function drawStrokes(
  canvas: HTMLCanvasElement,
  strokes: Stroke[],
  current: Stroke | null,
  initialImg: HTMLImageElement | null,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  if (initialImg) {
    ctx.drawImage(initialImg, 0, 0, width, height);
  }

  const all = current ? [...strokes, current] : strokes;
  for (const stroke of all) {
    const { points, color, width: strokeW } = stroke;
    if (!points.length) continue;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeW;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const p0x = points[0].nx * width;
    const p0y = points[0].ny * height;
    if (points.length === 1) {
      ctx.arc(p0x, p0y, strokeW / 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      continue;
    }
    ctx.moveTo(p0x, p0y);
    for (let i = 1; i < points.length - 1; i++) {
      const p1x = points[i].nx * width;
      const p1y = points[i].ny * height;
      const p2x = points[i + 1].nx * width;
      const p2y = points[i + 1].ny * height;
      ctx.quadraticCurveTo(p1x, p1y, (p1x + p2x) / 2, (p1y + p2y) / 2);
    }
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    ctx.quadraticCurveTo(prev.nx * width, prev.ny * height, last.nx * width, last.ny * height);
    ctx.stroke();
  }
  ctx.restore();
}

function logsFromDay(day: GymRecord | undefined, types: Map<string, string>): SessionExercise[] {
  return (day?.exercises || []).map((exercise: GymRecord) => {
    const trackingType = types.get(exercise.exerciseId) || exercise.trackingType || "STRENGTH";
    const count = Math.max(1, Math.min(100, Number(exercise.sets) || 1));
    return {
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      trackingType,
      prescribedSnapshot: {
        sets: exercise.sets,
        reps: exercise.reps,
        weight: exercise.weight,
        duration: exercise.duration,
        distance: exercise.distance,
        restSeconds: exercise.restSeconds,
      },
      result:
        trackingType === "STRENGTH" || trackingType === "BODYWEIGHT"
          ? { sets: Array.from({ length: count }, () => ({ completed: true })) }
          : {},
      notes: exercise.notes,
    };
  });
}

function summarizeExercisePerformance(log: SessionExercise): string {
  const sets = log.result?.sets;
  if (Array.isArray(sets) && sets.length > 0) {
    const completed = sets.filter((s) => s.completed !== false);
    const maxW = completed.reduce(
      (max, s) => Math.max(max, Number(s.weight || s.addedWeight || 0)),
      0,
    );
    const totalReps = completed.reduce((sum, s) => sum + Number(s.reps || 0), 0);
    return `${completed.length} hiệp · ${totalReps} reps${maxW > 0 ? ` · max ${maxW}kg` : ""}`;
  }
  if (log.result?.distanceKm || log.result?.durationMinutes) {
    return `${log.result.distanceKm || 0} km · ${log.result.durationMinutes || 0} phút`;
  }
  if (log.result?.rounds) {
    return `${log.result.rounds} vòng`;
  }
  return "Đã ghi nhận";
}

function CaptureSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-outline-variant/60 pt-4 first:border-t-0 first:pt-0">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-on-surface">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

const SignaturePad = forwardRef<
  SignatureHandle,
  { onDraw: () => void; initial?: GymRecord["customerSignature"]; defaultSignerName?: string }
>(({ onDraw, initial, defaultSignerName = "" }, ref) => {
  const inlineCanvasRef = useRef<HTMLCanvasElement>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const initialImgRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef(false);

  const [strokeCount, setStrokeCount] = useState(0);
  const [hasInitialImg, setHasInitialImg] = useState(Boolean(initial?.signatureUrl));
  const resolvedSignerName = (defaultSignerName || initial?.signerName || "").trim();
  const [selectedColor, setSelectedColor] = useState<string>(INK_COLORS[0].hex);
  const [selectedWidth, setSelectedWidth] = useState<number>(STROKE_WIDTHS[1].value);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasInk = strokeCount > 0 || hasInitialImg;

  const redrawAll = useCallback(() => {
    if (inlineCanvasRef.current) {
      drawStrokes(
        inlineCanvasRef.current,
        strokesRef.current,
        currentStrokeRef.current,
        initialImgRef.current,
      );
    }
    if (fullscreenCanvasRef.current) {
      drawStrokes(
        fullscreenCanvasRef.current,
        strokesRef.current,
        currentStrokeRef.current,
        initialImgRef.current,
      );
    }
  }, []);

  useEffect(() => {
    if (!initial?.signatureUrl) {
      initialImgRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      initialImgRef.current = img;
      setHasInitialImg(true);
      redrawAll();
    };
    img.src = initial.signatureUrl;
  }, [initial?.signatureUrl, redrawAll]);

  const syncCanvasSize = useCallback(
    (canvas: HTMLCanvasElement | null, minHeight = 160) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(240, Math.round(rect.width));
      const h = Math.max(minHeight, Math.round(rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      drawStrokes(canvas, strokesRef.current, currentStrokeRef.current, initialImgRef.current);
    },
    [],
  );

  useEffect(() => {
    const canvas = inlineCanvasRef.current;
    if (!canvas) return;
    syncCanvasSize(canvas, 160);
    const observer = new ResizeObserver(() => syncCanvasSize(canvas, 160));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [syncCanvasSize]);

  useEffect(() => {
    if (!isFullscreen) return;
    const canvas = fullscreenCanvasRef.current;
    const resize = () => syncCanvasSize(fullscreenCanvasRef.current, 280);
    resize();
    const raf = requestAnimationFrame(resize);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", resize);
      if (canvas) syncCanvasSize(inlineCanvasRef.current, 160);
    };
  }, [isFullscreen, syncCanvasSize]);

  useImperativeHandle(
    ref,
    () => ({
      getValue: () => {
        if (!hasInk) return undefined;
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = 1200;
        exportCanvas.height = 520;
        drawStrokes(exportCanvas, strokesRef.current, null, initialImgRef.current);
        return {
          signatureUrl: exportCanvas.toDataURL("image/png"),
          signerName: resolvedSignerName,
          signedAt: new Date().toISOString(),
        };
      },
    }),
    [hasInk, resolvedSignerName],
  );

  const normalizedPoint = (event: PointerEvent<HTMLCanvasElement>): NormalizedPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      nx: rect.width > 0 ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) : 0,
      ny: rect.height > 0 ? Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) : 0,
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    currentStrokeRef.current = {
      points: [normalizedPoint(event)],
      color: selectedColor,
      width: selectedWidth,
    };
    redrawAll();
    onDraw();
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    currentStrokeRef.current.points.push(normalizedPoint(event));
    redrawAll();
  };

  const onPointerUp = () => {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    drawingRef.current = false;
    strokesRef.current.push(currentStrokeRef.current);
    currentStrokeRef.current = null;
    setStrokeCount(strokesRef.current.length);
    redrawAll();
  };

  const undo = () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    redrawAll();
    onDraw();
  };

  const clear = () => {
    strokesRef.current = [];
    currentStrokeRef.current = null;
    initialImgRef.current = null;
    setStrokeCount(0);
    setHasInitialImg(false);
    redrawAll();
    onDraw();
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Ink Colors */}
      <div className="flex items-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest p-1">
        {INK_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            title={c.label}
            aria-label={`Màu mực ${c.label}`}
            aria-pressed={selectedColor === c.hex}
            onClick={() => setSelectedColor(c.hex)}
            className={cn(
              "inline-flex size-6 cursor-pointer items-center justify-center rounded transition-transform",
              selectedColor === c.hex && "ring-2 ring-primary ring-offset-1",
            )}
            style={{ backgroundColor: c.hex }}
          >
            {selectedColor === c.hex && <Check className="size-3 text-white" aria-hidden="true" />}
          </button>
        ))}
      </div>

      {/* Stroke Widths */}
      <div className="flex items-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest p-1">
        {STROKE_WIDTHS.map((w) => (
          <button
            key={w.id}
            type="button"
            aria-pressed={selectedWidth === w.value}
            onClick={() => setSelectedWidth(w.value)}
            className={cn(
              "cursor-pointer rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
              selectedWidth === w.value
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container",
            )}
          >
            {w.label}
          </button>
        ))}
      </div>

      {/* Undo */}
      <button
        type="button"
        disabled={strokeCount === 0}
        onClick={undo}
        className={cn(secondary, "min-h-8 px-2 text-xs")}
        title="Hoàn tác nét vẽ"
      >
        <Undo2 className="size-3.5" aria-hidden="true" />
        Hoàn tác
      </button>

      {/* Clear */}
      <button
        type="button"
        disabled={!hasInk}
        onClick={clear}
        className={cn(secondary, "min-h-8 px-2 text-xs text-error")}
        title="Xóa trắng bảng vẽ"
      >
        <RotateCcw className="size-3.5" aria-hidden="true" />
        Ký lại
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-outline-variant bg-surface-container-low/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/70 pb-2.5">
          <div className="text-xs">
            <span className="font-semibold text-on-surface">Bảng vẽ chữ ký khách hàng</span>{" "}
            <span
              className={cn(
                "ml-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                hasInk ? "bg-change-up/15 text-change-up" : "bg-tertiary-container text-on-tertiary-container",
              )}
            >
              {hasInk ? "Đã có chữ ký" : "Chờ khách ký"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {toolbar}
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2.5 text-xs font-semibold text-primary hover:bg-primary/15"
              title="Mở toàn màn hình để ký rộng hơn"
            >
              <Maximize2 className="size-3.5" aria-hidden="true" />
              Phóng to
            </button>
          </div>
        </div>

        <div className="relative mt-2.5 overflow-hidden rounded-md border-2 border-dashed border-outline-variant bg-surface-container-lowest">
          <canvas
            ref={inlineCanvasRef}
            aria-label="Vùng ký xác nhận bằng chuột hoặc cảm ứng"
            role="img"
            className="block h-44 w-full cursor-crosshair touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          {!hasInk && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-xs text-on-surface-variant/60">
              <PenLine className="mb-1 size-5" aria-hidden="true" />
              <span>Chạm ngón tay hoặc rê chuột vào đây để ký tên</span>
            </div>
          )}
        </div>
        {resolvedSignerName && (
          <p className="mt-2 text-xs text-on-surface-variant">
            Người ký: <span className="font-medium text-on-surface">{resolvedSignerName}</span>
          </p>
        )}
      </div>

      {isFullscreen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex h-[100dvh] w-full flex-col bg-surface-container-lowest"
            role="dialog"
            aria-modal="true"
            aria-label="Ký tên toàn màn hình"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-low px-4 py-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Quay lại form ghi nhận"
                  onClick={() => setIsFullscreen(false)}
                  className={secondary}
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                </button>
                <h4 className="text-sm font-semibold text-on-surface">
                  Ký tên xác nhận buổi tập
                </h4>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {toolbar}
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-md bg-primary px-3.5 text-xs font-semibold text-on-primary"
                >
                  <Check className="size-3.5" aria-hidden="true" />
                  Xong &amp; Áp dụng
                </button>
              </div>
            </div>
            <div className="relative min-h-0 flex-1 bg-surface-container-lowest">
              <canvas
                ref={fullscreenCanvasRef}
                aria-label="Vùng ký xác nhận toàn màn hình"
                role="img"
                className="block size-full cursor-crosshair touch-none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
});
SignaturePad.displayName = "SignaturePad";

const SessionCapture = forwardRef<SessionCaptureHandle, SessionCaptureProps>(function SessionCapture(
  { api, customerId, form, onForm, planId, onPlan, exerciseLogs, onLogs, onDirty, record },
  ref,
) {
  const draftKey = !record && customerId ? `igen_gym_session_draft_${customerId}` : "";
  const customerQuery = useGymQuery<GymRecord>(
    api,
    customerId ? `/customers/${encodeURIComponent(customerId)}` : "",
  );
  const defaultSignerName = String(
    customerQuery.data?.fullName ||
      customerQuery.data?.name ||
      record?.customerSignature?.signerName ||
      record?.customerName ||
      "",
  ).trim();
  const plansQuery = useGymQuery<GymList>(
    api,
    customerId ? `/workout-plans?customerId=${encodeURIComponent(customerId)}&limit=100` : "",
  );
  const previousSessionsQuery = useGymQuery<GymList>(
    api,
    customerId ? `/sessions?customerId=${encodeURIComponent(customerId)}&limit=10` : "",
  );
  const exercisesQuery = useGymQuery<GymList>(api, "/exercises?limit=100");
  const plans = plansQuery.data?.data || [];
  const exerciseTypes = new Map(
    (exercisesQuery.data?.data || []).map((exercise) => [exercise._id, exercise.trackingType]),
  );
  const selectedPlan = plans.find((plan) => plan._id === planId);
  const schedule: GymRecord[] = selectedPlan?.schedule || [];
  const [dayIndex, setDayIndex] = useState(
    Number(record?.sessionIndex ?? record?.planSnapshot?.sessionIndex ?? 0),
  );
  const [measurements, setMeasurements] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(record?.bodyMeasurement || {}).map(([key, value]) => [key, String(value)]),
    ),
  );
  const [photos, setPhotos] = useState<PhotoDraft[]>(() =>
    (record?.progressPhotos || []).map((photo: GymRecord, index: number) => ({
      photoUrl: photo.photoUrl,
      url: photo.photoUrl,
      name: `Ảnh ${index + 1}`,
      angle: photo.angle,
    })),
  );
  const [photoError, setPhotoError] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  const draftLoadedRef = useRef<string>("");
  const photoUrls = useRef(new Set<string>());
  const signatureRef = useRef<SignatureHandle>(null);

  const clearDraft = useCallback(() => {
    if (!draftKey || typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(draftKey);
      setDraftRestored(false);
    } catch {
      // ignore storage errors
    }
  }, [draftKey]);

  // Restore saved draft from localStorage on customer selection (new sessions only)
  useEffect(() => {
    if (!draftKey || draftLoadedRef.current === draftKey || typeof window === "undefined") return;
    draftLoadedRef.current = draftKey;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && typeof saved === "object") {
        if (saved.planId) onPlan(String(saved.planId));
        if (typeof saved.dayIndex === "number") setDayIndex(saved.dayIndex);
        if (Array.isArray(saved.exerciseLogs) && saved.exerciseLogs.length > 0) {
          onLogs(saved.exerciseLogs);
        }
        if (saved.measurements && typeof saved.measurements === "object") {
          setMeasurements(saved.measurements);
        }
        if (saved.feeling || saved.notes || saved.attendance) {
          onForm({
            ...form,
            ...(saved.attendance ? { attendance: saved.attendance } : {}),
            ...(saved.feeling ? { feeling: saved.feeling } : {}),
            ...(saved.notes ? { notes: saved.notes } : {}),
          });
        }
        setDraftRestored(true);
      }
    } catch {
      // ignore corrupt draft
    }
  }, [draftKey]);

  // Auto-save draft to localStorage as PT enters session data
  useEffect(() => {
    if (!draftKey || typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          draftKey,
          JSON.stringify({
            planId,
            dayIndex,
            exerciseLogs,
            measurements,
            attendance: form.attendance,
            feeling: form.feeling,
            notes: form.notes,
            savedAt: new Date().toISOString(),
          }),
        );
      } catch {
        // ignore quota errors
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draftKey, planId, dayIndex, exerciseLogs, measurements, form.attendance, form.feeling, form.notes]);

  useImperativeHandle(
    ref,
    () => ({
      getValues: () => {
        const bodyMeasurement = Object.fromEntries(
          Object.entries(measurements)
            .filter(([, value]) => value !== "" && Number.isFinite(Number(value)))
            .map(([key, value]) => [key, Number(value)]),
        );
        return {
          sessionIndex: dayIndex,
          planRevision: selectedPlan?.revision,
          bodyMeasurement: Object.keys(bodyMeasurement).length ? bodyMeasurement : undefined,
          photoFiles: photos.flatMap((photo) =>
            photo.file ? [{ file: photo.file, angle: photo.angle }] : [],
          ),
          existingPhotos: photos.flatMap((photo) =>
            photo.photoUrl ? [{ photoUrl: photo.photoUrl, angle: photo.angle }] : [],
          ),
          customerSignature: signatureRef.current?.getValue(),
        };
      },
      clearDraft,
    }),
    [measurements, photos, dayIndex, selectedPlan, clearDraft],
  );

  useEffect(
    () => () => {
      photoUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  useEffect(() => {
    if (record || planId || !plansQuery.data || !exercisesQuery.data) return;
    const active = (plansQuery.data.data || []).filter((plan) => plan.status === "ACTIVE");
    if (active.length !== 1) return;
    onPlan(active[0]._id);
    onLogs(
      logsFromDay(
        active[0].schedule?.[0],
        new Map((exercisesQuery.data.data || []).map((exercise) => [exercise._id, exercise.trackingType])),
      ),
    );
  }, [record, planId, plansQuery.data, exercisesQuery.data, onPlan, onLogs]);

  // Previous session comparison ("So sánh với hôm qua / buổi trước")
  const previousSession = useMemo(() => {
    const list = (previousSessionsQuery.data?.data || []).filter(
      (s) => s._id !== record?._id && s.attendance !== "ABSENT" && Array.isArray(s.exerciseLogs) && s.exerciseLogs.length > 0,
    );
    return list[0] || null;
  }, [previousSessionsQuery.data, record?._id]);

  const previousExerciseMap = useMemo(() => {
    const map = new Map<string, SessionExercise>();
    if (!previousSession) return map;
    for (const ex of previousSession.exerciseLogs || []) {
      const key = String(ex.exerciseId || ex.name || "").trim().toLowerCase();
      if (key) map.set(key, ex);
    }
    return map;
  }, [previousSession]);

  const loadDay = (index: number) => {
    setDayIndex(index);
    onLogs(logsFromDay(schedule[index], exerciseTypes));
    onDirty();
  };
  const updateLog = (index: number, key: string, value: unknown) => {
    onLogs(exerciseLogs.map((log, i) => (i === index ? { ...log, [key]: value } : log)));
    onDirty();
  };
  const updateResult = (index: number, key: string, value: unknown) => {
    const result = { ...(exerciseLogs[index]?.result || {}) };
    if (value === "") delete result[key];
    else result[key] = value;
    updateLog(index, "result", result);
  };
  const updateSet = (index: number, setIndex: number, key: string, value: unknown) => {
    const sets = [...(exerciseLogs[index]?.result?.sets || [])];
    const set = { ...sets[setIndex] };
    if (value === "") delete set[key];
    else set[key] = value;
    sets[setIndex] = set;
    updateResult(index, "sets", sets);
  };

  const dateTime = String(form.performedAt || "");
  const date = dateTime.slice(0, 10);
  const time = dateTime.length >= 16 ? dateTime.slice(11, 16) : "";
  const measurementFields = [
    ["weight", "Cân nặng (kg)"],
    ["bodyFatPercentage", "Tỷ lệ mỡ (%)"],
    ["muscleMass", "Khối lượng cơ (kg)"],
    ["chest", "Vòng ngực (cm)"],
    ["waist", "Vòng eo (cm)"],
    ["hip", "Vòng hông (cm)"],
    ["arm", "Vòng tay (cm)"],
    ["thigh", "Vòng đùi (cm)"],
    ["calf", "Bắp chân (cm)"],
  ] as const;

  return (
    <div className="space-y-4">
      {!record && customerId && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-outline-variant bg-surface-container-low/60 px-3 py-2 text-xs text-on-surface-variant">
          <span>
            {draftRestored
              ? "Đã khôi phục bản nháp chưa lưu trước đó · Nội dung đang nhập sẽ tự lưu trên trình duyệt."
              : "Nội dung đang nhập sẽ tự lưu trên trình duyệt."}
          </span>
          {draftRestored && (
            <button
              type="button"
              onClick={clearDraft}
              className="cursor-pointer font-semibold text-primary hover:underline"
            >
              Xóa bản nháp
            </button>
          )}
        </div>
      )}

      <CaptureSection icon={<Sparkles className="size-4 text-primary" aria-hidden="true" />} title="Giáo án & ca tập">
        {selectedPlan && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-outline-variant bg-surface-container-low p-3">
            <div>
              <p className="text-xs text-on-surface-variant">Giáo án áp dụng</p>
              <p className="font-semibold text-on-surface">{selectedPlan.title}</p>
            </div>
            <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              {schedule.length} buổi tập
            </span>
          </div>
        )}
        <Feedback loading={plansQuery.loading} error={plansQuery.error} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Giáo án"
            required
            value={planId}
            options={[
              ["", "Chọn giáo án"],
              ...plans
                .filter((plan) => plan.status === "ACTIVE" || plan._id === planId)
                .map((plan) => [plan._id, plan.title] as [string, string]),
              ...(planId && !plans.some((plan) => plan._id === planId)
                ? [[planId, "Giáo án đã chọn"] as [string, string]]
                : []),
            ]}
            onChange={(value) => {
              onPlan(value);
              setDayIndex(0);
              onLogs(
                logsFromDay(plans.find((plan) => plan._id === value)?.schedule?.[0], exerciseTypes),
              );
              onDirty();
            }}
          />
          <Field
            label="Ngày tập"
            required
            type="date"
            value={date}
            onChange={(value) => {
              onForm({ ...form, performedAt: `${value}T${time || "08:00"}` });
              onDirty();
            }}
          />
          <Field
            label="Giờ tập"
            required
            type="time"
            value={time}
            onChange={(value) => {
              const now = new Date();
              const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 10);
              onForm({ ...form, performedAt: `${date || today}T${value}` });
              onDirty();
            }}
          />
        </div>
        {schedule.length > 0 && (
          <Field
            label="Buổi tập"
            value={String(dayIndex)}
            options={schedule.map((day, index) => [
              String(index),
              day.title || `Buổi ${day.day || index + 1}`,
            ])}
            onChange={(value) => loadDay(Number(value))}
          />
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Điểm danh"
            required
            value={form.attendance}
            options={[
              ["PRESENT", "Có mặt"],
              ["ABSENT", "Vắng"],
              ["LATE", "Đi muộn"],
            ]}
            onChange={(value) => {
              onForm({ ...form, attendance: value });
              onDirty();
            }}
          />
          {form.attendance === "ABSENT" && (
            <Field
              label="Lý do vắng"
              value={form.absenceReason}
              onChange={(value) => {
                onForm({ ...form, absenceReason: value });
                onDirty();
              }}
            />
          )}
        </div>
      </CaptureSection>

      {/* So sánh với buổi gần nhất (3S "So sánh với hôm qua") */}
      {form.attendance !== "ABSENT" && previousSession && (
        <CaptureSection
          icon={<History className="size-4 text-primary" aria-hidden="true" />}
          title={`So sánh với buổi trước (${dateLabel(previousSession.performedAt)})`}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {(previousSession.exerciseLogs || []).slice(0, 6).map((prevEx: SessionExercise, idx: number) => (
              <div
                key={`${prevEx.exerciseId || prevEx.name}-${idx}`}
                className="rounded-md border border-outline-variant bg-surface-container-low/50 px-3 py-2 text-xs tabular-nums"
              >
                <p className="truncate font-semibold text-on-surface">{prevEx.name}</p>
                <p className="mt-0.5 text-on-surface-variant">
                  Buổi trước: <strong className="text-primary">{summarizeExercisePerformance(prevEx)}</strong>
                </p>
              </div>
            ))}
          </div>
        </CaptureSection>
      )}

      {form.attendance !== "ABSENT" && (
        <CaptureSection
          icon={<Dumbbell className="size-4 text-primary" aria-hidden="true" />}
          title={`Kết quả bài tập (${exerciseLogs.length})`}
        >
          {schedule.length > 0 && exerciseLogs.length === 0 && (
            <button type="button" className={secondary} onClick={() => loadDay(dayIndex)}>
              Nạp bài tập của buổi đã chọn
            </button>
          )}
          {exerciseLogs.length === 0 && (
            <p className="text-sm text-on-surface-variant">
              Chọn giáo án và buổi tập để ghi kết quả.
            </p>
          )}
          <div className="space-y-3">
            {exerciseLogs.map((log, index) => {
              const trackingType = log.trackingType || exerciseTypes.get(log.exerciseId) || "";
              const prevMatch = previousExerciseMap.get(
                String(log.exerciseId || log.name || "").trim().toLowerCase(),
              );
              return (
                <div key={`${log.exerciseId || log.name}-${index}`} className={panel}>
                  <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-outline-variant pb-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-on-surface">{log.name || "Bài tập"}</h4>
                      {prevMatch && (
                        <p className="text-[11px] tabular-nums text-primary">
                          Buổi trước: {summarizeExercisePerformance(prevMatch)}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-on-surface-variant">
                      {trackingLabels[trackingType] || "Kết quả"}
                    </span>
                  </div>
                  {log.result?.sets ? (
                    <div className="space-y-2">
                      {log.result.sets.map((set: Record<string, unknown>, setIndex: number) => (
                        <div
                          key={setIndex}
                          className="rounded-md border border-outline-variant bg-surface-container-low p-3"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <strong className="text-xs text-on-surface">Hiệp {setIndex + 1}</strong>
                            <button
                              type="button"
                              className="cursor-pointer text-xs text-error"
                              aria-label={`Xóa hiệp ${setIndex + 1} của ${log.name}`}
                              onClick={() =>
                                updateResult(
                                  index,
                                  "sets",
                                  log.result!.sets!.filter((_: unknown, i: number) => i !== setIndex),
                                )
                              }
                              disabled={log.result!.sets!.length <= 1}
                            >
                              Xóa hiệp
                            </button>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Field
                              label="REPS"
                              type="number"
                              min={0}
                              value={set.reps ?? ""}
                              onChange={(value) => updateSet(index, setIndex, "reps", value)}
                            />
                            <Field
                              label={trackingType === "BODYWEIGHT" ? "Tạ thêm (kg)" : "Mức tạ (kg)"}
                              type="number"
                              min={0}
                              value={
                                trackingType === "BODYWEIGHT"
                                  ? (set.addedWeight ?? "")
                                  : (set.weight ?? "")
                              }
                              onChange={(value) =>
                                updateSet(
                                  index,
                                  setIndex,
                                  trackingType === "BODYWEIGHT" ? "addedWeight" : "weight",
                                  value,
                                )
                              }
                            />
                            <Field
                              label="RPE (1-10)"
                              type="number"
                              min={0}
                              max={10}
                              value={set.rpe ?? ""}
                              onChange={(value) => updateSet(index, setIndex, "rpe", value)}
                            />
                            <Field
                              label="RIR"
                              type="number"
                              min={0}
                              value={set.rir ?? ""}
                              onChange={(value) => updateSet(index, setIndex, "rir", value)}
                            />
                          </div>
                          <label className="mt-2 flex items-center gap-2 text-xs text-on-surface">
                            <input
                              type="checkbox"
                              className="size-4 accent-primary"
                              checked={set.completed !== false}
                              onChange={(event) =>
                                updateSet(index, setIndex, "completed", event.target.checked)
                              }
                            />
                            Hoàn thành hiệp
                          </label>
                        </div>
                      ))}
                      <button
                        type="button"
                        className={secondary}
                        onClick={() =>
                          updateResult(index, "sets", [...log.result!.sets!, { completed: true }])
                        }
                      >
                        + Thêm hiệp
                      </button>
                    </div>
                  ) : log.result ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {(trackingFields[trackingType] || []).map(([key, label]) => (
                        <Field
                          key={key}
                          label={label}
                          type="number"
                          min={0}
                          max={key === "rpe" || key === "discomfort" ? 10 : undefined}
                          value={log.result![key] ?? ""}
                          onChange={(value) => updateResult(index, key, value)}
                        />
                      ))}
                      {trackingType === "MOBILITY" && (
                        <Field
                          label="Bên tập"
                          value={log.result.side || "BOTH"}
                          options={[
                            ["LEFT", "Trái"],
                            ["RIGHT", "Phải"],
                            ["BOTH", "Hai bên"],
                          ]}
                          onChange={(value) => updateResult(index, "side", value)}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-3">
                      {fallbackFields.map(([key, label]) => (
                        <Field
                          key={key}
                          label={label}
                          type={key === "reps" ? "text" : "number"}
                          min={0}
                          value={log[key] ?? ""}
                          onChange={(value) => updateLog(index, key, value)}
                        />
                      ))}
                    </div>
                  )}
                  <div className="mt-3">
                    <Field
                      label="Ghi chú bài tập"
                      value={log.notes || ""}
                      onChange={(value) => updateLog(index, "notes", value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CaptureSection>
      )}

      {form.attendance !== "ABSENT" && (
        <CaptureSection
          icon={<Scale className="size-4 text-primary" aria-hidden="true" />}
          title="Chỉ số đo lường"
        >
          <p className="text-xs text-on-surface-variant">
            Số đo được lưu theo ngày tập để theo dõi tiến độ.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {measurementFields.map(([key, label]) => (
              <Field
                key={key}
                label={label}
                type="number"
                min={key === "weight" ? 0.1 : 0}
                max={key === "bodyFatPercentage" ? 100 : undefined}
                value={measurements[key] || ""}
                onChange={(value) => {
                  setMeasurements((current) => ({ ...current, [key]: value }));
                  onDirty();
                }}
              />
            ))}
          </div>
        </CaptureSection>
      )}

      {form.attendance !== "ABSENT" && (
        <CaptureSection
          icon={<Camera className="size-4 text-primary" aria-hidden="true" />}
          title="Ảnh tiến độ"
        >
          <p className="text-xs text-on-surface-variant">
            Tối đa 4 ảnh JPG, PNG hoặc WebP, mỗi ảnh không quá 5 MB.
          </p>
          <label className={`${secondary} relative w-fit cursor-pointer`}>
            Chọn ảnh
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(event) => {
                const selected = Array.from(event.target.files || []);
                const files = selected.filter(
                  (file) =>
                    ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
                    file.size <= 5 * 1024 * 1024,
                );
                setPhotoError(
                  files.length !== selected.length
                    ? "Chỉ nhận ảnh JPG, PNG hoặc WebP tối đa 5 MB."
                    : selected.length > 4 - photos.length
                      ? "Mỗi buổi tập tối đa 4 ảnh."
                      : "",
                );
                setPhotos((current) => [
                  ...current,
                  ...files.slice(0, 4 - current.length).map((file, index) => {
                    const url = URL.createObjectURL(file);
                    photoUrls.current.add(url);
                    return {
                      file,
                      name: file.name,
                      url,
                      angle: (["FRONT", "SIDE", "BACK", "OTHER"] as const)[
                        current.length + index
                      ] || "OTHER",
                    };
                  }),
                ]);
                event.target.value = "";
                onDirty();
              }}
            />
          </label>
          {photoError && (
            <p role="alert" className="text-xs text-error">
              {photoError}
            </p>
          )}
          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {photos.map((photo, index) => (
                <div
                  key={photo.url}
                  className="overflow-hidden rounded-md border border-outline-variant"
                >
                  <img
                    src={photo.url}
                    alt={`Ảnh tiến độ ${index + 1}`}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="flex items-center justify-between gap-1 p-2">
                    <span className="truncate text-xs">{photo.name}</span>
                    <button
                      type="button"
                      className="cursor-pointer text-error"
                      aria-label={`Bỏ ảnh ${index + 1}`}
                      onClick={() => {
                        if (photo.file) {
                          URL.revokeObjectURL(photo.url);
                          photoUrls.current.delete(photo.url);
                        }
                        setPhotos((current) => current.filter((item) => item.url !== photo.url));
                        onDirty();
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="px-2 pb-2">
                    <Field
                      label="Góc chụp"
                      value={photo.angle}
                      options={[
                        ["FRONT", "Chính diện"],
                        ["SIDE", "Nghiêng"],
                        ["BACK", "Phía sau"],
                        ["OTHER", "Khác"],
                      ]}
                      onChange={(value) => {
                        setPhotos((current) =>
                          current.map((item) =>
                            item.url === photo.url
                              ? { ...item, angle: value as PhotoDraft["angle"] }
                              : item,
                          ),
                        );
                        onDirty();
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CaptureSection>
      )}

      <CaptureSection
        icon={<MessageSquare className="size-4 text-primary" aria-hidden="true" />}
        title="Cảm nhận & ghi chú"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Cảm nhận sau buổi tập"
            multiline
            value={form.feeling}
            onChange={(value) => {
              onForm({ ...form, feeling: value });
              onDirty();
            }}
            placeholder="Thể lực, mức độ hoàn thành..."
          />
          <Field
            label="Ghi chú chuyên môn"
            multiline
            value={form.notes}
            onChange={(value) => {
              onForm({ ...form, notes: value });
              onDirty();
            }}
            placeholder="Kỹ thuật, điều chỉnh cho buổi sau..."
          />
        </div>
      </CaptureSection>

      {form.attendance !== "ABSENT" && (
        <CaptureSection
          icon={<PenLine className="size-4 text-primary" aria-hidden="true" />}
          title="Chữ ký xác nhận của khách hàng"
        >
          <SignaturePad
            ref={signatureRef}
            onDraw={onDirty}
            initial={record?.customerSignature}
            defaultSignerName={defaultSignerName}
          />
        </CaptureSection>
      )}
    </div>
  );
});
export default SessionCapture;

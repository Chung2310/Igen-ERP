import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowRightLeft,
  Calendar,
  Camera,
  Image as ImageIcon,
  Pencil,
  Plus,
  Sliders,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { ErpModal } from "../../components/common/ErpModal";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import type { GymList, GymRecord } from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import { Dropdown } from "./GymDropdown";
import {
  dateLabel,
  Feedback,
  Field,
  GymEmptyState,
  messageOf,
  primary,
  secondary,
  useGymQuery,
} from "./ui";

const STAGE_META: Record<
  string,
  { label: string; short: string; tone: "info" | "success" | "violet" }
> = {
  BEFORE: { label: "Trước khi tập (Before)", short: "BEFORE", tone: "info" },
  AFTER: { label: "Sau khi tập (After)", short: "AFTER", tone: "success" },
  PROGRESS: { label: "Tiến độ định kỳ", short: "PROGRESS", tone: "violet" },
};

const ANGLE_LABELS: Record<string, string> = {
  FRONT: "Chính diện",
  SIDE: "Nghiêng",
  BACK: "Phía sau",
  OTHER: "Khác",
};

type QueuePhoto = {
  id: string;
  file: File;
  previewUrl: string;
  stage: "BEFORE" | "AFTER" | "PROGRESS";
  angle: "FRONT" | "SIDE" | "BACK" | "OTHER";
  weight: string;
  bodyFat: string;
  notes: string;
  takenDate: string;
};

export function CustomerPhotoContent({
  api,
  customerId,
  customerName,
  canWrite,
  onChanged,
  extraLegacyPhotos = [],
}: {
  api: GymApi;
  customerId: string;
  customerName?: string;
  canWrite: boolean;
  onChanged?: () => void;
  extraLegacyPhotos?: GymRecord[];
}) {
  const [activeTab, setActiveTab] = useState<"gallery" | "compare">("gallery");
  const [stageFilter, setStageFilter] = useState("");
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [editing, setEditing] = useState<GymRecord | null>(null);
  const [deleting, setDeleting] = useState<GymRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  // Batch upload queue
  const [uploadQueue, setUploadQueue] = useState<QueuePhoto[]>([]);
  const [bulkStage, setBulkStage] = useState<"BEFORE" | "AFTER" | "PROGRESS">("BEFORE");
  const [bulkDate, setBulkDate] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }),
  );
  const [bulkWeight, setBulkWeight] = useState("");

  // Compare state
  const [beforePhotoId, setBeforePhotoId] = useState("");
  const [afterPhotoId, setAfterPhotoId] = useState("");
  const [compareAngle, setCompareAngle] = useState("ALL");
  const [compareViewType, setCompareViewType] = useState<
    "sideBySide" | "slider" | "multiAngle" | "timeline"
  >("sideBySide");
  const [sliderPos, setSliderPos] = useState(50);
  const [zoomPhoto, setZoomPhoto] = useState<GymRecord | null>(null);
  const sliderContainerRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  const photosQuery = useGymQuery<GymList>(
    api,
    `/progress-photos?customerId=${customerId}&limit=100`,
    refresh,
  );

  const allItems = useMemo(() => {
    const stored = photosQuery.data?.data || [];
    const storedSessionIds = new Set(stored.map((p) => p.sessionId).filter(Boolean));
    const legacy = extraLegacyPhotos.filter(
      (p) => !p.sessionId || !storedSessionIds.has(p.sessionId),
    );
    return [...stored, ...legacy];
  }, [photosQuery.data, extraLegacyPhotos]);

  const galleryItems = useMemo(
    () =>
      stageFilter
        ? allItems.filter((p) => p.stage === stageFilter)
        : allItems,
    [allItems, stageFilter],
  );

  const reload = () => {
    setRefresh((r) => r + 1);
    onChanged?.();
  };

  // Dragging split slider
  const handleSliderMove = (clientX: number) => {
    const el = sliderContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const percent = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(Math.round(percent * 10) / 10);
  };

  useEffect(() => {
    if (!isDraggingSlider) return;
    const onMouseMove = (e: MouseEvent) => handleSliderMove(e.clientX);
    const onMouseUp = () => setIsDraggingSlider(false);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleSliderMove(e.touches[0].clientX);
    };
    const onTouchEnd = () => setIsDraggingSlider(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [isDraggingSlider]);

  const dateMs = (item: GymRecord) =>
    new Date(item.takenDate || item.date || item.createdAt || 0).getTime();

  const autoPairPhotos = (angle = compareAngle) => {
    const pool =
      angle === "ALL" ? allItems : allItems.filter((p) => p.angle === angle);
    if (pool.length === 0) return;
    if (pool.length === 1) {
      setBeforePhotoId(pool[0]._id);
      setAfterPhotoId("");
      return;
    }
    const sorted = [...pool].sort((a, b) => dateMs(a) - dateMs(b));
    const earliest = sorted.find((p) => p.stage === "BEFORE") || sorted[0];
    const latest =
      [...sorted]
        .reverse()
        .find(
          (p) =>
            (p.stage === "AFTER" || p.stage === "PROGRESS") &&
            p._id !== earliest._id,
        ) || sorted[sorted.length - 1];
    if (earliest) setBeforePhotoId(earliest._id);
    if (latest) setAfterPhotoId(latest._id);
  };

  const beforeOptions = useMemo(() => {
    const pool =
      compareAngle === "ALL"
        ? allItems
        : allItems.filter((p) => p.angle === compareAngle);
    const befores = pool.filter((p) => p.stage === "BEFORE");
    return befores.length > 0 ? befores : pool;
  }, [allItems, compareAngle]);

  const afterOptions = useMemo(() => {
    const pool =
      compareAngle === "ALL"
        ? allItems
        : allItems.filter((p) => p.angle === compareAngle);
    const afters = pool.filter(
      (p) => p.stage === "AFTER" || p.stage === "PROGRESS",
    );
    return afters.length > 0 ? afters : pool;
  }, [allItems, compareAngle]);

  useEffect(() => {
    if (
      beforeOptions.length > 0 &&
      !beforeOptions.some((p) => p._id === beforePhotoId)
    ) {
      setBeforePhotoId(beforeOptions[0]._id);
    }
  }, [beforeOptions, beforePhotoId]);

  useEffect(() => {
    if (
      afterOptions.length > 0 &&
      !afterOptions.some((p) => p._id === afterPhotoId)
    ) {
      setAfterPhotoId(afterOptions[afterOptions.length - 1]._id);
    }
  }, [afterOptions, afterPhotoId]);

  const selectedBefore = useMemo(
    () => allItems.find((i) => i._id === beforePhotoId),
    [allItems, beforePhotoId],
  );
  const selectedAfter = useMemo(
    () => allItems.find((i) => i._id === afterPhotoId),
    [allItems, afterPhotoId],
  );

  const multiAnglePairs = useMemo(() => {
    const angles: Array<"FRONT" | "SIDE" | "BACK"> = ["FRONT", "SIDE", "BACK"];
    return angles.map((angle) => {
      const list = allItems
        .filter((p) => p.angle === angle)
        .sort((a, b) => dateMs(a) - dateMs(b));
      const before = list.find((p) => p.stage === "BEFORE") || list[0] || null;
      const after =
        [...list]
          .reverse()
          .find(
            (p) =>
              (p.stage === "AFTER" || p.stage === "PROGRESS") &&
              p._id !== before?._id,
          ) || (list.length > 1 ? list[list.length - 1] : null);
      return {
        angle,
        title: ANGLE_LABELS[angle] || angle,
        before,
        after: after && after._id !== before?._id ? after : null,
        totalCount: list.length,
      };
    });
  }, [allItems]);

  const sortedTimeline = useMemo(
    () => [...allItems].sort((a, b) => dateMs(a) - dateMs(b)),
    [allItems],
  );

  const handleFilesSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const added: QueuePhoto[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      stage: bulkStage,
      angle: "FRONT",
      weight: bulkWeight,
      bodyFat: "",
      notes: "",
      takenDate: bulkDate,
    }));
    setUploadQueue((prev) => [...prev, ...added]);
    e.target.value = "";
  };

  const handleBatchUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!uploadQueue.length) {
      setError("Vui lòng chọn ít nhất 1 ảnh để tải lên.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      for (const item of uploadQueue) {
        const data = new FormData();
        data.append("customerId", customerId);
        data.append("file", item.file);
        const uploaded = await api.request<{ photoUrl: string }>(
          "/sessions/photos/upload",
          "POST",
          data,
        );
        await api.save("progress-photos", {
          customerId,
          photoUrl: uploaded.photoUrl,
          takenDate: item.takenDate || bulkDate,
          stage: item.stage,
          angle: item.angle,
          weight: item.weight !== "" ? Number(item.weight) : null,
          bodyFat: item.bodyFat !== "" ? Number(item.bodyFat) : null,
          notes: item.notes.trim(),
        });
      }
      uploadQueue.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setUploadQueue([]);
      setShowUploadForm(false);
      reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setUploading(false);
    }
  };

  const photoOptionLabel = (p: GymRecord) =>
    `${dateLabel(p.takenDate || p.date)} (${STAGE_META[p.stage]?.label || p.stage || "Tiến độ"}) - ${ANGLE_LABELS[p.angle] || p.angle || "Khác"}${p.weight != null ? ` · ${p.weight}kg` : ""}`;

  return (
    <div className="space-y-4">
      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-outline-variant bg-surface-container-low p-0.5">
          <button
            type="button"
            aria-pressed={activeTab === "gallery"}
            onClick={() => setActiveTab("gallery")}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors",
              activeTab === "gallery"
                ? "bg-primary text-on-primary shadow-2xs"
                : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            <ImageIcon className="size-3.5" aria-hidden="true" />
            Thư viện ảnh ({allItems.length})
          </button>
          <button
            type="button"
            aria-pressed={activeTab === "compare"}
            onClick={() => setActiveTab("compare")}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors",
              activeTab === "compare"
                ? "bg-primary text-on-primary shadow-2xs"
                : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            <Sliders className="size-3.5" aria-hidden="true" />
            So sánh Before / After
          </button>
        </div>
        {customerName && (
          <span className="text-xs text-on-surface-variant">
            Theo dõi hình thể đa góc độ · <strong className="text-on-surface">{customerName}</strong>
          </span>
        )}
      </div>

      <Feedback loading={photosQuery.loading} error={photosQuery.error || error} />

      {/* GALLERY TAB */}
      {activeTab === "gallery" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Dropdown
              aria-label="Lọc theo giai đoạn"
              variant="filter"
              value={stageFilter}
              onChange={setStageFilter}
              options={[
                { value: "", label: "Tất cả giai đoạn" },
                { value: "BEFORE", label: "Trước khi tập (Before)" },
                { value: "AFTER", label: "Sau khi tập (After)" },
                { value: "PROGRESS", label: "Tiến độ định kỳ" },
              ]}
            />
            {canWrite && !showUploadForm && (
              <button
                type="button"
                className={cn(primary, "min-h-9")}
                onClick={() => setShowUploadForm(true)}
              >
                <Plus className="size-4" aria-hidden="true" />
                Tải nhiều ảnh mới
              </button>
            )}
          </div>

          {canWrite && showUploadForm && (
            <form
              onSubmit={handleBatchUpload}
              className="space-y-3 rounded-lg border border-outline-variant bg-surface-container-low/50 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-on-surface">
                    Tải nhiều ảnh tiến độ cùng lúc
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Chọn nhiều ảnh cùng lúc, gán nhanh giai đoạn (Before/After/Tiến độ) và lưu 1 chạm.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Đóng form tải ảnh"
                  onClick={() => setShowUploadForm(false)}
                  className={secondary}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>

              <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 px-4 py-6 text-center transition-colors hover:bg-primary/10">
                <Upload className="size-7 text-primary" aria-hidden="true" />
                <strong className="text-sm text-on-surface">
                  Nhấp để chọn nhiều ảnh tiến độ
                </strong>
                <span className="text-xs text-on-surface-variant">
                  Hỗ trợ JPG, PNG, WebP (chọn 1 hoặc nhiều ảnh cùng lúc)
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFilesSelect}
                  className="sr-only"
                />
              </label>

              {uploadQueue.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-outline-variant bg-surface-container-lowest p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-on-surface">
                        Gán nhanh cho {uploadQueue.length} ảnh:
                      </span>
                      {(
                        [
                          ["BEFORE", "Tất cả Trước (Before)"],
                          ["AFTER", "Tất cả Sau (After)"],
                          ["PROGRESS", "Tất cả Tiến độ"],
                        ] as const
                      ).map(([stageVal, label]) => (
                        <button
                          key={stageVal}
                          type="button"
                          onClick={() => {
                            setBulkStage(stageVal);
                            setUploadQueue((q) =>
                              q.map((item) => ({ ...item, stage: stageVal })),
                            );
                          }}
                          className={
                            bulkStage === stageVal
                              ? "cursor-pointer rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-on-primary"
                              : "cursor-pointer rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1 text-xs font-medium text-on-surface hover:bg-surface-container"
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        aria-label="Ngày chụp cho tất cả"
                        value={bulkDate}
                        onChange={(e) => {
                          setBulkDate(e.target.value);
                          setUploadQueue((q) =>
                            q.map((item) => ({ ...item, takenDate: e.target.value })),
                          );
                        }}
                        className="rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1 text-xs text-on-surface"
                      />
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        aria-label="Cân nặng cho tất cả"
                        placeholder="Cân nặng (kg)"
                        value={bulkWeight}
                        onChange={(e) => {
                          setBulkWeight(e.target.value);
                          setUploadQueue((q) =>
                            q.map((item) => ({ ...item, weight: e.target.value })),
                          );
                        }}
                        className="w-28 rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1 text-xs text-on-surface"
                      />
                    </div>
                  </div>

                  <div className="grid max-h-72 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                    {uploadQueue.map((item, idx) => (
                      <div
                        key={item.id}
                        className="relative overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest"
                      >
                        <button
                          type="button"
                          aria-label={`Bỏ ảnh ${idx + 1}`}
                          onClick={() => {
                            URL.revokeObjectURL(item.previewUrl);
                            setUploadQueue((q) => q.filter((x) => x.id !== item.id));
                          }}
                          className="absolute right-1.5 top-1.5 z-10 inline-flex size-6 cursor-pointer items-center justify-center rounded-full bg-slate-950/70 text-white hover:bg-slate-950"
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </button>
                        <div className="relative h-32 bg-surface-container">
                          <img
                            src={item.previewUrl}
                            alt={`Ảnh chờ tải ${idx + 1}`}
                            className="size-full object-cover"
                          />
                          <span className="absolute bottom-1 left-1 rounded bg-slate-950/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            #{idx + 1}
                          </span>
                        </div>
                        <div className="space-y-1.5 p-2 text-xs">
                          <select
                            aria-label={`Giai đoạn ảnh ${idx + 1}`}
                            value={item.stage}
                            onChange={(e) =>
                              setUploadQueue((q) =>
                                q.map((x) =>
                                  x.id === item.id
                                    ? { ...x, stage: e.target.value as QueuePhoto["stage"] }
                                    : x,
                                ),
                              )
                            }
                            className="w-full rounded border border-outline-variant bg-surface-container-lowest px-2 py-1 text-xs font-medium text-on-surface"
                          >
                            <option value="BEFORE">Trước (Before)</option>
                            <option value="AFTER">Sau (After)</option>
                            <option value="PROGRESS">Tiến độ định kỳ</option>
                          </select>
                          <div className="grid grid-cols-2 gap-1.5">
                            <select
                              aria-label={`Góc chụp ảnh ${idx + 1}`}
                              value={item.angle}
                              onChange={(e) =>
                                setUploadQueue((q) =>
                                  q.map((x) =>
                                    x.id === item.id
                                      ? { ...x, angle: e.target.value as QueuePhoto["angle"] }
                                      : x,
                                  ),
                                )
                              }
                              className="rounded border border-outline-variant bg-surface-container-lowest px-1.5 py-1 text-xs text-on-surface"
                            >
                              <option value="FRONT">Chính diện</option>
                              <option value="SIDE">Nghiêng</option>
                              <option value="BACK">Phía sau</option>
                              <option value="OTHER">Khác</option>
                            </select>
                            <input
                              type="number"
                              step="0.1"
                              min={0}
                              aria-label={`Cân nặng ảnh ${idx + 1}`}
                              placeholder="Kg"
                              value={item.weight}
                              onChange={(e) =>
                                setUploadQueue((q) =>
                                  q.map((x) =>
                                    x.id === item.id ? { ...x, weight: e.target.value } : x,
                                  ),
                                )
                              }
                              className="rounded border border-outline-variant bg-surface-container-lowest px-1.5 py-1 text-xs text-on-surface"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 border-t border-outline-variant pt-2.5">
                    <button
                      type="button"
                      className={secondary}
                      disabled={uploading}
                      onClick={() => {
                        uploadQueue.forEach((item) => URL.revokeObjectURL(item.previewUrl));
                        setUploadQueue([]);
                      }}
                    >
                      Xóa tất cả ({uploadQueue.length})
                    </button>
                    <button
                      type="submit"
                      className={cn(primary, "min-h-9")}
                      disabled={uploading}
                    >
                      {uploading
                        ? "Đang tải lên..."
                        : `Tải lên tất cả (${uploadQueue.length} ảnh)`}
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}

          {!photosQuery.loading && galleryItems.length === 0 ? (
            <div className="rounded-md border border-dashed border-outline-variant bg-surface-container-lowest">
              <GymEmptyState
                kind="task"
                filtered={Boolean(stageFilter)}
                title="Chưa có ảnh tiến độ Before / After."
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {galleryItems.map((item, idx) => {
                const st = STAGE_META[item.stage] || STAGE_META.PROGRESS;
                return (
                  <article
                    key={item._id || `${item.sessionId}-${idx}`}
                    className="flex flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-2xs"
                  >
                    <div className="relative h-52 bg-surface-container">
                      <button
                        type="button"
                        onClick={() => setZoomPhoto(item)}
                        className="block size-full cursor-pointer"
                        aria-label={`Phóng to ảnh ${st.label}`}
                      >
                        <img
                          src={item.photoUrl}
                          alt={st.label}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      </button>
                      <span className="absolute left-2 top-2">
                        <HrStatusBadge tone={st.tone}>{st.short}</HrStatusBadge>
                      </span>
                      <span className="absolute bottom-2 left-2 rounded bg-slate-950/70 px-2 py-0.5 text-[11px] font-medium text-white">
                        {ANGLE_LABELS[item.angle] || item.angle || "Khác"}
                      </span>
                      {canWrite && item.revision && (
                        <div className="absolute right-2 top-2 flex gap-1">
                          <button
                            type="button"
                            aria-label="Sửa ảnh tiến độ"
                            onClick={() => setEditing(item)}
                            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full bg-surface-container-lowest/90 text-on-surface shadow-xs hover:text-primary"
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label="Xóa ảnh tiến độ"
                            onClick={() => setDeleting(item)}
                            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full bg-error text-on-error shadow-xs hover:bg-error/90"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 p-3 text-xs text-on-surface-variant">
                      <div className="flex items-center justify-between gap-2 tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="size-3" aria-hidden="true" />
                          {dateLabel(item.takenDate || item.date)}
                        </span>
                        {(item.weight != null || item.bodyFat != null) && (
                          <strong className="text-on-surface">
                            {item.weight != null ? `${item.weight} kg` : ""}
                            {item.bodyFat != null ? ` · ${item.bodyFat}%` : ""}
                          </strong>
                        )}
                      </div>
                      {item.notes && (
                        <p className="truncate text-on-surface-variant">{item.notes}</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* COMPARE TAB */}
      {activeTab === "compare" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-outline-variant bg-surface-container-low/50 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-on-surface">Chế độ xem:</span>
              {(
                [
                  ["sideBySide", "Song song (2 cột)"],
                  ["slider", "Thanh trượt lồng nhau"],
                  ["multiAngle", "Trọn bộ 3 góc (360°)"],
                  ["timeline", `Dòng thời gian (${allItems.length})`],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={compareViewType === mode}
                  onClick={() => setCompareViewType(mode)}
                  className={cn(
                    "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    compareViewType === mode
                      ? "bg-primary text-on-primary"
                      : "border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:text-on-surface",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {(compareViewType === "sideBySide" || compareViewType === "slider") && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Dropdown
                  aria-label="Lọc góc chụp so sánh"
                  variant="filter"
                  value={compareAngle}
                  onChange={(val) => {
                    setCompareAngle(val);
                    autoPairPhotos(val);
                  }}
                  options={[
                    { value: "ALL", label: "Tất cả góc" },
                    { value: "FRONT", label: "Chính diện" },
                    { value: "SIDE", label: "Nghiêng" },
                    { value: "BACK", label: "Phía sau" },
                  ]}
                />
                <button
                  type="button"
                  className={secondary}
                  onClick={() => autoPairPhotos()}
                  title="Tự động chọn ảnh đầu tiên và ảnh mới nhất"
                >
                  <Zap className="size-3.5" aria-hidden="true" />
                  Ghép tự động
                </button>
                <button
                  type="button"
                  className={secondary}
                  onClick={() => {
                    const tmp = beforePhotoId;
                    setBeforePhotoId(afterPhotoId);
                    setAfterPhotoId(tmp);
                  }}
                  title="Đổi chiều ảnh Trước và Sau"
                >
                  <ArrowRightLeft className="size-3.5" aria-hidden="true" />
                  Hoán đổi
                </button>
              </div>
            )}
          </div>

          {(compareViewType === "sideBySide" || compareViewType === "slider") && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 rounded-md border border-primary/30 bg-primary/5 p-3">
                <label className="flex items-center justify-between text-xs font-semibold text-primary">
                  <span>1. Ảnh Trước (Before)</span>
                  <span className="opacity-80">({beforeOptions.length} ảnh)</span>
                </label>
                <Dropdown
                  aria-label="Chọn ảnh Before"
                  variant="filter"
                  className="w-full"
                  triggerClassName="w-full justify-between"
                  value={beforePhotoId}
                  onChange={setBeforePhotoId}
                  options={[
                    { value: "", label: "-- Chọn ảnh Trước (Before) --" },
                    ...beforeOptions.map((p) => ({
                      value: p._id,
                      label: photoOptionLabel(p),
                    })),
                  ]}
                />
              </div>

              <div className="space-y-1.5 rounded-md border border-change-up/30 bg-change-up/5 p-3">
                <label className="flex items-center justify-between text-xs font-semibold text-change-up">
                  <span>2. Ảnh Sau (After)</span>
                  <span className="opacity-80">({afterOptions.length} ảnh)</span>
                </label>
                <Dropdown
                  aria-label="Chọn ảnh After"
                  variant="filter"
                  className="w-full"
                  triggerClassName="w-full justify-between"
                  value={afterPhotoId}
                  onChange={setAfterPhotoId}
                  options={[
                    { value: "", label: "-- Chọn ảnh Sau (After) --" },
                    ...afterOptions.map((p) => ({
                      value: p._id,
                      label: photoOptionLabel(p),
                    })),
                  ]}
                />
              </div>
            </div>
          )}

          {/* VIEW 1: SIDE BY SIDE */}
          {compareViewType === "sideBySide" &&
            (selectedBefore && selectedAfter ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-around gap-3 rounded-md border border-outline-variant bg-surface-container-low/60 px-4 py-2.5 text-xs tabular-nums">
                  <span>
                    Cân nặng Trước:{" "}
                    <strong className="text-primary">
                      {selectedBefore.weight != null ? `${selectedBefore.weight} kg` : "—"}
                    </strong>
                  </span>
                  <ArrowRight className="size-4 text-primary" aria-hidden="true" />
                  <span>
                    Cân nặng Sau:{" "}
                    <strong className="text-change-up">
                      {selectedAfter.weight != null ? `${selectedAfter.weight} kg` : "—"}
                    </strong>
                  </span>
                  {selectedBefore.weight != null && selectedAfter.weight != null && (
                    <HrStatusBadge
                      tone={selectedAfter.weight <= selectedBefore.weight ? "success" : "warning"}
                      className="normal-case"
                    >
                      Thay đổi: {(selectedAfter.weight - selectedBefore.weight).toFixed(1)} kg
                    </HrStatusBadge>
                  )}
                  <span className="text-on-surface-variant">
                    Khoảng cách:{" "}
                    <strong>
                      {Math.max(
                        0,
                        Math.round(
                          (dateMs(selectedAfter) - dateMs(selectedBefore)) /
                            (1000 * 3600 * 24),
                        ),
                      )}{" "}
                      ngày
                    </strong>
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    {
                      photo: selectedBefore,
                      heading: "TRƯỚC (BEFORE)",
                      borderCls: "border-primary",
                      barCls: "bg-primary text-on-primary",
                    },
                    {
                      photo: selectedAfter,
                      heading: "SAU (AFTER)",
                      borderCls: "border-change-up",
                      barCls: "bg-change-up text-on-primary",
                    },
                  ].map(({ photo, heading, borderCls, barCls }) => (
                    <div
                      key={heading}
                      className={cn("overflow-hidden rounded-lg border-2 bg-slate-950", borderCls)}
                    >
                      <div
                        className={cn(
                          "flex items-center justify-between px-3 py-2 text-xs font-semibold",
                          barCls,
                        )}
                      >
                        <span>
                          {heading} · {ANGLE_LABELS[photo.angle] || photo.angle || "Khác"}
                        </span>
                        <span className="tabular-nums">
                          {dateLabel(photo.takenDate || photo.date)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setZoomPhoto(photo)}
                        className="flex h-80 w-full cursor-pointer items-center justify-center"
                        aria-label={`Phóng to ảnh ${heading}`}
                      >
                        <img
                          src={photo.photoUrl}
                          alt={heading}
                          className="size-full object-contain"
                        />
                      </button>
                      <div className="bg-surface-container-lowest px-3 py-2 text-xs text-on-surface">
                        <div>
                          <strong>Chỉ số:</strong>{" "}
                          {photo.weight != null ? `${photo.weight} kg` : "—"}
                          {photo.bodyFat != null ? ` · ${photo.bodyFat}% Mỡ` : ""}
                        </div>
                        {photo.notes && (
                          <p className="mt-0.5 text-on-surface-variant">{photo.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-outline-variant bg-surface-container-low/40 p-8 text-center text-sm text-on-surface-variant">
                Chọn 1 ảnh Trước (Before) và 1 ảnh Sau (After) để so sánh song song.
              </div>
            ))}

          {/* VIEW 2: SPLIT SLIDER */}
          {compareViewType === "slider" &&
            (selectedBefore && selectedAfter ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-on-surface tabular-nums">
                    Kéo thanh trượt trên ảnh để đối chiếu (Trước: {Math.round(sliderPos)}% / Sau:{" "}
                    {Math.round(100 - sliderPos)}%)
                  </span>
                  <input
                    type="range"
                    aria-label="Tỷ lệ thanh trượt so sánh Before After"
                    min={0}
                    max={100}
                    value={sliderPos}
                    onChange={(e) => setSliderPos(Number(e.target.value))}
                    className="w-48 cursor-pointer"
                  />
                </div>
                <div
                  ref={sliderContainerRef}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsDraggingSlider(true);
                    handleSliderMove(e.clientX);
                  }}
                  onTouchStart={(e) => {
                    setIsDraggingSlider(true);
                    if (e.touches[0]) handleSliderMove(e.touches[0].clientX);
                  }}
                  className={cn(
                    "relative h-[460px] w-full cursor-ew-resize select-none overflow-hidden rounded-lg border-2 bg-slate-950 touch-none",
                    isDraggingSlider ? "border-primary" : "border-outline-variant",
                  )}
                >
                  <img
                    src={selectedAfter.photoUrl}
                    alt="Ảnh Sau"
                    draggable={false}
                    className="pointer-events-none absolute inset-0 size-full object-contain"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 overflow-hidden"
                    style={{
                      clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`,
                    }}
                  >
                    <img
                      src={selectedBefore.photoUrl}
                      alt="Ảnh Trước"
                      draggable={false}
                      className="pointer-events-none size-full object-contain"
                    />
                  </div>
                  <div
                    className="pointer-events-none absolute bottom-0 top-0 w-1 -translate-x-1/2 bg-white shadow-md"
                    style={{ left: `${sliderPos}%` }}
                  >
                    <div className="absolute left-1/2 top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-primary bg-white text-sm font-bold text-primary shadow-md">
                      ⇄
                    </div>
                  </div>
                  <span className="absolute left-3 top-3 rounded bg-primary/90 px-2.5 py-1 text-xs font-semibold text-on-primary">
                    TRƯỚC ({dateLabel(selectedBefore.takenDate || selectedBefore.date)})
                  </span>
                  <span className="absolute right-3 top-3 rounded bg-change-up/90 px-2.5 py-1 text-xs font-semibold text-on-primary">
                    SAU ({dateLabel(selectedAfter.takenDate || selectedAfter.date)})
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-outline-variant bg-surface-container-low/40 p-8 text-center text-sm text-on-surface-variant">
                Vui lòng chọn ít nhất 2 ảnh để dùng thanh trượt lồng nhau.
              </div>
            ))}

          {/* VIEW 3: MULTI-ANGLE 360° */}
          {compareViewType === "multiAngle" && (
            <div className="space-y-3">
              <p className="rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-on-surface">
                <strong>Bảng so sánh 360° đa góc độ:</strong> Đối chiếu nhanh 3 góc Chính diện, Nghiêng và Phía sau giữa mốc đầu tiên và hiện tại.
              </p>
              <div className="grid gap-3 lg:grid-cols-3">
                {multiAnglePairs.map((pair) => (
                  <div
                    key={pair.angle}
                    className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest"
                  >
                    <div className="flex items-center justify-between bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface">
                      <span>Góc {pair.title}</span>
                      <span className="text-on-surface-variant">({pair.totalCount} ảnh)</span>
                    </div>
                    {pair.before && pair.after ? (
                      <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-2">
                        {[
                          { photo: pair.before, label: "Trước", cls: "bg-primary text-on-primary" },
                          { photo: pair.after, label: "Sau", cls: "bg-change-up text-on-primary" },
                        ].map(({ photo, label, cls }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => setZoomPhoto(photo)}
                            className="relative h-52 cursor-pointer overflow-hidden rounded"
                          >
                            <img
                              src={photo.photoUrl}
                              alt={`${pair.title} ${label}`}
                              className="size-full object-cover"
                            />
                            <span
                              className={cn(
                                "absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                                cls,
                              )}
                            >
                              {label}: {dateLabel(photo.takenDate || photo.date)}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="px-3 py-8 text-center text-xs text-on-surface-variant">
                        Chưa đủ 2 ảnh Trước và Sau cho góc {pair.title}.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW 4: TIMELINE */}
          {compareViewType === "timeline" && (
            <div className="space-y-3">
              <p className="rounded-md border border-outline-variant bg-surface-container-low/50 px-3 py-2 text-xs text-on-surface">
                <strong>Dòng tiến trình thời gian ({sortedTimeline.length} cột mốc):</strong> Toàn bộ ảnh sắp xếp theo trình tự thời gian.
              </p>
              {sortedTimeline.length === 0 ? (
                <GymEmptyState kind="task" title="Chưa có ảnh trong dòng thời gian." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {sortedTimeline.map((item, idx) => {
                    const st = STAGE_META[item.stage] || STAGE_META.PROGRESS;
                    return (
                      <article
                        key={item._id || idx}
                        className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest"
                      >
                        <button
                          type="button"
                          onClick={() => setZoomPhoto(item)}
                          className="relative block h-44 w-full cursor-pointer bg-slate-950"
                        >
                          <img
                            src={item.photoUrl}
                            alt={`Mốc ${idx + 1}`}
                            className="size-full object-cover"
                          />
                          <span className="absolute left-1.5 top-1.5">
                            <HrStatusBadge tone={st.tone}>
                              #{idx + 1} · {st.short}
                            </HrStatusBadge>
                          </span>
                        </button>
                        <div className="space-y-0.5 p-2.5 text-xs text-on-surface-variant tabular-nums">
                          <p className="font-semibold text-on-surface">
                            {dateLabel(item.takenDate || item.date)}
                          </p>
                          <p>Góc: {ANGLE_LABELS[item.angle] || item.angle || "Khác"}</p>
                          {item.weight != null && (
                            <p>
                              Cân nặng: <strong className="text-on-surface">{item.weight} kg</strong>
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit single photo modal */}
      {editing && (
        <PhotoEditModal
          record={editing}
          busy={busy}
          error={error}
          onClose={() => {
            setEditing(null);
            setError("");
          }}
          onSave={async (patch) => {
            setBusy(true);
            setError("");
            try {
              await api.save(
                "progress-photos",
                {
                  customerId,
                  photoUrl: editing.photoUrl,
                  ...patch,
                },
                editing,
              );
              setEditing(null);
              reload();
            } catch (cause) {
              setError(messageOf(cause));
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {/* Fullscreen Zoom Modal */}
      {zoomPhoto && (
        <ErpModal
          native
          title={`Ảnh tiến độ · ${dateLabel(zoomPhoto.takenDate || zoomPhoto.date)}`}
          onClose={() => setZoomPhoto(null)}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-2">
            <div className="overflow-hidden rounded-md bg-slate-950">
              <img
                src={zoomPhoto.photoUrl}
                alt="Phóng to ảnh tiến độ"
                className="max-h-[72dvh] w-full object-contain"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
              <span>
                {STAGE_META[zoomPhoto.stage]?.label || zoomPhoto.stage} · Góc{" "}
                {ANGLE_LABELS[zoomPhoto.angle] || zoomPhoto.angle || "Khác"}
              </span>
              <span className="tabular-nums">
                {zoomPhoto.weight != null ? `${zoomPhoto.weight} kg` : ""}
                {zoomPhoto.bodyFat != null ? ` · ${zoomPhoto.bodyFat}% Mỡ` : ""}
              </span>
            </div>
            {zoomPhoto.notes && (
              <p className="text-xs text-on-surface">{zoomPhoto.notes}</p>
            )}
          </div>
        </ErpModal>
      )}

      <ConfirmDialog
        native
        appearance="erp"
        isOpen={Boolean(deleting)}
        title="Xóa ảnh tiến độ?"
        description="Ảnh đã xóa không thể khôi phục."
        confirmLabel="Xóa ảnh"
        isSubmitting={busy}
        error={error}
        onClose={() => {
          if (!busy) setDeleting(null);
        }}
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          setError("");
          try {
            await api.remove("progress-photos", deleting);
            setDeleting(null);
            reload();
          } catch (cause) {
            setError(messageOf(cause));
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

function PhotoEditModal({
  record,
  busy,
  error,
  onClose,
  onSave,
}: {
  record: GymRecord;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (value: Record<string, unknown>) => Promise<void>;
}) {
  const [takenDate, setTakenDate] = useState(
    String(record.takenDate || new Date().toISOString()).slice(0, 10),
  );
  const [stage, setStage] = useState(record.stage || "PROGRESS");
  const [angle, setAngle] = useState(record.angle || "FRONT");
  const [weight, setWeight] = useState<number | "">(record.weight ?? "");
  const [bodyFat, setBodyFat] = useState<number | "">(record.bodyFat ?? "");
  const [notes, setNotes] = useState(record.notes || "");

  return (
    <ErpModal
      native
      title="Sửa thông tin ảnh tiến độ"
      onClose={onClose}
      closeDisabled={busy}
      maxWidth="max-w-lg"
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave({
            takenDate,
            stage,
            angle,
            weight: weight === "" ? null : Number(weight),
            bodyFat: bodyFat === "" ? null : Number(bodyFat),
            notes,
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ngày chụp" type="date" required value={takenDate} onChange={setTakenDate} disabled={busy} />
          <Field
            label="Giai đoạn"
            value={stage}
            onChange={setStage}
            disabled={busy}
            options={[
              ["BEFORE", "Trước khi tập (Before)"],
              ["PROGRESS", "Tiến độ định kỳ"],
              ["AFTER", "Sau khi tập (After)"],
            ]}
          />
          <Field
            label="Góc chụp"
            value={angle}
            onChange={setAngle}
            disabled={busy}
            options={[
              ["FRONT", "Chính diện"],
              ["SIDE", "Nghiêng"],
              ["BACK", "Phía sau"],
              ["OTHER", "Khác"],
            ]}
          />
          <Field label="Cân nặng (kg)" type="number" min={0} value={weight} onChange={setWeight} disabled={busy} />
          <Field label="Mỡ cơ thể (%)" type="number" min={0} max={100} value={bodyFat} onChange={setBodyFat} disabled={busy} />
        </div>
        <Field label="Ghi chú" multiline value={notes} onChange={setNotes} disabled={busy} />
        <Feedback error={error} />
        <div className="flex justify-end gap-2 border-t border-outline-variant pt-3">
          <button type="button" className={secondary} onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button type="submit" className={cn(primary, "min-h-9")} disabled={busy}>
            {busy ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </ErpModal>
  );
}

export default function CustomerPhotoManager({
  api,
  customer,
  canWrite,
  onClose,
  onChanged,
}: {
  api: GymApi;
  customer: GymRecord;
  canWrite: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  return (
    <ErpModal
      native
      title={`Ảnh Before / After: ${customer.fullName || "Học viên"}`}
      onClose={onClose}
      maxWidth="max-w-5xl"
    >
      <div className="max-h-[78dvh] overflow-y-auto pr-1">
        <CustomerPhotoContent
          api={api}
          customerId={customer._id}
          customerName={customer.fullName}
          canWrite={canWrite}
          onChanged={onChanged}
        />
      </div>
    </ErpModal>
  );
}

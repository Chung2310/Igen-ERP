import { useMemo, useRef, useState } from "react";
import { Eye, FileText, Image as ImageIcon, Pencil, RefreshCw, Search, Sparkles, Trash2, Upload, UploadCloud } from "lucide-react";
import { ErpModal } from "../../components/common/ErpModal";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { ErpRefreshButton } from "../../components/common/ErpRefreshButton";
import { TablePagination } from "../../components/common/TablePagination";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import type { GymList, GymRecord } from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import { forms, initialForm } from "./forms";
import {
  Field,
  Feedback,
  FormDialog,
  GymEmptyState,
  messageOf,
  primary,
  secondary,
  useGymQuery,
} from "./ui";
import RecordsPage from "./RecordsPage";

const foodCategoryOptions = forms["food-images"]![1].options!;
const foodCategoryLabel = Object.fromEntries(foodCategoryOptions);
const foodCategoryTones = ["green", "orange", "red", "teal", "violet", "pink", "indigo", "blue"] as const;

export default function KnowledgePage({
  api,
  admin,
  canWrite,
}: {
  api: GymApi;
  admin: boolean;
  canWrite: boolean;
}) {
  const [tab, setTab] = useState<"images" | "docs">("images");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(16);
  const [refresh, setRefresh] = useState(0);
  const [modal, setModal] = useState<"upload" | "generate" | "document" | GymRecord>();
  const [preview, setPreview] = useState<GymRecord>();
  const [deleting, setDeleting] = useState<GymRecord>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const query = new URLSearchParams({
    search,
    source,
    category,
    page: String(page),
    limit: String(limit),
  });
  const images = useGymQuery<GymList>(api, `/food-images?${query}`, refresh);
  const allImagesQuery = useGymQuery<GymList>(api, "/food-images?limit=200", refresh);

  const stats = useMemo(() => {
    const all = allImagesQuery.data?.data || [];
    const total = allImagesQuery.data?.meta.total ?? all.length;
    const aiCount = all.filter(item => item.source === "AI").length;
    const uploadCount = all.filter(item => item.source !== "AI").length;
    return { total, aiCount, uploadCount };
  }, [allImagesQuery.data]);

  return (
    <section className="flex min-h-full flex-1 flex-col gap-3" aria-label="Kho tri thức">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant">
        <nav aria-label="Kho tri thức" className="flex gap-1 overflow-x-auto">
          {([
            ["images", `Kho ảnh món ăn (${stats.total})`, ImageIcon],
            ["docs", "Kho tri thức", FileText],
          ] as const).map(([key, label, Icon]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setTab(key)}
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
          {tab === "images" && (
            <ErpRefreshButton loading={images.loading} onClick={() => setRefresh(r => r + 1)} />
          )}
          {tab === "docs" && admin && canWrite && (
            <>
              <button
                type="button"
                className={secondary}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await api.request("/knowledge/seed-standard", "POST");
                    setRefresh(r => r + 1);
                  } catch (e) {
                    setError(messageOf(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                {busy ? "Đang nạp..." : "Nạp tri thức chuẩn"}
              </button>
              <button type="button" className={secondary} onClick={() => setModal("document")}>
                <Upload className="size-3.5" aria-hidden="true" />
                Tải file tri thức
              </button>
            </>
          )}
        </div>
      </div>

      {tab === "docs" ? (
        <div className="flex flex-1 flex-col gap-3">
          <KnowledgeRagSearchBar api={api} />
          <RecordsPage
            key={refresh}
            api={api}
            entity="knowledge"
            admin={admin}
            canWrite={admin && canWrite}
            embedded
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: "Tổng ảnh món", value: String(stats.total), icon: ImageIcon, tone: "gym-kpi-icon--primary", valueClass: "text-on-surface" },
              { label: "AI tạo", value: String(stats.aiCount), icon: Sparkles, tone: "gym-kpi-icon--violet", valueClass: "text-primary" },
              { label: "Tải lên", value: String(stats.uploadCount), icon: UploadCloud, tone: "gym-kpi-icon--success", valueClass: "text-change-up" },
            ].map(({ label, value, icon: Icon, tone, valueClass }) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 rounded-md border border-outline-variant bg-surface-container-lowest px-4 py-3 shadow-2xs"
              >
                <div className="min-w-0 space-y-1">
                  <dt className="truncate text-xs text-on-surface-variant">{label}</dt>
                  <dd className={cn("text-xl font-semibold tabular-nums", valueClass)}>{value}</dd>
                </div>
                <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-md", tone)} aria-hidden="true">
                  <Icon className="size-4" />
                </span>
              </div>
            ))}
          </dl>

          <div className="space-y-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex min-w-[220px] flex-1 flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1 max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant/60" aria-hidden="true" />
                  <input
                    type="text"
                    aria-label="Tìm món ăn"
                    placeholder="Tìm theo tên món..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    className="h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-xs text-on-surface placeholder:text-on-surface-variant/60 outline-none transition focus:border-primary"
                  />
                </div>
                <div className="inline-flex rounded-md border border-outline-variant bg-surface-container-low/50 p-0.5">
                  {([
                    ["", "Tất cả"],
                    ["AI", "AI tạo"],
                    ["UPLOAD", "Tải lên"],
                  ] as const).map(([val, label]) => (
                    <button
                      key={val || "all"}
                      type="button"
                      aria-pressed={source === val}
                      onClick={() => { setSource(val); setPage(1); }}
                      className={cn(
                        "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                        source === val
                          ? "bg-primary text-on-primary shadow-2xs"
                          : "text-on-surface-variant hover:text-on-surface",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {canWrite && (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className={secondary} onClick={() => setModal("upload")}>
                    <UploadCloud className="size-3.5 text-change-up" aria-hidden="true" />
                    Tải ảnh lên
                  </button>
                  <button type="button" className={cn(primary, "min-h-9")} onClick={() => setModal("generate")}>
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    Tạo ảnh AI
                  </button>
                </div>
              )}
            </div>

            {/* Category Filter Pills matching 3S-Gym */}
            <div className="flex flex-wrap gap-1.5 border-t border-outline-variant/60 pt-2.5">
              <button
                type="button"
                aria-pressed={!category}
                onClick={() => { setCategory(""); setPage(1); }}
                className="gym-choice-label gym-choice-label--blue"
              >
                Tất cả nhóm
              </button>
              {foodCategoryOptions.map(([val, label], index) => (
                <button
                  key={val}
                  type="button"
                  aria-pressed={category === val}
                  onClick={() => { setCategory(val); setPage(1); }}
                  className={`gym-choice-label gym-choice-label--${foodCategoryTones[index % foodCategoryTones.length]}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 sm:p-4">
            <Feedback error={images.error || error} loading={images.loading} />
            {!images.loading && !images.error && !images.data?.data.length && (
              <GymEmptyState
                kind="training"
                filtered={Boolean(search.trim() || source || category)}
                title="Chưa có ảnh món ăn."
              />
            )}
            {(images.data?.data.length ?? 0) > 0 && (
              <div className="flex-1">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {images.data?.data.map((item) => (
                <article key={item._id} className="flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-2xs transition-colors hover:border-primary/40">
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-container-low/60">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-200 hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full flex-col items-center justify-center gap-1 text-xs text-on-surface-variant/60">
                        <ImageIcon className="size-6" aria-hidden="true" />
                        <span>Không có ảnh</span>
                      </div>
                    )}
                    {item.source && (
                      <span className="absolute left-2 top-2">
                        <HrStatusBadge tone={item.source === "AI" ? "violet" : "success"} className="normal-case">
                          {item.source === "AI" ? "AI Tạo" : "Tải Lên"}
                        </HrStatusBadge>
                      </span>
                    )}
                    <div className="absolute right-2 top-2 flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Xem ảnh ${item.name}`}
                        title="Xem ảnh"
                        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-outline-variant bg-surface-container-lowest/90 text-on-surface-variant shadow-2xs hover:text-primary"
                        onClick={() => setPreview(item)}
                      >
                        <Eye className="size-3.5" aria-hidden="true" />
                      </button>
                      {admin && canWrite && (
                        <>
                          <button
                            type="button"
                            aria-label={`Sửa ${item.name}`}
                            title="Sửa"
                            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-outline-variant bg-surface-container-lowest/90 text-on-surface-variant shadow-2xs hover:text-primary"
                            onClick={() => setModal(item)}
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Xóa ${item.name}`}
                            title="Xóa"
                            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-error/40 bg-error text-on-error shadow-2xs hover:bg-error/90"
                            onClick={() => {
                              setError("");
                              setDeleting(item);
                            }}
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col justify-between space-y-2 p-3">
                    <div className="space-y-1.5">
                      <h3 className="truncate text-sm font-semibold text-on-surface" title={item.name}>{item.name}</h3>
                      {item.category && (
                        <span className="inline-block rounded bg-surface-container px-2 py-0.5 text-[11px] text-on-surface-variant">
                          {foodCategoryLabel[item.category] || item.category}
                        </span>
                      )}
                      {(item.calories != null || item.protein != null || item.carbs != null || item.fat != null) && (
                        <div className="flex flex-wrap gap-1 pt-0.5 text-[11px] tabular-nums text-on-surface-variant">
                          {item.calories != null && <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">{item.calories} kcal</span>}
                          {item.protein != null && <span className="rounded bg-surface-container-low px-1.5 py-0.5">P {item.protein}g</span>}
                          {item.carbs != null && <span className="rounded bg-surface-container-low px-1.5 py-0.5">C {item.carbs}g</span>}
                          {item.fat != null && <span className="rounded bg-surface-container-low px-1.5 py-0.5">F {item.fat}g</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
                </div>
              </div>
            )}
            {images.data && (
              <TablePagination
                appearance="erp"
                currentPage={page}
                totalPages={images.data.meta.totalPages}
                totalItems={images.data.meta.total}
                pageSize={limit}
                onPageChange={setPage}
                onPageSizeChange={(value) => {
                  setLimit(value);
                  setPage(1);
                }}
                pageSizeOptions={[12, 16, 24, 48]}
                itemLabel="ảnh món"
              />
            )}
          </div>
        </div>
      )}

      {modal && (
        <MediaForm
          api={api}
          mode={modal}
          onClose={() => setModal(undefined)}
          onSaved={() => {
            setModal(undefined);
            setRefresh((r) => r + 1);
          }}
        />
      )}

      {preview && (
        <ErpModal
          native
          title={preview.name}
          onClose={() => setPreview(undefined)}
          maxWidth="max-w-3xl"
        >
          {preview.imageUrl ? (
            <img
              src={preview.imageUrl}
              alt={preview.name}
              className="max-h-96 w-full object-contain"
            />
          ) : (
            <p className="py-8 text-center text-sm text-on-surface-variant">Món ăn chưa có ảnh.</p>
          )}
        </ErpModal>
      )}

      <ConfirmDialog
        native
        appearance="erp"
        isOpen={Boolean(deleting)}
        title="Xóa ảnh món ăn?"
        description={`Bạn có chắc muốn xóa ảnh món "${deleting?.name || ""}" khỏi kho? Ảnh đã xóa không thể khôi phục.`}
        confirmLabel="Xóa ảnh"
        error={error}
        isSubmitting={busy}
        onClose={() => {
          if (!busy) setDeleting(undefined);
        }}
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          try {
            await api.remove("food-images", deleting);
            setDeleting(undefined);
            setRefresh((r) => r + 1);
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

function MediaForm({
  api,
  mode,
  onClose,
  onSaved,
}: {
  api: GymApi;
  mode: string | GymRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const record = typeof mode === "object" ? mode : undefined;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Record<string, any>>(() => ({
    ...initialForm("food-images", record),
    prompt:
      record?.prompt ||
      record?.cookingNote ||
      (record?.name
        ? `Tạo một ảnh chụp món ăn chân thực để minh họa thực đơn dinh dưỡng: ${record.name}. Thể hiện chính xác món ăn, nguyên liệu và cách chế biến.`
        : ""),
  }));
  const [imageMode, setImageMode] = useState<"KEEP" | "UPLOAD">("KEEP");
  const [file, setFile] = useState<File>();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hasImgError, setHasImgError] = useState(false);
  const [regeneratingAi, setRegeneratingAi] = useState(false);
  const [actionError, setActionError] = useState("");
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [topic, setTopic] = useState("Chung");
  const [dirty, setDirty] = useState(false);

  const title =
    mode === "document"
      ? "Tải tài liệu"
      : mode === "generate"
        ? "Tạo Ảnh Món Ăn Bằng AI (Lưu Kho)"
        : record
          ? "Chỉnh Sửa Thông Tin Món Ăn"
          : "Tải Ảnh Lên Kho Món Ăn";

  const submitLabel =
    mode === "upload"
      ? "Lưu Vào Kho Ảnh"
      : mode === "generate"
        ? "Bắt Đầu Tạo & Lưu Kho"
        : mode === "document"
          ? "Tải lên"
          : "Lưu Mọi Thay Đổi";

  const handleRegenerateAi = async () => {
    if (!record || regeneratingAi) return;
    setRegeneratingAi(true);
    setActionError("");
    try {
      const updated = await api.request<GymRecord>(
        `/food-images/${record._id}/regenerate-ai`,
        "POST",
        { prompt: String(form.prompt || "").trim() || undefined },
      );
      if (updated?.imageUrl) {
        setPreviewUrl(updated.imageUrl);
        setHasImgError(false);
      }
      onSaved();
    } catch (cause) {
      setActionError(messageOf(cause));
    } finally {
      setRegeneratingAi(false);
    }
  };

  return (
    <FormDialog
      title={title}
      submitLabel={submitLabel}
      maxWidth="max-w-xl"
      dirty={dirty}
      onClose={onClose}
      onSubmit={async () => {
        if (record) {
          if (imageMode === "UPLOAD" && file) {
            const data = new FormData();
            data.append("file", file);
            data.append("name", String(form.name || "").trim());
            data.append("category", String(form.category || "OTHER"));
            if (form.prompt) data.append("prompt", String(form.prompt).trim());
            if (form.calories !== "" && form.calories != null)
              data.append("calories", String(form.calories));
            if (form.protein !== "" && form.protein != null)
              data.append("protein", String(form.protein));
            if (form.carbs !== "" && form.carbs != null)
              data.append("carbs", String(form.carbs));
            if (form.fat !== "" && form.fat != null)
              data.append("fat", String(form.fat));
            await api.request(`/food-images/${record._id}/upload`, "POST", data);
          } else {
            await api.save(
              "food-images",
              {
                name: String(form.name || "").trim(),
                category: form.category || "OTHER",
                prompt: String(form.prompt || "").trim(),
                cookingNote: String(form.prompt || "").trim(),
                calories:
                  form.calories !== "" && form.calories != null
                    ? Number(form.calories)
                    : null,
                protein:
                  form.protein !== "" && form.protein != null
                    ? Number(form.protein)
                    : null,
                carbs:
                  form.carbs !== "" && form.carbs != null
                    ? Number(form.carbs)
                    : null,
                fat:
                  form.fat !== "" && form.fat != null ? Number(form.fat) : null,
                source: record.source || "AI",
                imageUrl: previewUrl || record.imageUrl || null,
                keywords: record.keywords || [],
              },
              record,
            );
          }
        } else if (mode === "generate") {
          await api.request("/food-images/generate", "POST", form);
        } else {
          if (mode === "document") {
            if (!docFiles.length)
              throw new Error("Vui lòng chọn ít nhất 1 tài liệu để tải lên.");
            const data = new FormData();
            for (const f of docFiles) data.append("file", f);
            data.append("topic", topic);
            await api.request("/knowledge/upload", "POST", data);
          } else {
            if (!file)
              throw new Error("Vui lòng chọn file ảnh để tải lên.");
            const data = new FormData();
            data.append("file", file);
            for (const [key, value] of Object.entries(form))
              if (value !== "" && value != null) data.append(key, String(value));
            await api.request("/food-images/upload", "POST", data);
          }
        }
        onSaved();
      }}
    >
      {mode === "document" ? (
        <Field
          label="Chủ đề"
          value={topic}
          onChange={(value) => {
            setTopic(value);
            setDirty(true);
          }}
        />
      ) : mode === "generate" ? (
        <div className="space-y-3">
          <Field
            label="Tên món ăn (Bắt buộc)"
            required
            placeholder="Ví dụ: Bò xào cần tây, Canh cải cá rô, Tôm nướng tiêu..."
            value={form.name}
            onChange={(value) => {
              setForm({ ...form, name: value });
              setDirty(true);
            }}
          />
          <Field
            label="Gợi ý phong cách hình ảnh (Tùy chọn)"
            multiline
            placeholder="Để trống để hệ thống tự động tạo ảnh ẩm thực dinh dưỡng..."
            value={form.prompt || ""}
            onChange={(value) => {
              setForm({ ...form, prompt: value });
              setDirty(true);
            }}
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3.5">
          {/* 3S FoodImageEditModal Image Adjustment Box */}
          {record && (
            <div className="rounded-xl border border-outline-variant bg-surface-container-low/50 p-3.5">
              <div className="flex flex-wrap items-start gap-3.5">
                <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-highest">
                  {(previewUrl || record.imageUrl) && !hasImgError ? (
                    <img
                      src={previewUrl || record.imageUrl}
                      alt={record.name}
                      className="size-full object-cover"
                      onError={() => setHasImgError(true)}
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center p-1 text-center text-xs text-on-surface-variant">
                      <span>Không có ảnh</span>
                    </div>
                  )}
                  <span className="absolute bottom-1 left-1 rounded bg-surface-container-highest/90 px-1.5 py-0.5 text-[10px] font-bold text-on-surface">
                    {record.source === "AI" ? "AI" : "Tải lên"}
                  </span>
                </div>

                <div className="min-w-[200px] flex-1 space-y-2">
                  <p className="text-xs font-bold text-on-surface">
                    Hình thức điều chỉnh ảnh:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setImageMode("KEEP");
                        setFile(undefined);
                        setPreviewUrl(null);
                      }}
                      className={cn(
                        "cursor-pointer rounded border px-2.5 py-1 text-xs font-bold transition-colors",
                        imageMode === "KEEP"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container",
                      )}
                    >
                      Giữ nguyên ảnh
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImageMode("UPLOAD");
                        fileInputRef.current?.click();
                      }}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1 rounded border px-2.5 py-1 text-xs font-bold transition-colors",
                        imageMode === "UPLOAD"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container",
                      )}
                    >
                      <Upload className="size-3" aria-hidden="true" />
                      Tải ảnh mới từ máy
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={regeneratingAi}
                    onClick={() => void handleRegenerateAi()}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
                  >
                    {regeneratingAi ? (
                      <>
                        <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
                        Đang dùng AI vẽ lại ảnh...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3.5" aria-hidden="true" />
                        Tạo lại ảnh bằng AI cho món này
                      </>
                    )}
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                      const selected = event.target.files?.[0];
                      if (!selected) return;
                      setFile(selected);
                      setPreviewUrl(URL.createObjectURL(selected));
                      setHasImgError(false);
                      setImageMode("UPLOAD");
                      setDirty(true);
                    }}
                  />

                  {imageMode === "UPLOAD" && file && (
                    <p className="text-xs font-semibold text-change-up">
                      ✓ Đã chọn file: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <Feedback error={actionError} />

          <div className={cn("grid gap-3", record && "sm:grid-cols-2")}>
            <Field
              label="Tên món ăn (Bắt buộc)"
              required
              placeholder="Ví dụ: Ức gà áp chảo tiêu xanh..."
              value={form.name}
              onChange={(value) => {
                setForm({ ...form, name: value });
                setDirty(true);
              }}
            />
            <Field
              label="Nhóm thực phẩm / Danh mục"
              value={form.category}
              options={foodCategoryOptions}
              onChange={(value) => {
                setForm({ ...form, category: value });
                setDirty(true);
              }}
            />
          </div>

          <section className="space-y-2.5 rounded-xl border border-tertiary/30 bg-tertiary-container/25 p-3">
            <h3 className="text-xs font-bold text-on-surface">
              Thông tin Dinh dưỡng ước tính (Macros - Tùy chọn):
            </h3>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                ["calories", "Calo (kcal):", "vd: 250"],
                ["protein", "Protein (g):", "vd: 30"],
                ["carbs", "Carbs (g):", "vd: 15"],
                ["fat", "Fat (g):", "vd: 5"],
              ].map(([key, label, placeholder]) => (
                <Field
                  key={key}
                  label={label}
                  type="number"
                  min={0}
                  placeholder={placeholder}
                  value={form[key] ?? record?.[key] ?? ""}
                  onChange={(value) => {
                    setForm({ ...form, [key]: value });
                    setDirty(true);
                  }}
                />
              ))}
            </div>
          </section>

          {record && (
            <Field
              label="Gợi ý mô tả món ăn (Tùy chọn):"
              multiline
              placeholder="Mô tả món ăn hoặc gợi ý cách chế biến..."
              value={form.prompt ?? ""}
              onChange={(value) => {
                setForm({ ...form, prompt: value });
                setDirty(true);
              }}
            />
          )}
        </div>
      )}

      {(mode === "upload" || mode === "document") && (
        <div className="space-y-1.5">
          <span className="block text-sm text-on-surface">
            {mode === "document"
              ? "Tài liệu (PDF, DOCX, TXT, Markdown)"
              : "Chọn file ảnh từ máy tính (JPG, PNG, WebP):"}
          </span>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-surface-container-low/40 px-4 py-6 text-center transition-colors hover:border-primary hover:bg-primary/5">
            <UploadCloud className="size-7 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium text-on-surface">
              {mode === "document"
                ? docFiles.length
                  ? `Đã chọn ${docFiles.length} tài liệu: ${docFiles.map(f => f.name).join(", ")}`
                  : "Chọn tối đa 10 file tài liệu từ thiết bị"
                : file
                  ? file.name
                  : "Chọn file ảnh từ thiết bị"}
            </span>
            <span className="text-xs text-on-surface-variant">
              {mode === "document" ? "Hỗ trợ PDF, DOCX, TXT, Markdown (tối đa 10 file)" : "Hỗ trợ JPG, PNG, WebP tối đa 10MB"}
            </span>
            <input
              required
              type="file"
              multiple={mode === "document"}
              className="sr-only"
              accept={
                mode === "document"
                  ? ".pdf,.docx,.txt,.md,.markdown"
                  : "image/jpeg,image/png,image/webp"
              }
              onChange={(event) => {
                if (mode === "document") {
                  setDocFiles(Array.from(event.target.files || []).slice(0, 10));
                } else {
                  setFile(event.target.files?.[0]);
                }
                setDirty(true);
              }}
            />
          </label>
        </div>
      )}
    </FormDialog>
  );
}

function KnowledgeRagSearchBar({ api }: { api: GymApi }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Array<{ documentId: string; title?: string; topic: string; content: string; score: number }>>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const res = await api.request<Array<{ documentId: string; title?: string; topic: string; content: string; score: number }>>(
        `/knowledge/search?q=${encodeURIComponent(query.trim())}&limit=5`,
        "GET",
      );
      setHits(Array.isArray(res) ? res : []);
      setSearched(true);
    } catch (cause) {
      setErr(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-2.5 rounded-md border border-outline-variant bg-surface-container-lowest p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-on-surface">
            Tra cứu thử Kho tri thức (RAG cho Trợ lý AI)
          </h3>
          <p className="text-xs text-on-surface-variant">
            Kiểm tra các đoạn tài liệu đã xuất bản sẽ được Trợ lý AI trích dẫn khi trả lời câu hỏi chuyên môn.
          </p>
        </div>
      </div>
      <form onSubmit={runSearch} className="flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant/60" aria-hidden="true" />
          <input
            type="text"
            aria-label="Tra cứu thử trong kho tri thức"
            placeholder="VD: Ngưỡng % mỡ lý tưởng hoặc nguyên tắc thâm hụt calo..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-xs text-on-surface focus:border-primary focus:outline-none"
          />
        </div>
        <button type="submit" disabled={busy || !query.trim()} className={cn(primary, "min-h-9")}>
          <Sparkles className="size-3.5" aria-hidden="true" />
          {busy ? "Đang truy xuất..." : "Tra cứu RAG"}
        </button>
      </form>
      <Feedback error={err} />
      {searched && (
        <div className="space-y-2 pt-1">
          {hits.length === 0 ? (
            <p className="text-xs text-on-surface-variant">
              Không tìm thấy đoạn tài liệu đã xuất bản phù hợp. Hãy kiểm tra tài liệu đã được bấm Công bố chưa.
            </p>
          ) : (
            hits.map((hit, idx) => (
              <article
                key={`${hit.documentId}-${idx}`}
                className="rounded-md border border-outline-variant bg-surface-container-low/50 p-2.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-on-surface">{hit.title || "Tài liệu tri thức"}</strong>
                  <div className="flex items-center gap-1.5">
                    <HrStatusBadge tone="info" className="normal-case">{hit.topic}</HrStatusBadge>
                    <span className="tabular-nums text-[11px] font-semibold text-primary">
                      Độ khớp {Math.min(100, Math.round(hit.score * 100))}%
                    </span>
                  </div>
                </div>
                <p className="mt-1 whitespace-pre-line text-on-surface-variant">{hit.content}</p>
              </article>
            ))
          )}
        </div>
      )}
    </section>
  );
}

import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { ChevronRight, Download, LoaderCircle, Plus, X } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import { requestStudioImageEdit, type StudioEditMode } from "./assistantStudioImageApi";
import { getAssistantSpeechHistoryUserId } from "../../services/assistantSpeechHistory";
import { listAssistantStudioCreationHistory, saveAssistantStudioCreationHistory, type AssistantStudioCreationRecord } from "../../services/assistantStudioHistory";
import { AssistantStudioBreadcrumb } from "./AssistantStudioBreadcrumb";
import { Assistant2DFileIcon } from "./Assistant2DFileIcon";
import { AssistantStudioHistoryAction, AssistantStudioHistoryDrawer, AssistantStudioHistoryKindIcon } from "./AssistantStudioHistoryDrawer";
import { assistantStudioTitleAccentClass, assistantStudioTitleClass } from "./assistantStudioTitleStyles";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const fieldClass = "w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none";
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

interface EditType {
  id: StudioEditMode;
  label: string;
  description: string;
  hint: string;
  prompt?: string;
  requiresDetails?: boolean;
  detailsHint?: string;
  artwork: string;
}

const editTypes: EditType[] = [
  {
    id: "erase",
    label: "Xóa vùng ảnh",
    description: "Xóa một phần ảnh và tái tạo tự nhiên",
    hint: "Ví dụ: Xóa chiếc cốc trên bàn và lấp phần trống theo mặt bàn xung quanh.",
    prompt: "Xóa đúng đối tượng được mô tả ở cuối prompt khỏi ảnh gốc. Chỉ xóa đối tượng đó; tái tạo tự nhiên vùng bị che, khớp kết cấu, màu sắc, ánh sáng và phối cảnh xung quanh. Giữ nguyên hoàn toàn các phần còn lại.\n\nĐối tượng/vùng cần xóa: ",
    requiresDetails: true,
    detailsHint: "Thêm mô tả vật thể hoặc vùng cần xóa ở cuối prompt mẫu.",
    artwork: "/ai-studio-edit-erase.webp",
  },
  {
    id: "remove-background",
    label: "Xóa nền",
    description: "Tách chủ thể ra khỏi nền ảnh",
    hint: "Ví dụ: Tách người khỏi nền, giữ nguyên tóc và đường viền tự nhiên.",
    prompt: "Tách toàn bộ phông nền khỏi ảnh gốc để chỉ còn chủ thể. Giữ nguyên khuôn mặt, tóc, quần áo, hình dáng, màu sắc và các chi tiết của chủ thể. Xuất tệp PNG có kênh alpha trong suốt thật; làm trong suốt mọi pixel thuộc nền. Không thay nền bằng màu trắng hoặc màu khác, không vẽ ô caro giả, không thêm viền, bóng đổ hay vật thể mới.",
    artwork: "/ai-studio-edit-remove-background.webp",
  },
  {
    id: "change-background",
    label: "Đổi nền",
    description: "Thay nền bằng màu hoặc cảnh mới",
    hint: "Ví dụ: Đổi nền phía sau thành màu xanh nhạt, giữ nguyên người ở phía trước.",
    prompt: "Thay nền hiện tại bằng bối cảnh được mô tả ở cuối prompt. Chỉ chỉnh nền; giữ nguyên chủ thể, khuôn mặt, tóc, quần áo, tư thế, tỷ lệ và các chi tiết nhận diện. Khớp ánh sáng và phối cảnh giữa chủ thể với nền mới; không thêm chủ thể hoặc vật thể khác.\n\nNền mới: ",
    requiresDetails: true,
    detailsHint: "Mô tả màu sắc hoặc cảnh nền muốn thay vào ở cuối prompt mẫu.",
    artwork: "/ai-studio-edit-change-background.webp",
  },
  {
    id: "enhance",
    label: "Nâng cao chất lượng",
    description: "Làm nét, giảm nhiễu và cải thiện chi tiết",
    hint: "Ví dụ: Làm ảnh rõ nét hơn, giảm nhiễu, giữ nguyên mọi chi tiết và khuôn mặt.",
    prompt: "Cải thiện chất lượng ảnh gốc: làm rõ nét, giảm nhiễu và khôi phục chi tiết tự nhiên. Giữ nguyên nội dung, khuôn mặt, nhận diện, bố cục, màu sắc, chữ và logo. Không thêm, xóa hay thay đổi đối tượng; tránh làm mịn da hoặc tạo chi tiết giả.",
    artwork: "/ai-studio-edit-enhance.webp",
  },
];

const legacyCustomEditType: EditType = {
  id: "custom",
  label: "Tùy chỉnh (lịch sử)",
  description: "Dùng cho lịch sử chỉnh sửa cũ.",
  hint: "Nhập yêu cầu chỉnh sửa cho lịch sử này.",
  artwork: "",
};

type EditedResult = { url: string; source: string; name: string; prompt: string; mode: StudioEditMode; regionApplied: boolean };

export function AssistantStudioEdit({ onBack, historyItem }: { onBack: () => void; historyItem?: AssistantStudioCreationRecord | null }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const initialResult = historyItem?.kind === "edit-image" ? historyItem.payload as EditedResult : null;
  const [sourceImage, setSourceImage] = useState(() => initialResult?.source ?? "");
  const [fileName, setFileName] = useState(() => initialResult?.name ?? "");
  const [mode, setMode] = useState<StudioEditMode>(() => initialResult?.mode ?? "erase");
  const [prompt, setPrompt] = useState(() => initialResult?.prompt ?? "");
  const [result, setResult] = useState<EditedResult | null>(initialResult);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<AssistantStudioCreationRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const activeEditType = editTypes.find(t => t.id === mode) ?? (mode === "custom" ? legacyCustomEditType : editTypes[0]);

  async function openHistory() {
    if (showHistory) { setShowHistory(false); return; }
    setShowHistory(true);
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const records = await listAssistantStudioCreationHistory(getAssistantSpeechHistoryUserId());
      setHistory(records.filter(r => r.kind === "edit-image"));
    } catch (e) {
      setHistoryError((e as Error).message || "Không tải được lịch sử.");
    } finally {
      setHistoryLoading(false);
    }
  }

  function openHistoryItem(item: AssistantStudioCreationRecord) {
    const payload = item.payload as EditedResult;
    setSourceImage(payload.source);
    setFileName(payload.name);
    setPrompt(item.prompt);
    setMode(payload.mode);
    setResult(payload);
    setShowHistory(false);
  }

  async function loadFile(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > MAX_FILE_BYTES) {
      setError("Chọn ảnh JPG, PNG hoặc WebP không quá 15 MB.");
      return;
    }
    try {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Không thể đọc tệp ảnh."));
        reader.readAsDataURL(file);
      });
      setSourceImage(url);
      setFileName(file.name);
      setResult(null);
      setError("");
    } catch (e) { setError((e as Error).message); }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    void loadFile(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    void loadFile(event.dataTransfer.files?.[0]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (!sourceImage) { setError("Tải ảnh cần chỉnh sửa lên trước."); return; }
    if (prompt.trim().length < 3) { setError("Nhập yêu cầu chỉnh sửa ít nhất 3 ký tự."); return; }
    if (activeEditType.requiresDetails && prompt.trim() === activeEditType.prompt?.trim()) {
      setError(activeEditType.detailsHint || "Bổ sung chi tiết cần chỉnh sửa vào prompt mẫu trước khi tiếp tục.");
      promptRef.current?.focus();
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await requestStudioImageEdit({ sourceImage, prompt: prompt.trim(), mode });
      const next: EditedResult = { url: response.image.url, source: sourceImage, name: fileName, prompt: prompt.trim(), mode, regionApplied: response.regionApplied };
      setResult(next);
      try {
        await saveAssistantStudioCreationHistory({
          userId: getAssistantSpeechHistoryUserId(),
          kind: "edit-image",
          title: prompt.trim().slice(0, 100) || "Ảnh đã chỉnh sửa",
          summary: fileName ? `Ảnh gốc: ${fileName}` : activeEditType.label,
          prompt: prompt.trim(),
          payload: next,
        });
      } catch { /* ignore storage errors */ }
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  function selectEditType(editType: EditType) {
    const nextPrompt = editType.prompt ?? "";
    if (mode === editType.id && prompt.trim() && prompt !== nextPrompt) {
      setError("");
      return;
    }
    setMode(editType.id);
    setPrompt(nextPrompt);
    setResult(null);
    setError("");
    requestAnimationFrame(() => {
      promptRef.current?.focus();
      promptRef.current?.setSelectionRange(nextPrompt.length, nextPrompt.length);
    });
  }

  return (
    <div className="relative grid h-full min-h-0 min-w-0 overflow-hidden lg:h-[calc(100dvh-4rem)] lg:max-h-[calc(100dvh-4rem)] lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]">
      <div className="absolute right-4 top-3 z-10 sm:right-5 lg:right-6">
        <AssistantStudioHistoryAction open={showHistory} onClick={() => void openHistory()} />
      </div>

      {/* ── Left panel: controls ── */}
      <form
        onSubmit={submit}
        className="flex h-full min-h-0 min-w-0 shrink-0 flex-col border-b border-outline-variant bg-surface-container-lowest lg:border-b-0 lg:border-r"
        aria-label="Thiết lập chỉnh sửa hình ảnh"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 sm:p-5">
          <div className="mb-1">
            <AssistantStudioBreadcrumb title="Chỉnh sửa hình ảnh" onBack={onBack} />
          </div>

          {/* Model */}
          <div>
            <span className="mb-1 block text-sm font-medium">Mô hình</span>
            <div
              className="flex h-10 items-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2 text-sm text-on-surface"
              aria-label="Mô hình iGenAI"
            >
              <img src="/igenai.png" alt="" aria-hidden="true" className="size-8 shrink-0 object-contain" />
              iGenAI
            </div>
          </div>

          {/* Source image upload */}
          <div>
            <span className="mb-1 block text-sm font-medium">
              Ảnh cần chỉnh sửa <span className="font-normal text-on-surface-variant">(bắt buộc)</span>
            </span>
            {sourceImage ? (
              <div className="flex items-center gap-2 rounded-lg border border-outline-variant p-1">
                <img src={sourceImage} alt="Ảnh đã chọn" className="size-10 rounded-md object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm">{fileName}</span>
                <button
                  type="button"
                  onClick={() => { setSourceImage(""); setFileName(""); setResult(null); setError(""); }}
                  aria-label="Xóa ảnh đã chọn"
                  disabled={loading}
                  className={cn("rounded-md p-2 hover:bg-surface-container-low", focusClass)}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <label
                onDragOver={e => e.preventDefault()}
                onDrop={onDrop}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-4 py-6 text-center transition-colors hover:border-primary hover:bg-surface-container",
                  focusClass
                )}
              >
                <Assistant2DFileIcon fileName="image.png" action="upload" className="size-20 shrink-0" />
                <span className="text-sm font-medium text-on-surface">Tải ảnh lên</span>
                <span className="text-xs text-on-surface-variant">PNG, JPG, WebP · tối đa 15 MB</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={onFileChange}
                  disabled={loading}
                  className="sr-only"
                  aria-label="Chọn ảnh cần chỉnh sửa"
                />
              </label>
            )}
          </div>

          {/* Edit description */}
          <div>
            <label htmlFor="studio-edit-prompt" className="mb-1 block text-sm font-medium">
              Yêu cầu chỉnh sửa
            </label>
            <textarea
              id="studio-edit-prompt"
              required
              minLength={3}
              maxLength={2000}
              rows={6}
              value={prompt}
              ref={promptRef}
              onChange={e => { setPrompt(e.target.value); setResult(null); setError(""); }}
              disabled={loading}
              placeholder={activeEditType.hint}
              aria-describedby="studio-edit-prompt-guidance studio-edit-prompt-count"
              className={cn(fieldClass, "min-h-32 resize-none")}
            />
            <p id="studio-edit-prompt-guidance" className="mt-1 text-pretty text-xs text-on-surface-variant">
              {activeEditType.requiresDetails && prompt.trim() === activeEditType.prompt?.trim()
                ? activeEditType.detailsHint
                : "Prompt mẫu đã điền sẵn; bạn có thể chỉnh sửa trước khi gửi."}
            </p>
            <div className="mt-1 flex justify-end text-xs text-on-surface-variant">
              <span id="studio-edit-prompt-count" className="shrink-0 tabular-nums">{prompt.length}/2.000</span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="shrink-0 border-t border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
          <button
            type="submit"
            disabled={loading || !sourceImage || prompt.trim().length < 3}
            className={cn(
              "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50",
              focusClass
            )}
          >
            {loading ? (
              <><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Đang chỉnh sửa…</>
            ) : (
              "Chỉnh sửa hình ảnh"
            )}
          </button>
          {error && (
            <p role="alert" className="mt-2 text-pretty rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error">
              {error}
            </p>
          )}
        </div>
      </form>

      {/* ── Right panel: result + edit type picker ── */}
      <section
        aria-label="Kết quả chỉnh sửa hình ảnh"
        aria-busy={loading}
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-surface-container-lowest p-4 lg:p-6"
      >
        {loading ? (
          <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div
              className="size-9 animate-spin rounded-full border-2 border-outline-variant border-t-primary motion-reduce:animate-none"
              aria-hidden="true"
            />
            <p className="text-sm text-on-surface-variant">Đang xử lý ảnh. Vui lòng chờ trong giây lát…</p>
          </div>
        ) : result ? (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-balance text-lg font-semibold">Ảnh đã chỉnh sửa</h2>
                <p className="text-sm text-on-surface-variant">{activeEditType.label} · iGenAI</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setResult(null); }}
                  className={cn("rounded-lg border border-outline-variant px-3 py-2 text-xs hover:bg-surface-container-low", focusClass)}
                >
                  Chỉnh sửa lại
                </button>
                <a
                  href={result.url}
                  download="igen-ai-anh-da-chinh-sua.png"
                  className={cn("inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-on-primary hover:bg-primary/90", focusClass)}
                >
                  <Download className="size-4" aria-hidden="true" />
                  Tải ảnh
                </a>
              </div>
            </div>
            <figure className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low">
              <img src={result.url} alt="Ảnh sau chỉnh sửa" className="max-h-[34rem] w-full object-contain" />
              <figcaption className="p-3 text-sm text-on-surface-variant">{result.prompt}</figcaption>
            </figure>
          </>
        ) : (
          /* Empty state with edit type picker */
          <div className="flex flex-1 flex-col items-center justify-center py-6 text-center lg:py-8">
            <div className="space-y-2.5">
              <h2 className={cn("mx-auto max-w-3xl", assistantStudioTitleClass)}>
                <span className={assistantStudioTitleAccentClass}>
                  Chỉnh sửa hình ảnh
                </span>{" "}
                <span className="text-on-surface">thông minh</span>{" "}
                <span className={assistantStudioTitleAccentClass}>cùng AI</span>
              </h2>
              <p className="text-pretty text-sm sm:text-base text-on-surface-variant">
                Tải ảnh lên, chọn loại chỉnh sửa và mô tả yêu cầu để bắt đầu.
              </p>
            </div>

            {/* Hero image */}
            <div className="my-5 flex w-full justify-center">
              <img
                src="/ai-studio-image-edit-hero.png"
                alt="Minh hoạ chỉnh sửa hình ảnh bằng AI"
                width="1536"
                height="1024"
                className="h-auto max-h-[38dvh] w-full max-w-2xl object-contain drop-shadow-xs"
              />
            </div>

            {/* Edit type picker */}
            <section aria-label="Loại chỉnh sửa" className="w-full max-w-4xl space-y-3.5 pt-6 sm:pt-8">
              <h3 className="px-1 text-balance text-left text-sm font-semibold text-on-surface">Thư viện mẫu</h3>
              <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
                {editTypes.map(editType => {
                  const isSelected = mode === editType.id;
                  return (
                    <button
                      key={editType.id}
                      type="button"
                      onClick={() => selectEditType(editType)}
                      aria-pressed={isSelected}
                      title={editType.description}
                      className={cn(
                        "overflow-hidden rounded-xl border border-outline-variant hover:border-primary hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50",
                        isSelected && "border-primary ring-2 ring-primary/30"
                      )}
                    >
                      <div className="aspect-[3/2] w-full bg-surface-container-low">
                        <img
                          src={editType.artwork}
                          alt=""
                          aria-hidden="true"
                          width={768}
                          height={512}
                          loading="lazy"
                          decoding="async"
                          className="size-full object-cover"
                        />
                      </div>
                      <span className={cn("block truncate bg-surface-container-lowest px-2 py-1.5 text-center text-xs font-semibold text-on-surface", isSelected && "text-primary")}>{editType.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </section>

      {/* History drawer */}
      <AssistantStudioHistoryDrawer
        open={showHistory}
        title="Lịch sử chỉnh sửa ảnh"
        onClose={() => setShowHistory(false)}
      >
        <section aria-label="Danh sách ảnh đã chỉnh sửa" aria-busy={historyLoading} className="py-3">
          {historyLoading && <p role="status" className="py-3 text-sm text-on-surface-variant">Đang tải lịch sử…</p>}
          {historyError && (
            <p role="alert" className="rounded-lg border border-error bg-error-container p-3 text-pretty text-sm text-on-error-container">
              {historyError}
            </p>
          )}
          {!historyLoading && !historyError && history.length === 0 && (
            <p className="py-3 text-pretty text-sm text-on-surface-variant">Ảnh bạn chỉnh sửa sẽ xuất hiện ở đây.</p>
          )}
          {!historyLoading && !historyError && history.length > 0 && (
            <ul className="divide-y divide-outline-variant">
              {history.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openHistoryItem(item)}
                    className={cn("flex min-h-16 w-full items-center gap-3 py-3 text-left hover:bg-surface-container-low", focusClass)}
                  >
                    <AssistantStudioHistoryKindIcon kind="edit-image" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-on-surface">{item.title}</span>
                      <time className="mt-1 block text-xs tabular-nums text-on-surface-variant" dateTime={item.createdAt}>
                        {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}
                      </time>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </AssistantStudioHistoryDrawer>
    </div>
  );
}

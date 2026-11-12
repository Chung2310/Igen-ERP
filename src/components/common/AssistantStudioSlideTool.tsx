import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bold, ChevronLeft, ChevronRight, FileText, ImagePlus, Italic, LoaderCircle, Paperclip, Plus, Save, Sparkles, Trash2, Type, Underline, X } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import { assistantService } from "../../services/assistantService";
import { AssistantFileTypeIcon } from "./AssistantFileTypeIcon";
import { assistantSlideFontFamilies, type AssistantSlideCanvasObject, type AssistantSlideDeck, type AssistantSlideHistoryItem, type AssistantSlideStyle, type AssistantSlideTextStyle } from "../../shared/assistant-slide";
import { AssistantStudioBreadcrumb } from "./AssistantStudioBreadcrumb";
import { AssistantStudioBrandMark } from "./AssistantStudioBrandMark";
import { downloadAssistantSlideDeck } from "./assistant-studio-pptx";
import { AssistantStudioHistoryAction, AssistantStudioHistoryDrawer, AssistantStudioHistoryKindIcon } from "./AssistantStudioHistoryDrawer";
import { assistantSlideLayoutOptions, assistantSlideThemes, getAssistantSlideTheme, getSlideMetrics, inferSlideLayout } from "./assistant-slide-design";
import { AssistantStudioSlideCanvas } from "./AssistantStudioSlideCanvas";
import { StyledSelect } from "./StyledSelect";

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const allowedFile = /\.(pdf|docx|pptx|txt)$/i;
const maxFileSize = 20 * 1024 * 1024;
const styleOptions: Array<{ id: AssistantSlideStyle; title: string; description: string }> = [
  { id: "rewrite", title: "Viết lại bằng AI", description: "Biên tập ý tưởng thành bài thuyết trình rõ ràng, thu hút." },
  { id: "preserve", title: "Giữ nguyên nội dung", description: "Bám sát thông tin và cách diễn đạt bạn cung cấp." },
  { id: "shorten", title: "Rút gọn nội dung", description: "Cô đọng các ý thành nội dung ngắn gọn." },
];

type SlideToolView = "form" | "deck" | "edit";

function SlideSteps({ active }: { active: 0 | 1 | 2 }) {
  const steps = ["Nhập nguồn", "AI tạo nội dung", "Xem và hoàn thiện"];
  return <nav aria-label="Tiến trình tạo slide" className="flex min-w-0 justify-center">
    <ol className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:gap-x-3">
      {steps.map((step, index) => <li key={step} aria-current={index === active ? "step" : undefined} className="flex items-center gap-2">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border text-xs font-medium", index <= active ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface-container-lowest text-on-surface-variant")}>{index + 1}</span>
        <span className={cn("whitespace-nowrap text-sm", index === active ? "font-semibold text-primary" : "text-on-surface-variant")}>{step}</span>
        {index < steps.length - 1 && <span aria-hidden="true" className="h-px w-4 shrink-0 bg-outline-variant sm:w-7" />}
      </li>)}
    </ol>
  </nav>;
}

function TopAction({ children, icon: Icon, onClick, disabled = false }: { children: string; icon: typeof Plus; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-medium text-on-surface hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50", focusClass)}><Icon className="size-4" aria-hidden="true" />{children}</button>;
}

function slideLabel(deck: AssistantSlideDeck, index: number): string {
  return index === 0 ? "Trang bìa" : deck.slides[index - 1]?.title || "Slide " + (index + 1);
}

function slideDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function toHistoryItem(deck: AssistantSlideDeck): AssistantSlideHistoryItem {
  return {
    id: deck.id,
    title: deck.title,
    subtitle: deck.subtitle,
    sourceFileName: deck.sourceFileName,
    slideCount: deck.slides.length + 1,
    createdAt: deck.createdAt,
  };
}

function readImageAsPowerPointDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const source = String(reader.result || "");
      if (file.type !== "image/webp") {
        resolve(source);
        return;
      }
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("canvas-unavailable"));
          return;
        }
        context.drawImage(image, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      image.onerror = () => reject(new Error("image-decode-failed"));
      image.src = source;
    };
    reader.onerror = () => reject(new Error("file-read-failed"));
    reader.readAsDataURL(file);
  });
}

export function AssistantStudioSlideTool({ onBack, initialDeckId = null }: { onBack: () => void; initialDeckId?: string | null }) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<AssistantSlideStyle>("rewrite");
  const [pageCount, setPageCount] = useState(10);
  const [file, setFile] = useState<File | null>(null);
  const [deck, setDeck] = useState<AssistantSlideDeck | null>(null);
  const [history, setHistory] = useState<AssistantSlideHistoryItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [view, setView] = useState<SlideToolView>("form");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [loadingDeckId, setLoadingDeckId] = useState("");
  const [error, setError] = useState("");
  const [editDeckTitle, setEditDeckTitle] = useState("");
  const [editDeckSubtitle, setEditDeckSubtitle] = useState("");
  const [editSlideTitle, setEditSlideTitle] = useState("");
  const [editKeyMessage, setEditKeyMessage] = useState("");
  const [editBullets, setEditBullets] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [directEditing, setDirectEditing] = useState(false);
  const [hasDirectChanges, setHasDirectChanges] = useState(false);
  const [selectedTextField, setSelectedTextField] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const promptId = "assistant-slide-prompt";
  const fileRef = useRef<HTMLInputElement>(null);
  const directImageRef = useRef<HTMLInputElement>(null);
  const originalDeckRef = useRef<AssistantSlideDeck | null>(null);
  const activeSlide = deck && activeIndex > 0 ? deck.slides[activeIndex - 1] : null;
  const activeObjects = deck ? activeIndex === 0 ? deck.coverObjects || [] : activeSlide?.objects || [] : [];
  const selectedObject = activeObjects.find(object => object.id === selectedObjectId) || null;
  const selectedTextStyle: AssistantSlideTextStyle = selectedObject?.type === "text"
    ? selectedObject.style || {}
    : !deck || !selectedTextField ? {}
      : activeIndex === 0 ? deck.coverTextStyles?.[selectedTextField] || {}
        : activeSlide?.textStyles?.[selectedTextField] || {};
  const pageItems = useMemo(() => deck ? Array.from({ length: deck.slides.length + 1 }, (_, index) => index) : [], [deck]);
  const busy = isGenerating || isSaving || isLoadingHistory || Boolean(loadingDeckId);
  const activeMetrics = activeSlide ? getSlideMetrics(activeSlide) : [];
  const selectedLayout = activeSlide?.layout || "auto";
  const analysis = deck?.analysis || {
    audience: "Người nghe phổ thông",
    objective: deck?.subtitle || "Trình bày các nội dung chính một cách mạch lạc.",
    storyline: deck?.slides.slice(0, 3).map(slide => slide.title).filter(Boolean).join(" → ") || "Giới thiệu · Nội dung chính · Kết luận",
  };

  function clearFile() {
    setFile(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.currentTarget.files?.[0];
    if (!selected) return;
    if (!allowedFile.test(selected.name)) {
      setFile(null);
      setError("Chọn tệp PDF, Word (.docx), PowerPoint (.pptx) hoặc TXT.");
      event.currentTarget.value = "";
      return;
    }
    if (!selected.size) {
      setFile(null);
      setError("Tệp đang trống. Hãy chọn tài liệu khác.");
      event.currentTarget.value = "";
      return;
    }
    if (selected.size > maxFileSize) {
      setFile(null);
      setError("Tài liệu không được vượt quá 20 MB.");
      event.currentTarget.value = "";
      return;
    }
    setFile(selected);
    setError("");
  }

  async function createDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim() && !file) {
      setError("Nhập nội dung hoặc chọn tài liệu làm nguồn.");
      return;
    }
    setError("");
    setIsGenerating(true);
    try {
      const result = await assistantService.createStudioSlideDeck({ prompt, pageCount, style, file: file || undefined });
      setDeck(result);
      setHistory(items => [toHistoryItem(result), ...items.filter(item => item.id !== result.id)]);
      setActiveIndex(0);
      setView("deck");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo slide lúc này. Vui lòng thử lại.");
    } finally {
      setIsGenerating(false);
    }
  }

  function startNew() {
    setDeck(null);
    setPrompt("");
    setPageCount(10);
    setStyle("rewrite");
    setFile(null);
    setActiveIndex(0);
    setError("");
    setView("form");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function openHistory() {
    if (historyOpen) { setHistoryOpen(false); return; }
    setHistoryError("");
    setHistoryOpen(true);
    setIsLoadingHistory(true);
    try {
      setHistory(await assistantService.studioSlideDecks());
    } catch (cause) {
      setHistoryError(cause instanceof Error ? cause.message : "Không tải được lịch sử slide.");
    } finally {
      setIsLoadingHistory(false);
    }
  }
  const openDeckById = useCallback(async (deckId: string) => {
    setError("");
    setHistoryError("");
    setLoadingDeckId(deckId);
    try {
      const result = await assistantService.studioSlideDeck(deckId);
      setDeck(result);
      setHistoryOpen(false);
      setActiveIndex(0);
      setView("deck");
    } catch (cause) {
      setHistoryError(cause instanceof Error ? cause.message : "Không tải được bộ slide đã lưu.");
    } finally {
      setLoadingDeckId("");
    }
  }, []);

  useEffect(() => {
    if (initialDeckId) void openDeckById(initialDeckId);
  }, [initialDeckId, openDeckById]);

  async function openDeck(item: AssistantSlideHistoryItem) {
    await openDeckById(item.id);
  }

  function beginEditing() {
    if (!deck) return;
    setEditDeckTitle(deck.title);
    setEditDeckSubtitle(deck.subtitle);
    setEditSlideTitle(activeSlide?.title || "");
    setEditKeyMessage(activeSlide?.keyMessage || "");
    setEditBullets(activeSlide?.bullets.join("\n") || "");
    setEditNotes(activeSlide?.speakerNotes || "");
    setError("");
    setView("edit");
  }

  function beginDirectEditing() {
    if (!deck) return;
    originalDeckRef.current = deck;
    setSelectedTextField("title");
    setSelectedObjectId(null);
    setHasDirectChanges(false);
    setError("");
    setDirectEditing(true);
  }

  function cancelDirectEditing() {
    if (originalDeckRef.current) setDeck(originalDeckRef.current);
    setDirectEditing(false);
    setHasDirectChanges(false);
    setSelectedTextField(null);
    setSelectedObjectId(null);
    setError("");
  }

  function updateDirectDeck(update: (current: AssistantSlideDeck) => AssistantSlideDeck) {
    setDeck(current => current ? update(current) : current);
    setHasDirectChanges(true);
    setError("");
  }

  function commitDirectText(field: string, value: string) {
    if (!deck) return;
    const objectPrefix = "object.";
    if (field.startsWith(objectPrefix)) {
      const objectId = field.slice(objectPrefix.length);
      updateDirectDeck(current => {
        const objects = activeIndex === 0 ? current.coverObjects || [] : current.slides[activeIndex - 1]?.objects || [];
        const nextObjects = objects.map(object => object.id === objectId ? { ...object, text: value } : object);
        return activeIndex === 0 ? { ...current, coverObjects: nextObjects } : {
          ...current,
          slides: current.slides.map((slide, index) => index === activeIndex - 1 ? { ...slide, objects: nextObjects } : slide),
        };
      });
      return;
    }
    updateDirectDeck(current => {
      if (activeIndex === 0) {
        if (field === "title") return { ...current, title: value };
        if (field === "subtitle") return { ...current, subtitle: value };
        return current;
      }
      const slides = [...current.slides];
      const slide = { ...slides[activeIndex - 1] };
      if (field === "title") slide.title = value;
      else if (field === "keyMessage") slide.keyMessage = value;
      else if (field.startsWith("bullet-")) {
        const index = Number(field.slice("bullet-".length));
        if (Number.isInteger(index) && index >= 0 && index < slide.bullets.length) {
          slide.bullets = [...slide.bullets];
          slide.bullets[index] = value;
        }
      }
      slides[activeIndex - 1] = slide;
      return { ...current, slides };
    });
  }

  function selectDirectText(field: string) {
    setSelectedTextField(field);
    setSelectedObjectId(field.startsWith("object.") ? field.slice("object.".length) : null);
  }

  function navigateSlide(index: number) {
    setActiveIndex(index);
    if (directEditing) {
      setSelectedTextField("title");
      setSelectedObjectId(null);
    }
  }

  function updateSelectedTextStyle(patch: Partial<AssistantSlideTextStyle>) {
    if (!deck) return;
    if (selectedObject?.type === "text") {
      updateDirectDeck(current => {
        const objects = activeIndex === 0 ? current.coverObjects || [] : current.slides[activeIndex - 1]?.objects || [];
        const nextObjects = objects.map(object => object.id === selectedObject.id ? { ...object, style: { ...object.style, ...patch } } : object);
        return activeIndex === 0 ? { ...current, coverObjects: nextObjects } : {
          ...current,
          slides: current.slides.map((slide, index) => index === activeIndex - 1 ? { ...slide, objects: nextObjects } : slide),
        };
      });
      return;
    }
    if (!selectedTextField) return;
    updateDirectDeck(current => {
      if (activeIndex === 0) return { ...current, coverTextStyles: { ...current.coverTextStyles, [selectedTextField]: { ...current.coverTextStyles?.[selectedTextField], ...patch } } };
      const slides = [...current.slides];
      const slide = slides[activeIndex - 1];
      slides[activeIndex - 1] = { ...slide, textStyles: { ...slide.textStyles, [selectedTextField]: { ...slide.textStyles?.[selectedTextField], ...patch } } };
      return { ...current, slides };
    });
  }

  function updateSelectedObject(patch: Partial<AssistantSlideCanvasObject>) {
    if (!selectedObject) return;
    updateDirectDeck(current => {
      const objects = activeIndex === 0 ? current.coverObjects || [] : current.slides[activeIndex - 1]?.objects || [];
      const nextObjects = objects.map(object => object.id === selectedObject.id ? { ...object, ...patch } : object);
      return activeIndex === 0 ? { ...current, coverObjects: nextObjects } : {
        ...current,
        slides: current.slides.map((slide, index) => index === activeIndex - 1 ? { ...slide, objects: nextObjects } : slide),
      };
    });
  }

  function moveSelectedObject(dx: number, dy: number) {
    if (!selectedObject) return;
    updateSelectedObject({
      x: Math.max(0, Math.min(100 - selectedObject.width, selectedObject.x + dx)),
      y: Math.max(0, Math.min(100 - selectedObject.height, selectedObject.y + dy)),
    });
  }

  function resizeSelectedObject(delta: number) {
    if (!selectedObject) return;
    const width = Math.max(8, Math.min(100 - selectedObject.x, selectedObject.width + delta));
    const height = Math.max(8, Math.min(100 - selectedObject.y, selectedObject.height + delta));
    updateSelectedObject({ width, height });
  }

  function addTextBox() {
    if (!deck || activeObjects.length >= 4) {
      setError("Mỗi trang có thể thêm tối đa 4 đối tượng.");
      return;
    }
    const object: AssistantSlideCanvasObject = {
      id: `text-${Date.now()}`,
      type: "text",
      text: "Nhập nội dung",
      x: 30,
      y: 38,
      width: 38,
      height: 18,
      style: { fontSize: 24, bold: true },
    };
    updateDirectDeck(current => activeIndex === 0
      ? { ...current, coverObjects: [...(current.coverObjects || []), object] }
      : { ...current, slides: current.slides.map((slide, index) => index === activeIndex - 1 ? { ...slide, objects: [...(slide.objects || []), object] } : slide) });
    setSelectedTextField(null);
    setSelectedObjectId(object.id);
  }

  function addImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError("Chọn ảnh PNG, JPG hoặc WebP.");
      event.currentTarget.value = "";
      return;
    }
    if (file.size > 1_100_000) {
      setError("Mỗi ảnh thêm vào slide không được vượt quá 1,1 MB.");
      event.currentTarget.value = "";
      return;
    }
    if (activeObjects.length >= 4) {
      setError("Mỗi trang có thể thêm tối đa 4 đối tượng.");
      event.currentTarget.value = "";
      return;
    }
    void readImageAsPowerPointDataUrl(file).then(src => {
      const savedImageSize = [...(deck?.coverObjects || []), ...(deck?.slides.flatMap(slide => slide.objects || []) || [])].reduce((total, object) => total + (object.src?.length || 0), 0);
      if (!src || src.length > 1_500_000 || savedImageSize + src.length > 8_000_000) {
        setError("Ảnh đã chuyển đổi vượt 1,5 MB hoặc tổng dung lượng ảnh trong bộ slide vượt 8 MB.");
        if (directImageRef.current) directImageRef.current.value = "";
        return;
      }
      const object: AssistantSlideCanvasObject = { id: `image-${Date.now()}`, type: "image", src, alt: file.name, x: 70, y: 18, width: 22, height: 24 };
      updateDirectDeck(current => activeIndex === 0
        ? { ...current, coverObjects: [...(current.coverObjects || []), object] }
        : { ...current, slides: current.slides.map((slide, index) => index === activeIndex - 1 ? { ...slide, objects: [...(slide.objects || []), object] } : slide) });
      setSelectedTextField(null);
      setSelectedObjectId(object.id);
      if (directImageRef.current) directImageRef.current.value = "";
    }).catch(() => {
      setError("Không đọc được tệp ảnh đã chọn.");
      if (directImageRef.current) directImageRef.current.value = "";
    });
  }

  function deleteSelectedObject() {
    if (!selectedObject) return;
    updateDirectDeck(current => {
      const objects = activeIndex === 0 ? current.coverObjects || [] : current.slides[activeIndex - 1]?.objects || [];
      const nextObjects = objects.filter(object => object.id !== selectedObject.id);
      return activeIndex === 0 ? { ...current, coverObjects: nextObjects } : {
        ...current,
        slides: current.slides.map((slide, index) => index === activeIndex - 1 ? { ...slide, objects: nextObjects } : slide),
      };
    });
    setSelectedObjectId(null);
    setSelectedTextField("title");
  }

  async function saveDirectChanges() {
    if (!deck) return;
    const saved = await savePresentationDesign(deck);
    if (!saved) return;
    originalDeckRef.current = deck;
    setDirectEditing(false);
    setHasDirectChanges(false);
    setSelectedTextField(null);
    setSelectedObjectId(null);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deck) return;
    const slides = [...deck.slides];
    if (activeIndex > 0) {
      const bullets = editBullets.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
      if (bullets.length < 2 || bullets.length > 5) {
        setError("Mỗi slide cần có từ 2 đến 5 gạch đầu dòng.");
        return;
      }
      slides[activeIndex - 1] = {
        ...activeSlide,
        title: editSlideTitle.trim(),
        keyMessage: editKeyMessage.trim(),
        bullets,
        speakerNotes: editNotes.trim(),
        layout: activeSlide?.layout,
      };
    }
    setError("");
    setIsSaving(true);
    try {
      const updated = await assistantService.updateStudioSlideDeck(deck.id, {
        title: editDeckTitle.trim(),
        subtitle: editDeckSubtitle.trim(),
        themeId: deck.themeId,
        coverTextStyles: deck.coverTextStyles,
        coverObjects: deck.coverObjects,
        slides,
      });
      setDeck(updated);
      setHistory(items => [toHistoryItem(updated), ...items.filter(item => item.id !== updated.id)]);
      setView("deck");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được nội dung slide.");
    } finally {
      setIsSaving(false);
    }
  }

  async function savePresentationDesign(nextDeck: AssistantSlideDeck): Promise<boolean> {
    setError("");
    setIsSaving(true);
    try {
      const updated = await assistantService.updateStudioSlideDeck(nextDeck.id, {
        title: nextDeck.title,
        subtitle: nextDeck.subtitle,
        themeId: nextDeck.themeId,
        coverTextStyles: nextDeck.coverTextStyles,
        coverObjects: nextDeck.coverObjects,
        slides: nextDeck.slides,
      });
      setDeck(updated);
      setHistory(items => [toHistoryItem(updated), ...items.filter(item => item.id !== updated.id)]);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được cách trình bày slide.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function chooseTheme(themeId: AssistantSlideDeck["themeId"]) {
    if (!deck || deck.themeId === themeId || busy) return;
    if (directEditing) updateDirectDeck(current => ({ ...current, themeId }));
    else void savePresentationDesign({ ...deck, themeId });
  }

  function chooseLayout(layout: "auto" | NonNullable<AssistantSlideDeck["slides"][number]["layout"]>) {
    if (!deck || activeIndex === 0 || busy) return;
    const slides = [...deck.slides];
    if (layout === "auto") {
      const slide = { ...slides[activeIndex - 1] };
      delete slide.layout;
      slides[activeIndex - 1] = slide;
    } else slides[activeIndex - 1] = { ...slides[activeIndex - 1], layout };
    if (directEditing) updateDirectDeck(current => ({ ...current, slides }));
    else void savePresentationDesign({ ...deck, slides });
  }

  const activeStep: 0 | 1 | 2 = isGenerating ? 1 : view === "deck" || view === "edit" ? 2 : 0;
  const breadcrumbBack = view === "form" ? onBack : () => setView(view === "edit" ? "deck" : "form");
  const hasSource = Boolean(prompt.trim() || file);

  return <div aria-busy={Boolean(loadingDeckId)} className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-container-lowest text-on-surface">
    <header className="grid shrink-0 grid-cols-1 items-center gap-3 border-b border-outline-variant px-4 py-3 sm:px-6 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <AssistantStudioBreadcrumb title={view === "edit" ? "Chỉnh sửa slide" : "Tạo slide"} onBack={breadcrumbBack} titleAsHeading={false} />
      <SlideSteps active={activeStep} />
      <div className="order-2 flex items-center justify-end gap-2 xl:order-none">
        <TopAction icon={Plus} onClick={startNew} disabled={busy}>Tạo mới</TopAction>
        <AssistantStudioHistoryAction open={historyOpen} onClick={() => void openHistory()} />
      </div>
    </header>

    {loadingDeckId && !deck && <p role="status" className="px-4 py-3 text-sm text-on-surface-variant">Đang mở bộ slide đã lưu…</p>}

    {view === "form" && <div className="min-h-0 flex-1 w-full overflow-y-auto">
      <form onSubmit={createDeck} aria-busy={isGenerating} aria-describedby={error ? "assistant-slide-form-error" : undefined} className="mx-auto flex w-full max-w-4xl min-h-full flex-col px-4 pb-8 pt-4 sm:px-6 sm:pt-6">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2.5">
          <h1 className="text-balance text-2xl font-bold leading-tight text-on-surface sm:text-[37px] sm:leading-[1.2]">
            <span>Tóm tắt tài liệu thành slide báo cáo </span>
            <span className="bg-[linear-gradient(90deg,#00adfc_0%,#199bff_55%,#7567ff_100%)] bg-clip-text text-transparent">với AI</span>
          </h1>
          <AssistantStudioBrandMark className="size-7 shrink-0 sm:size-8" />
        </div>
      </div>

      <div className="assistant-slide-composer mt-5 flex flex-col p-3 sm:p-4">
        <label htmlFor={promptId} className="sr-only">Chủ đề và nội dung</label>
        <textarea
          id={promptId}
          required={!file}
          minLength={file ? undefined : 3}
          maxLength={10000}
          rows={3}
          value={prompt}
          onChange={event => setPrompt(event.target.value)}
          placeholder="Nhập chủ đề, thông điệp hoặc đính kèm tài liệu để tạo slide báo cáo..."
          aria-describedby="assistant-slide-count"
          className="min-h-20 w-full resize-none border-0 bg-transparent px-2 py-1 text-sm text-on-surface placeholder:text-on-surface/45 focus:outline-none focus:ring-0 sm:min-h-24 sm:text-base"
        />

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-outline-variant/40 pt-2.5">
          <input ref={fileRef} type="file" accept=".pdf,.docx,.pptx,.txt" className="sr-only" tabIndex={-1} aria-label="Chọn tài liệu làm nguồn" onChange={chooseFile} />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              title="PDF, Word, PowerPoint hoặc TXT · tối đa 20 MB"
              disabled={isGenerating}
              className={cn("inline-flex min-h-9 items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-3.5 text-xs font-medium text-on-surface hover:border-primary/40 hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50 transition-colors", focusClass)}
            >
              <Paperclip className="size-3.5" aria-hidden="true" />
              <span>Đính kèm tài liệu</span>
            </button>
            {file && (
              <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-primary/10 border border-primary/25 px-3 py-1 text-xs font-medium text-primary">
                <AssistantFileTypeIcon fileName={file.name} className="size-4 shrink-0" />
                <span className="max-w-44 truncate sm:max-w-72">{file.name}</span>
                <button type="button" aria-label="Bỏ tài liệu đã chọn" disabled={isGenerating} onClick={clearFile} className={cn("grid size-5 shrink-0 place-items-center rounded-full hover:bg-primary/20 disabled:opacity-50", focusClass)}>
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            )}
          </div>
          <span id="assistant-slide-count" className="shrink-0 text-xs text-on-surface-variant/60 tabular-nums">
            {prompt.length.toLocaleString("vi-VN")} / 10.000
          </span>
        </div>
      </div>

      <section aria-labelledby="assistant-slide-style-title" className="mt-6">
        <h2 id="assistant-slide-style-title" className="mb-3 text-balance text-center text-sm font-semibold text-on-surface-variant">Cách xử lý nội dung</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {styleOptions.map(option => {
            const isSelected = style === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                disabled={isGenerating}
                onClick={() => setStyle(option.id)}
                className={cn(
                  "flex min-h-22 items-start gap-3 rounded-2xl border p-3.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50",
                  isSelected
                    ? "border-primary/80 bg-primary/5 shadow-xs"
                    : "border-outline-variant/70 bg-surface-container-lowest hover:border-primary/40 hover:bg-surface-container-low/40",
                  focusClass
                )}
              >
                <span className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
                  isSelected ? "border-primary bg-primary text-white" : "border-outline-variant bg-surface-container-lowest"
                )}>
                  {isSelected && <span className="size-2 rounded-full bg-white" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm font-semibold", isSelected ? "text-primary" : "text-on-surface")}>
                    {option.title}
                  </span>
                  <span className="mt-1 block text-pretty text-xs leading-relaxed text-on-surface-variant">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="inline-flex h-9 items-center rounded-full border border-outline-variant/80 bg-surface-container-lowest shadow-xs">
          <button type="button" aria-label="Giảm số trang" disabled={pageCount <= 1 || isGenerating} onClick={() => setPageCount(value => Math.max(1, value - 1))} className={cn("grid size-9 place-items-center rounded-l-full text-on-surface-variant hover:bg-surface-container-low disabled:opacity-40", focusClass)}><ChevronLeft className="size-4" aria-hidden="true" /></button>
          <span className="min-w-24 border-x border-outline-variant/60 px-3 text-center text-sm font-medium tabular-nums">{pageCount} trang</span>
          <button type="button" aria-label="Tăng số trang" disabled={pageCount >= 30 || isGenerating} onClick={() => setPageCount(value => Math.min(30, value + 1))} className={cn("grid size-9 place-items-center rounded-r-full text-on-surface-variant hover:bg-surface-container-low disabled:opacity-40", focusClass)}><ChevronRight className="size-4" aria-hidden="true" /></button>
        </div>
        <p className="text-xs text-on-surface-variant/70">Tối đa 30 trang, gồm trang bìa.</p>
      </div>

      {error && <p id="assistant-slide-form-error" role="alert" className="mt-4 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-pretty text-sm text-on-surface">{error}</p>}
      <div className="mt-6 flex justify-center pb-2">
        <button
          type="submit"
          disabled={!hasSource || isGenerating}
          aria-describedby={error ? "assistant-slide-form-error" : undefined}
          className={cn(
            "inline-flex min-h-12 min-w-64 items-center justify-center gap-2 rounded-full px-8 text-sm font-semibold text-on-primary transition-all",
            !hasSource || isGenerating
              ? "bg-surface-container-high text-on-surface-variant/40 cursor-not-allowed opacity-60"
              : "bg-[linear-gradient(125deg,#00adfc,#7567ff)] shadow-[0_4px_16px_color-mix(in_srgb,#7567ff_28%,transparent)] hover:shadow-[0_6px_20px_color-mix(in_srgb,#7567ff_38%,transparent)] hover:opacity-95 active:scale-[0.99]",
            focusClass
          )}
        >
          {isGenerating ? (
            <><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Đang tạo nội dung...</>
          ) : (
            <>Tạo nội dung slide <Sparkles className="size-4" aria-hidden="true" /></>
          )}
        </button>
      </div>
      {isGenerating && <p role="status" aria-live="polite" className="mt-3 text-center text-sm text-on-surface-variant">AI đang sắp xếp thông điệp, tiêu đề và nội dung từng trang.</p>}
    </form></div>}

    {view === "deck" && deck && <main className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 sm:px-6">
        <div className="min-w-0"><h1 className="truncate text-balance text-lg font-semibold text-on-surface">{deck.title}</h1><p className="mt-1 truncate text-xs text-on-surface-variant sm:text-sm">{deck.slides.length + 1} trang · Tạo lúc {slideDate(deck.createdAt)}{deck.sourceFileName ? " · Nguồn: " + deck.sourceFileName : ""}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          {directEditing ? <><button type="button" onClick={cancelDirectEditing} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant px-3 text-sm font-medium text-on-surface hover:bg-surface-container-low", focusClass)}>Hủy</button><button type="button" disabled={busy || !hasDirectChanges} onClick={() => void saveDirectChanges()} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50", focusClass)}><Save className="size-4" aria-hidden="true" />Lưu thay đổi</button></> : <button type="button" onClick={beginDirectEditing} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 text-sm font-medium text-primary hover:bg-primary/10", focusClass)}><Type className="size-4" aria-hidden="true" />Sửa nội dung</button>}
          <button type="button" disabled={busy} onClick={() => downloadAssistantSlideDeck(deck)} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4", focusClass)}><ArrowDownToLine className="size-4" aria-hidden="true" />Tải PowerPoint</button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:overflow-hidden lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside aria-label="Phân tích và thiết kế slide" className="min-h-0 border-b border-outline-variant bg-surface-container-lowest p-4 overflow-y-auto lg:border-b-0 lg:border-r lg:p-5">
          <section aria-labelledby="assistant-slide-analysis-title">
            <h2 id="assistant-slide-analysis-title" className="flex items-center gap-2 text-balance text-base font-semibold text-on-surface"><Sparkles className="size-4 text-primary" aria-hidden="true" />AI phân tích</h2>
            <dl className="mt-3 space-y-3 rounded-xl border border-outline-variant bg-surface-container-low p-3.5">
              <div><dt className="text-xs font-semibold text-on-surface-variant">Người nghe</dt><dd className="mt-1 text-pretty text-sm text-on-surface">{analysis.audience}</dd></div>
              <div><dt className="text-xs font-semibold text-on-surface-variant">Mục tiêu</dt><dd className="mt-1 text-pretty text-sm text-on-surface">{analysis.objective}</dd></div>
              <div><dt className="text-xs font-semibold text-on-surface-variant">Mạch nội dung</dt><dd className="mt-1 text-pretty text-sm leading-relaxed text-on-surface">{analysis.storyline}</dd></div>
            </dl>
          </section>

          <section aria-labelledby="assistant-slide-theme-title" className="mt-5">
            <h2 id="assistant-slide-theme-title" className="text-balance text-sm font-semibold text-on-surface">Bảng màu</h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {assistantSlideThemes.map(theme => <button key={theme.id} type="button" aria-label={`Chọn bảng màu ${theme.label}`} aria-pressed={deck.themeId === theme.id} disabled={busy} onClick={() => chooseTheme(theme.id)} className={cn("rounded-lg border p-2 text-left hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50", deck.themeId === theme.id ? "border-primary bg-primary/5" : "border-outline-variant", focusClass)}>
                <span className="mb-1.5 flex gap-1" aria-hidden="true">{theme.accents.map(color => <span key={color} className="size-4 rounded-full border border-black/10" style={{ backgroundColor: color }} />)}</span>
                <span className="block text-xs font-semibold text-on-surface">{theme.label}</span><span className="block truncate text-[11px] text-on-surface-variant">{theme.description}</span>
              </button>)}
            </div>
          </section>

          <section aria-labelledby="assistant-slide-layout-title" className="mt-5">
            <div className="flex items-center justify-between gap-2">
              <h2 id="assistant-slide-layout-title" className="text-balance text-sm font-semibold text-on-surface">Kiểu trình bày</h2>
              <span className="text-xs text-on-surface-variant">{activeIndex === 0 ? "Trang bìa" : `Trang ${activeIndex + 1}`}</span>
            </div>
            <p id="assistant-slide-layout-hint" className="mt-1 text-pretty text-xs text-on-surface-variant">Tự chọn sẽ dùng bố cục phù hợp với nội dung. Thay đổi này không gọi AI.</p>
            <div role="group" aria-labelledby="assistant-slide-layout-title" aria-describedby="assistant-slide-layout-hint" className="mt-2 grid grid-cols-2 gap-2">
              {assistantSlideLayoutOptions.map(option => {
                const isChart = option.id === "chart";
                const disabled = busy || activeIndex === 0 || (isChart && activeMetrics.length < 2);
                const selected = selectedLayout === option.id;
                return <button key={option.id} type="button" aria-label={option.label} aria-pressed={selected} disabled={disabled} onClick={() => void chooseLayout(option.id)} title={isChart && activeMetrics.length < 2 ? "Cần ít nhất hai số liệu cùng đơn vị trong slide." : option.description} className={cn("min-h-14 rounded-lg border px-2.5 py-2 text-left disabled:cursor-not-allowed disabled:opacity-45", selected ? "border-primary bg-primary/5" : "border-outline-variant hover:bg-surface-container-low", focusClass)}>
                  <span className={cn("block text-xs font-semibold", selected ? "text-primary" : "text-on-surface")}>{option.label}</span><span className="mt-0.5 block line-clamp-2 text-[11px] leading-snug text-on-surface-variant">{isChart && activeMetrics.length < 2 ? "Cần ≥ 2 số liệu cùng đơn vị" : option.description}</span>
                </button>;
              })}
            </div>
            {activeSlide && <p className="mt-2 text-xs text-on-surface-variant">Đang dùng: <span className="font-medium text-on-surface">{assistantSlideLayoutOptions.find(option => option.id === selectedLayout)?.label || "Tự chọn"}{selectedLayout === "auto" ? ` · ${assistantSlideLayoutOptions.find(option => option.id === inferSlideLayout(activeSlide))?.label || "Thẻ ý chính"}` : ""}</span></p>}
          </section>

          <nav aria-label="Dàn ý các slide" className="mt-5">
            <h2 className="text-balance text-sm font-semibold text-on-surface">Dàn ý bài trình bày</h2>
            <ol className="mt-2 space-y-1">
              {pageItems.map(index => <li key={index}><button type="button" aria-label={`Trang ${index + 1}: ${slideLabel(deck, index)}`} aria-current={activeIndex === index ? "page" : undefined} onClick={() => navigateSlide(index)} className={cn("flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-surface-container-low", activeIndex === index ? "bg-primary/5 text-primary" : "text-on-surface", focusClass)}><span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-container-low text-xs font-semibold tabular-nums">{String(index + 1).padStart(2, "0")}</span><span className="line-clamp-2 min-w-0 text-pretty text-xs font-medium">{slideLabel(deck, index)}</span></button></li>)}
            </ol>
          </nav>

          {activeSlide?.speakerNotes && <section aria-labelledby="assistant-slide-notes-title" className="mt-5 rounded-lg border border-outline-variant p-3">
            <h2 id="assistant-slide-notes-title" className="text-balance text-xs font-semibold text-on-surface">Gợi ý thuyết trình</h2><p className="mt-1 text-pretty text-xs leading-relaxed text-on-surface-variant">{activeSlide.speakerNotes}</p>
          </section>}
        </aside>

        <section aria-label="Bản xem trước slide" className="min-w-0 bg-surface-container-low p-4 sm:p-6 min-h-0 overflow-y-auto lg:p-7">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0"><p className="text-xs font-medium text-on-surface-variant">BẢN XEM TRƯỚC</p><h2 className="mt-0.5 truncate text-balance text-base font-semibold text-on-surface">{slideLabel(deck, activeIndex)}</h2></div>
              {isSaving && <span role="status" className="text-xs text-on-surface-variant">Đang lưu thay đổi…</span>}
            </div>
            {directEditing && <section aria-label="Thanh công cụ định dạng slide" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest p-2">
              <StyledSelect
                ariaLabel={"Font ch\u1eef"}
                value={selectedTextStyle.fontFamily || ""}
                disabled={!selectedTextField && selectedObject?.type !== "text"}
                onChange={value => updateSelectedTextStyle({ fontFamily: value ? value as AssistantSlideTextStyle["fontFamily"] : undefined })}
                options={[{ value: "", label: "Font m\u1eb7c \u0111\u1ecbnh" }, ...assistantSlideFontFamilies.map(font => ({ value: font, label: font }))]}
                className="h-9 w-40 shrink-0 rounded-md"
                menuClassName="rounded-md [&_[role=option]]:rounded-sm"
              />
              <StyledSelect
                ariaLabel={"C\u1ee1 ch\u1eef"}
                value={selectedTextStyle.fontSize ? String(selectedTextStyle.fontSize) : ""}
                disabled={!selectedTextField && selectedObject?.type !== "text"}
                onChange={value => updateSelectedTextStyle({ fontSize: value ? Number(value) : undefined })}
                options={[{ value: "", label: "C\u1ee1 m\u1eb7c \u0111\u1ecbnh" }, ...[12, 14, 18, 24, 32, 40, 48].map(size => ({ value: String(size), label: String(size) + " px" }))]}
                className="h-9 w-24 shrink-0 rounded-md"
                menuClassName="rounded-md [&_[role=option]]:rounded-sm"
              />
              <div className="flex items-center gap-1" aria-label="Kiểu chữ">
                <button type="button" aria-label="In đậm" aria-pressed={Boolean(selectedTextStyle.bold)} disabled={!selectedTextField && selectedObject?.type !== "text"} onClick={() => updateSelectedTextStyle({ bold: !selectedTextStyle.bold })} className={cn("grid size-9 place-items-center rounded-md border border-outline-variant disabled:opacity-40", selectedTextStyle.bold && "bg-primary/10 text-primary", focusClass)}><Bold className="size-4" aria-hidden="true" /></button>
                <button type="button" aria-label="In nghiêng" aria-pressed={Boolean(selectedTextStyle.italic)} disabled={!selectedTextField && selectedObject?.type !== "text"} onClick={() => updateSelectedTextStyle({ italic: !selectedTextStyle.italic })} className={cn("grid size-9 place-items-center rounded-md border border-outline-variant disabled:opacity-40", selectedTextStyle.italic && "bg-primary/10 text-primary", focusClass)}><Italic className="size-4" aria-hidden="true" /></button>
                <button type="button" aria-label="Gạch chân" aria-pressed={Boolean(selectedTextStyle.underline)} disabled={!selectedTextField && selectedObject?.type !== "text"} onClick={() => updateSelectedTextStyle({ underline: !selectedTextStyle.underline })} className={cn("grid size-9 place-items-center rounded-md border border-outline-variant disabled:opacity-40", selectedTextStyle.underline && "bg-primary/10 text-primary", focusClass)}><Underline className="size-4" aria-hidden="true" /></button>
              </div>
              <div className="flex items-center gap-1" aria-label="Căn lề">
                {([{ value: "left", label: "Căn trái", icon: AlignLeft }, { value: "center", label: "Căn giữa", icon: AlignCenter }, { value: "right", label: "Căn phải", icon: AlignRight }] as const).map(option => <button key={option.value} type="button" aria-label={option.label} aria-pressed={selectedTextStyle.align === option.value} disabled={!selectedTextField && selectedObject?.type !== "text"} onClick={() => updateSelectedTextStyle({ align: option.value })} className={cn("grid size-9 place-items-center rounded-md border border-outline-variant disabled:opacity-40", selectedTextStyle.align === option.value && "bg-primary/10 text-primary", focusClass)}><option.icon className="size-4" aria-hidden="true" /></button>)}
              </div>
              <label className="flex min-h-9 items-center gap-1.5 rounded-md border border-outline-variant px-2 text-xs text-on-surface-variant">Màu chữ<input aria-label="Màu chữ" type="color" value={selectedTextStyle.color || getAssistantSlideTheme(deck.themeId).ink} disabled={!selectedTextField && selectedObject?.type !== "text"} onChange={event => updateSelectedTextStyle({ color: event.target.value.toUpperCase() })} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed" /></label>
              <button type="button" onClick={addTextBox} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-md border border-outline-variant px-2.5 text-sm text-on-surface hover:bg-surface-container-low", focusClass)}><Type className="size-4" aria-hidden="true" />Thêm hộp chữ</button>
              <button type="button" onClick={() => directImageRef.current?.click()} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-md border border-outline-variant px-2.5 text-sm text-on-surface hover:bg-surface-container-low", focusClass)}><ImagePlus className="size-4" aria-hidden="true" />Thêm ảnh</button>
              <input ref={directImageRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={addImage} aria-label="Chọn ảnh để thêm vào slide" tabIndex={-1} className="sr-only" />
              {selectedObject && <div className="flex flex-wrap items-center gap-1 border-l border-outline-variant pl-2">
                <span className="mr-1 text-xs text-on-surface-variant">Vị trí</span>
                <button type="button" aria-label="Di chuyển đối tượng lên" onClick={() => moveSelectedObject(0, -2)} className={cn("grid size-8 place-items-center rounded-md border border-outline-variant", focusClass)}><ArrowUp className="size-4" aria-hidden="true" /></button>
                <button type="button" aria-label="Di chuyển đối tượng xuống" onClick={() => moveSelectedObject(0, 2)} className={cn("grid size-8 place-items-center rounded-md border border-outline-variant", focusClass)}><ArrowDown className="size-4" aria-hidden="true" /></button>
                <button type="button" aria-label="Di chuyển đối tượng sang trái" onClick={() => moveSelectedObject(-2, 0)} className={cn("grid size-8 place-items-center rounded-md border border-outline-variant", focusClass)}><ArrowLeft className="size-4" aria-hidden="true" /></button>
                <button type="button" aria-label="Di chuyển đối tượng sang phải" onClick={() => moveSelectedObject(2, 0)} className={cn("grid size-8 place-items-center rounded-md border border-outline-variant", focusClass)}><ArrowRight className="size-4" aria-hidden="true" /></button>
                <button type="button" aria-label="Thu nhỏ đối tượng" onClick={() => resizeSelectedObject(-2)} className={cn("min-h-8 rounded-md border border-outline-variant px-2 text-sm", focusClass)}>−</button>
                <button type="button" aria-label="Phóng to đối tượng" onClick={() => resizeSelectedObject(2)} className={cn("min-h-8 rounded-md border border-outline-variant px-2 text-sm", focusClass)}>+</button>
                <button type="button" aria-label="Xóa đối tượng khỏi slide" onClick={deleteSelectedObject} className={cn("grid size-8 place-items-center rounded-md border border-error/40 text-error", focusClass)}><Trash2 className="size-4" aria-hidden="true" /></button>
              </div>}
              {selectedObject?.type === "image" && <label className="flex min-h-9 items-center gap-2 text-xs text-on-surface-variant">Mô tả ảnh<input aria-label="Mô tả ảnh" value={selectedObject.alt || ""} maxLength={200} onChange={event => updateSelectedObject({ alt: event.target.value })} className="min-h-9 w-36 rounded-md border border-outline-variant bg-surface-container-lowest px-2 text-sm text-on-surface" /></label>}
              <span className="ml-auto text-xs text-on-surface-variant">Bấm chữ để sửa · chọn đối tượng để đổi vị trí</span>
            </section>}
            <article aria-label={slideLabel(deck, activeIndex) + ", trang " + (activeIndex + 1) + " trên " + (deck.slides.length + 1)} className={cn("aspect-video w-full overflow-hidden rounded-xl border border-outline-variant shadow-sm sm:rounded-2xl", directEditing && "ring-1 ring-primary/30")}>
              <AssistantStudioSlideCanvas deck={deck} activeIndex={activeIndex} editable={directEditing} selectedField={selectedTextField} selectedObjectId={selectedObjectId} onSelectField={selectDirectText} onSelectObject={id => { setSelectedObjectId(id); setSelectedTextField(null); }} onCommitText={commitDirectText} />
            </article>
            {error && <p role="alert" className="mt-3 rounded-lg border border-error bg-error-container px-3 py-2.5 text-pretty text-sm text-on-error-container">{error}</p>}
            <div className="mt-3 flex items-center justify-between gap-3">
              <button type="button" disabled={activeIndex === 0} onClick={() => navigateSlide(Math.max(0, activeIndex - 1))} className={cn("inline-flex min-h-9 items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40", focusClass)}><ChevronLeft className="size-4" aria-hidden="true" />Trang trước</button>
              <span className="text-xs tabular-nums text-on-surface-variant">{activeIndex + 1} / {deck.slides.length + 1}</span>
              <button type="button" disabled={activeIndex >= deck.slides.length} onClick={() => navigateSlide(Math.min(deck.slides.length, activeIndex + 1))} className={cn("inline-flex min-h-9 items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>Trang tiếp<ChevronRight className="size-4" aria-hidden="true" /></button>
            </div>
          </div>
        </section>
      </div>
    </main>}

    {view === "edit" && deck && <div className="min-h-0 flex-1 w-full overflow-y-auto">
      <form onSubmit={saveEdit} aria-busy={isSaving} aria-describedby={error ? "assistant-slide-edit-error" : undefined} className="mx-auto flex w-full max-w-3xl min-h-full flex-col px-4 py-6 sm:px-8">
      <h1 className="text-balance text-lg font-semibold text-on-surface">{activeIndex === 0 ? "Chỉnh sửa trang bìa" : "Chỉnh sửa slide " + (activeIndex + 1)}</h1>
      <p className="mt-1 text-pretty text-sm text-on-surface-variant">Nội dung chỉnh sửa được lưu trực tiếp, không gọi AI.</p>
      {activeIndex === 0 ? <div className="mt-5 space-y-4">
        <div><label htmlFor="assistant-slide-edit-title" className="mb-1.5 block text-sm font-medium">Tiêu đề bài thuyết trình</label><input id="assistant-slide-edit-title" required maxLength={120} value={editDeckTitle} onChange={event => setEditDeckTitle(event.target.value)} className="min-h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus:border-primary focus:outline-none" /></div>
        <div><label htmlFor="assistant-slide-edit-subtitle" className="mb-1.5 block text-sm font-medium">Mô tả</label><textarea id="assistant-slide-edit-subtitle" maxLength={240} rows={3} value={editDeckSubtitle} onChange={event => setEditDeckSubtitle(event.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none" /></div>
      </div> : <div className="mt-5 space-y-4">
        <div><label htmlFor="assistant-slide-edit-title" className="mb-1.5 block text-sm font-medium">Tiêu đề slide</label><input id="assistant-slide-edit-title" required maxLength={120} value={editSlideTitle} onChange={event => setEditSlideTitle(event.target.value)} className="min-h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus:border-primary focus:outline-none" /></div>
        <div><label htmlFor="assistant-slide-edit-message" className="mb-1.5 block text-sm font-medium">Thông điệp chính</label><textarea id="assistant-slide-edit-message" maxLength={240} rows={2} value={editKeyMessage} onChange={event => setEditKeyMessage(event.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none" /></div>
        <div><label htmlFor="assistant-slide-edit-bullets" className="mb-1.5 block text-sm font-medium">Gạch đầu dòng</label><textarea id="assistant-slide-edit-bullets" required rows={6} value={editBullets} onChange={event => setEditBullets(event.target.value)} aria-describedby="assistant-slide-edit-bullets-hint" className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none" /><p id="assistant-slide-edit-bullets-hint" className="mt-1 text-xs text-on-surface-variant">Mỗi dòng là một ý; giữ từ 2 đến 5 ý.</p></div>
        <div><label htmlFor="assistant-slide-edit-notes" className="mb-1.5 block text-sm font-medium">Gợi ý thuyết trình</label><textarea id="assistant-slide-edit-notes" maxLength={1000} rows={3} value={editNotes} onChange={event => setEditNotes(event.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none" /></div>
      </div>}
      {error && <p id="assistant-slide-edit-error" role="alert" className="mt-4 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-pretty text-sm text-on-surface">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={isSaving} onClick={() => { setError(""); setView("deck"); }} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant px-4 text-sm font-medium text-on-surface hover:bg-surface-container-low disabled:opacity-50", focusClass)}>Hủy</button>
        <button type="submit" disabled={isSaving} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-50", focusClass)}>{isSaving ? <><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Đang lưu...</> : <><Save className="size-4" aria-hidden="true" />Lưu nội dung</>}</button>
      </div>
    </form></div>}


    <AssistantStudioHistoryDrawer open={historyOpen} title="Lịch sử tạo slide" onClose={() => setHistoryOpen(false)}>
      <section aria-label="Các bộ slide đã lưu" aria-busy={isLoadingHistory} className="py-3">
        <p className="mb-3 text-pretty text-xs text-on-surface-variant">Các bộ slide đã lưu cho tài khoản của bạn.</p>
        {isLoadingHistory && <p role="status" className="py-3 text-sm text-on-surface-variant">Đang tải lịch sử…</p>}
        {historyError && <p role="alert" className="mb-3 rounded-lg border border-error bg-error-container p-3 text-pretty text-sm text-on-error-container">{historyError}</p>}
        {!isLoadingHistory && history.length > 0 && <ul className="divide-y divide-outline-variant">{history.map(item => <li key={item.id}><button type="button" disabled={Boolean(loadingDeckId)} onClick={() => void openDeck(item)} className={cn("flex min-h-16 w-full items-center gap-3 py-3 text-left hover:bg-surface-container-low disabled:opacity-50", focusClass)}><AssistantStudioHistoryKindIcon kind="slide" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-on-surface">{item.title}</span><span className="mt-1 block truncate text-xs text-on-surface-variant">{item.slideCount} trang · {item.sourceFileName || "Tạo từ nội dung nhập"}</span><time className="mt-1 block text-xs tabular-nums text-on-surface-variant" dateTime={item.createdAt}>{slideDate(item.createdAt)}</time></span>{loadingDeckId === item.id ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-label="Đang mở bộ slide" /> : <ChevronRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />}</button></li>)}</ul>}
        {!isLoadingHistory && history.length === 0 && !historyError && <div className="flex min-h-44 flex-col items-center justify-center gap-3 text-center"><AssistantStudioHistoryKindIcon kind="slide" /><p className="text-sm text-on-surface-variant">Chưa có bộ slide nào được lưu.</p><button type="button" onClick={startNew} className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-on-primary", focusClass)}><Plus className="size-4" aria-hidden="true" />Tạo slide</button></div>}
      </section>
    </AssistantStudioHistoryDrawer>
  </div>;
}


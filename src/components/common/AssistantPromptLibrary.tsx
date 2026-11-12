import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ChevronRight, Info, Plus, Search, Star, X } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import { StudentEmptyIllustration } from "../../modules/student-management/components/Erp/StudentEmptyIllustration";
import { AssistantStudioHistoryDrawer } from "./AssistantStudioHistoryDrawer";
import { assistantPromptCategories, type AssistantPromptTemplate } from "./assistant-prompt-library-data";
import { hasSquareBracketPlaceholders, renderPromptWithPlaceholderHighlights } from "./assistantPromptPlaceholder";
import { assistantService } from "../../services/assistantService";
import { StyledSelect } from "./StyledSelect";

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest";
type LibraryTab = "favorites" | "igen" | "mine";

const libraryTabs: Array<{ id: LibraryTab; label: string }> = [
  { id: "favorites", label: "Yêu thích" },
  { id: "igen", label: "Tạo bởi iGen" },
  { id: "mine", label: "Tạo bởi tôi" },
];

function PromptLibraryCardIcon({ className }: { className: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
    <rect x="3.75" y="2.75" width="16.5" height="18.5" rx="2.5" />
    <path d="M7.5 8.75h9m-9 5h9" />
  </svg>;
}

export function AssistantPromptLibraryAction({ open, onClick }: { open: boolean; onClick: () => void }) {
  return <button type="button" aria-label="Mở thư viện câu lệnh mẫu" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? "assistant-studio-history-drawer" : undefined} title="Thư viện câu lệnh mẫu" onClick={onClick} className={cn("assistant-composer-tool order-1 flex size-9 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-on-surface-variant hover:bg-surface-container-low hover:text-primary", focusClass)}>
    <PromptLibraryCardIcon className="size-4.5" />
  </button>;
}

export function AssistantPromptLibrary({ open, onClose, onUsePrompt }: { open: boolean; onClose: () => void; onUsePrompt: (prompt: string) => void }) {
  const titleId = useId();
  const searchId = useId();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const draftPromptHighlightRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<LibraryTab>("igen");
  const [category, setCategory] = useState<string>("Tất cả");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [templates, setTemplates] = useState<AssistantPromptTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingFavoriteIds, setPendingFavoriteIds] = useState<Set<string>>(() => new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [formError, setFormError] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftCategory, setDraftCategory] = useState<string>("Marketing");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftPromptSelectionActive, setDraftPromptSelectionActive] = useState(false);

  useEffect(() => {
    if (open && createMode) titleInputRef.current?.focus();
  }, [createMode, open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setIsLoadingTemplates(true);
    setLibraryError("");
    assistantService.promptTemplates(controller.signal)
      .then(result => {
        setTemplates(result.templates);
        setFavorites(new Set(result.favoriteIds));
      })
      .catch(error => {
        if (!controller.signal.aborted) setLibraryError(error instanceof Error ? error.message : "Không thể tải thư viện câu lệnh.");
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoadingTemplates(false); });
    return () => controller.abort();
  }, [open, reloadKey]);

  const visibleTemplates = useMemo(() => templates.filter(template => {
    const matchesTab = tab === "favorites" ? favorites.has(template.id) : tab === "igen" ? template.owner === "igen" : template.owner === "user";
    const matchesCategory = category === "Tất cả" || template.category === category;
    const query = search.trim().toLocaleLowerCase("vi-VN");
    const matchesSearch = !query || `${template.title} ${template.description} ${template.prompt} ${template.category}`.toLocaleLowerCase("vi-VN").includes(query);
    return matchesTab && matchesCategory && matchesSearch;
  }), [templates, category, favorites, search, tab]);

  async function toggleFavorite(id: string) {
    if (pendingFavoriteIds.has(id)) return;
    const wasFavorite = favorites.has(id);
    const shouldFavorite = !wasFavorite;
    setPendingFavoriteIds(current => new Set(current).add(id));
    setFavorites(current => {
      const next = new Set(current);
      if (shouldFavorite) next.add(id); else next.delete(id);
      return next;
    });
    setLibraryError("");
    try {
      const result = await assistantService.setPromptTemplateFavorite(id, shouldFavorite);
      setFavorites(current => {
        const next = new Set(current);
        if (result.favorite) next.add(id); else next.delete(id);
        return next;
      });
    } catch (error) {
      setFavorites(current => {
        const next = new Set(current);
        if (wasFavorite) next.add(id); else next.delete(id);
        return next;
      });
      setLibraryError(error instanceof Error ? error.message : "Không thể cập nhật mẫu yêu thích.");
    } finally {
      setPendingFavoriteIds(current => { const next = new Set(current); next.delete(id); return next; });
    }
  }

  function usePrompt(template: AssistantPromptTemplate) {
    onUsePrompt(template.prompt);
  }

  function startCreate() {
    setCreateMode(true);
    setFormError("");
  }

  function cancelCreate() {
    setCreateMode(false);
    setFormError("");
    window.setTimeout(() => createButtonRef.current?.focus(), 0);
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSavingTemplate) return;
    if (!draftTitle.trim() || !draftPrompt.trim()) {
      setFormError("Nhập tên và nội dung câu lệnh mẫu.");
      return;
    }
    setFormError("");
    setIsSavingTemplate(true);
    try {
      const template = await assistantService.createPromptTemplate({
        title: draftTitle.trim(),
        description: draftDescription.trim(),
        category: draftCategory,
        prompt: draftPrompt.trim(),
      });
      setTemplates(current => [template, ...current]);
      setCategory("Tất cả");
      setTab("mine");
      setSearch("");
      setDraftTitle("");
      setDraftDescription("");
      setDraftPrompt("");
      setCreateMode(false);
      window.setTimeout(() => createButtonRef.current?.focus(), 0);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Không thể lưu mẫu câu lệnh.");
    } finally {
      setIsSavingTemplate(false);
    }
  }

  const showDraftPromptHighlights = hasSquareBracketPlaceholders(draftPrompt) && !draftPromptSelectionActive;

  return <AssistantStudioHistoryDrawer open={open} title={createMode ? "Tạo mẫu câu lệnh" : "Thư viện câu lệnh mẫu"} onClose={onClose} widthClassName="sm:w-[min(820px,80vw)]" contentClassName="overflow-hidden p-0" titleClassName="text-base sm:text-lg" closeLabel="Đóng thư viện câu lệnh mẫu" headerLeading={createMode ? <button type="button" aria-label="Quay lại thư viện câu lệnh" onClick={cancelCreate} className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low", focusClass)}><ArrowLeft className="size-4" aria-hidden="true" /></button> : <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><PromptLibraryCardIcon className="size-5" /></span>} headerAction={!createMode && <button ref={createButtonRef} type="button" aria-label="Tạo mẫu câu lệnh" onClick={startCreate} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-on-primary hover:bg-primary/90 sm:px-4 sm:text-sm", focusClass)}><Plus className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Tạo mẫu câu lệnh</span><span className="sm:hidden">Tạo mẫu</span></button>}>
    <div className="flex h-full min-h-0 flex-col">
      {createMode ? <form onSubmit={saveTemplate} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
        <p className="text-pretty text-sm text-on-surface-variant">Tạo câu lệnh để dùng lại trong các cuộc trò chuyện.</p>
        <div><label htmlFor={`${titleId}-title`} className="mb-1.5 block text-sm font-medium">Tên mẫu <span aria-hidden="true" className="text-error">*</span></label><input ref={titleInputRef} id={`${titleId}-title`} required maxLength={100} value={draftTitle} onChange={event => setDraftTitle(event.target.value)} aria-invalid={Boolean(formError && !draftTitle.trim())} aria-describedby={formError && !draftTitle.trim() ? `${titleId}-form-error` : undefined} placeholder="Ví dụ: Lập kế hoạch nội dung tháng" className="min-h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none" /></div>
    <div><span className="mb-1.5 block text-sm font-medium">Danh mục</span><StyledSelect ariaLabel="Danh mục" value={draftCategory} onChange={setDraftCategory} options={assistantPromptCategories.filter(item => item !== "Tất cả").map(item => ({ value: item, label: item }))} className="h-10 w-full rounded-lg" /></div>
        <div><label htmlFor={`${titleId}-description`} className="mb-1.5 block text-sm font-medium">Mô tả ngắn</label><input id={`${titleId}-description`} maxLength={180} value={draftDescription} onChange={event => setDraftDescription(event.target.value)} placeholder="Mẫu này giúp bạn làm gì?" className="min-h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none" /></div>
        <div><label htmlFor={`${titleId}-prompt`} className="mb-1.5 block text-sm font-medium">Nội dung câu lệnh <span aria-hidden="true" className="text-error">*</span></label><div className="relative">
          {showDraftPromptHighlights && <div ref={draftPromptHighlightRef} aria-hidden="true" className="pointer-events-none absolute inset-px overflow-hidden whitespace-pre-wrap break-words px-3 py-2.5 text-sm leading-relaxed text-on-surface">{renderPromptWithPlaceholderHighlights(draftPrompt)}</div>}
          <textarea id={`${titleId}-prompt`} required maxLength={5000} rows={9} spellCheck={false} value={draftPrompt} onChange={event => setDraftPrompt(event.target.value)} onSelect={event => setDraftPromptSelectionActive(event.currentTarget.selectionStart !== event.currentTarget.selectionEnd)} onBlur={() => setDraftPromptSelectionActive(false)} onScroll={event => { if (draftPromptHighlightRef.current) draftPromptHighlightRef.current.scrollTop = event.currentTarget.scrollTop; }} aria-invalid={Boolean(formError && !draftPrompt.trim())} aria-describedby={formError ? `${titleId}-form-error` : undefined} placeholder="Viết hướng dẫn, bối cảnh và các thông tin cần điền..." className={cn("min-h-48 w-full resize-y rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm leading-relaxed text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none", showDraftPromptHighlights && "assistant-placeholder-textarea relative z-10")} />
        </div><p className="mt-1 text-right text-xs tabular-nums text-on-surface-variant">{draftPrompt.length.toLocaleString("vi-VN")} / 5.000</p></div>
        {formError && <p id={`${titleId}-form-error`} role="alert" className="rounded-lg border border-error bg-error-container px-3 py-2 text-pretty text-sm text-on-error-container">{formError}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant pt-4">
          <button type="button" onClick={cancelCreate} className={cn("min-h-10 rounded-lg border border-outline-variant px-4 text-sm font-medium text-on-surface hover:bg-surface-container-low", focusClass)}>Hủy</button>
          <button type="submit" disabled={isSavingTemplate} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60", focusClass)}><Plus className="size-4" aria-hidden="true" />{isSavingTemplate ? "Đang lưu..." : "Lưu mẫu"}</button>
        </div>
      </form> : <>
        <nav aria-label="Bộ lọc thư viện" className="shrink-0 overflow-x-auto px-4 py-3 sm:px-6">
          <div className="inline-flex w-max gap-1 rounded-xl bg-surface-container-low p-1">
            {libraryTabs.map(item => <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => { setTab(item.id); setCategory("Tất cả"); setExpandedId(null); }} className={cn("shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-lowest", tab === item.id && "bg-surface-container-lowest text-primary shadow-sm", focusClass)}>{item.label}{item.id === "favorites" && <span className="ml-1 tabular-nums">{favorites.size}</span>}</button>)}
          </div>
        </nav>
        <div className="shrink-0 px-4 py-3 sm:px-6">
          <label htmlFor={searchId} className="sr-only">Tìm kiếm mẫu câu lệnh</label>
          <div className="flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 focus-within:border-primary">
            <Search className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
            <input id={searchId} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm kiếm mẫu câu lệnh" className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none" />
            {search && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setSearch("")} className={cn("grid size-7 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-low", focusClass)}><X className="size-4" aria-hidden="true" /></button>}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[11rem_minmax(0,1fr)]">
          <nav aria-label="Danh mục câu lệnh" className="flex shrink-0 gap-1 overflow-x-auto border-b border-outline-variant px-3 py-2 md:block md:overflow-y-auto md:border-b-0 md:border-r md:px-3 md:py-3">
            {assistantPromptCategories.map(item => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={cn("shrink-0 rounded-lg px-3 py-2 text-left text-sm text-on-surface-variant hover:bg-surface-container-low md:mb-1 md:block md:w-full", category === item && "bg-primary/5 font-medium text-primary md:border-l-2 md:border-primary md:rounded-l-none", focusClass)}>{item}</button>)}
          </nav>

          <section aria-label="Mẫu câu lệnh" aria-busy={isLoadingTemplates} className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
            <p className="sticky top-0 z-10 bg-surface-container-lowest py-2 text-xs text-on-surface-variant">{tab === "igen" ? "Mẫu được biên soạn bởi iGen" : tab === "mine" ? "Mẫu do bạn tạo" : "Các mẫu đã đánh dấu yêu thích"} <span className="tabular-nums">· {visibleTemplates.length}</span></p>
            {libraryError && <div role="alert" className="my-2 flex items-center justify-between gap-3 rounded-lg border border-error/40 bg-error-container px-3 py-2 text-sm text-on-error-container"><span>{libraryError}</span><button type="button" onClick={() => setReloadKey(current => current + 1)} className={cn("shrink-0 rounded-md px-2 py-1 font-medium underline-offset-2 hover:underline", focusClass)}>Thử lại</button></div>}
            {isLoadingTemplates ? <p role="status" className="py-8 text-center text-sm text-on-surface-variant">Đang tải mẫu câu lệnh...</p> : visibleTemplates.length > 0 ? <ul className="divide-y divide-outline-variant">
              {visibleTemplates.map(template => <li key={template.id} className="py-2">
                <div className="flex min-w-0 items-start gap-2">
                  <button type="button" aria-label={`Dùng mẫu: ${template.title}`} onClick={() => usePrompt(template)} title={`Dùng mẫu: ${template.title}`} className={cn("min-w-0 flex-1 rounded-lg py-1 text-left hover:text-primary", focusClass)}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate text-sm font-semibold text-on-surface">{template.title}</span>
                      <span className="shrink-0 rounded-full bg-surface-container-low px-2 py-0.5 text-xs text-on-surface-variant">{template.category}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm leading-5 text-on-surface-variant">{template.description}</span>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
                    <button type="button" disabled={pendingFavoriteIds.has(template.id)} aria-label={favorites.has(template.id) ? `Bỏ yêu thích ${template.title}` : `Thêm yêu thích ${template.title}`} aria-pressed={favorites.has(template.id)} title={favorites.has(template.id) ? "Bỏ yêu thích" : "Thêm vào yêu thích"} onClick={() => void toggleFavorite(template.id)} className={cn("grid size-9 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-primary disabled:opacity-60", favorites.has(template.id) && "text-primary", focusClass)}><Star className="size-4" fill={favorites.has(template.id) ? "currentColor" : "none"} aria-hidden="true" /></button>
                    <button type="button" aria-label={`${expandedId === template.id ? "Ẩn" : "Xem"} chi tiết ${template.title}`} aria-expanded={expandedId === template.id} aria-controls={`${titleId}-detail-${template.id}`} title="Xem chi tiết" onClick={() => setExpandedId(current => current === template.id ? null : template.id)} className={cn("grid size-9 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-primary", expandedId === template.id && "bg-surface-container-low text-primary", focusClass)}><Info className="size-4" aria-hidden="true" /></button>
                  </div>
                </div>
                <div id={`${titleId}-detail-${template.id}`} hidden={expandedId !== template.id} className="mt-3 rounded-xl border border-outline-variant bg-surface-container-low p-3 sm:p-4">
                  <h3 className="text-balance text-sm font-semibold text-on-surface">Nội dung mẫu</h3>
                  <p className="mt-2 whitespace-pre-wrap break-words text-pretty text-sm leading-relaxed text-on-surface-variant">{template.prompt}</p>
                  <button type="button" onClick={() => usePrompt(template)} className={cn("mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-on-primary hover:bg-primary/90", focusClass)}>Dùng câu lệnh này<ChevronRight className="size-4" aria-hidden="true" /></button>
                </div>
              </li>)}
            </ul> : <div className="flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center">
              <StudentEmptyIllustration kind="generic" />
              <h3 className="mt-4 text-balance text-sm font-semibold text-on-surface">{search ? "Không tìm thấy mẫu phù hợp" : tab === "favorites" ? "Chưa có mẫu yêu thích" : tab === "mine" ? "Bạn chưa tạo mẫu nào" : "Danh mục này chưa có mẫu"}</h3>
              <p className="mt-1 max-w-sm text-pretty text-sm text-on-surface-variant">{search ? "Thử từ khóa hoặc danh mục khác." : tab === "mine" ? "Tạo mẫu câu lệnh để lưu lại cách làm bạn thường dùng." : "Chọn danh mục khác hoặc tạo câu lệnh của riêng bạn."}</p>
              {(search || category !== "Tất cả") && <button type="button" onClick={() => { setSearch(""); setCategory("Tất cả"); }} className={cn("mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 text-sm font-medium text-on-surface hover:bg-surface-container-low", focusClass)}>Xóa bộ lọc</button>}
              {!search && category === "Tất cả" && tab === "favorites" && <button type="button" onClick={() => setTab("igen")} className={cn("mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 text-sm font-medium text-on-surface hover:bg-surface-container-low", focusClass)}>Xem mẫu iGen</button>}
            </div>}
          </section>
        </div>
      </>}
    </div>
  </AssistantStudioHistoryDrawer>;
}

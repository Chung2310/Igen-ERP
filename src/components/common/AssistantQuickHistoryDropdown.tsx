import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, LoaderCircle, Search } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import { assistantService, type AssistantConversationSummary } from "../../services/assistantService";
import {
  combineAssistantStudioHistory,
  listAssistantStudioCreationHistory,
  type AssistantStudioHistoryEntry,
} from "../../services/assistantStudioHistory";
import { getAssistantSpeechHistoryUserId, listAssistantSpeechHistory } from "../../services/assistantSpeechHistory";
import type { AssistantProject } from "./assistant-project-data";
import { AssistantMoveToProjectMenu } from "./AssistantMoveToProjectMenu";

const focusClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const MAX_ITEMS = 30;

function normalizeHistorySearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLocaleLowerCase("vi").trim();
}

type UnifiedItem =
  | { type: "conversation"; data: AssistantConversationSummary; date: string }
  | { type: "studio"; data: AssistantStudioHistoryEntry; date: string };

export interface AssistantQuickHistoryDropdownProps {
  branchId?: string;
  onOpenConversation: (conversation: AssistantConversationSummary) => void;
  onOpenStudio: (item: AssistantStudioHistoryEntry) => void;
  onOpenHistory: (search?: string) => void;
  compactHistory?: boolean;
  onHistoryScrollDown?: () => void;
  projects: AssistantProject[];
  projectsLocked?: boolean;
  assignedConversationIds: ReadonlySet<string>;
  onMoveConversation: (conversation: AssistantConversationSummary, projectId: string) => void;
  onOpenProjects: () => void;
}

export function AssistantQuickHistoryDropdown({
  branchId,
  onOpenConversation,
  onOpenStudio,
  onOpenHistory,
  compactHistory = false,
  onHistoryScrollDown,
  projects,
  projectsLocked,
  assignedConversationIds,
  onMoveConversation,
  onOpenProjects,
}: AssistantQuickHistoryDropdownProps) {
  const [open, setOpen] = useState(true);
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UnifiedItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    setError("");
    try {
      const userId = getAssistantSpeechHistoryUserId();
      const [convPage, charts, slides, transcripts, creations, speech] = await Promise.allSettled([
        assistantService.conversations(undefined, undefined, branchId),
        assistantService.studioCharts(),
        assistantService.studioSlideDecks(),
        assistantService.studioTranscripts(),
        listAssistantStudioCreationHistory(userId),
        listAssistantSpeechHistory(userId),
      ]);

      const conversations: UnifiedItem[] =
        convPage.status === "fulfilled"
          ? convPage.value.items.map(c => ({ type: "conversation" as const, data: c, date: c.updatedAt }))
          : [];

      const studioItems: UnifiedItem[] = combineAssistantStudioHistory({
        charts: charts.status === "fulfilled" ? charts.value : [],
        slides: slides.status === "fulfilled" ? slides.value : [],
        transcripts: transcripts.status === "fulfilled" ? transcripts.value : [],
        creations: creations.status === "fulfilled" ? creations.value : [],
        speech: speech.status === "fulfilled" ? speech.value : [],
      }).map(s => ({ type: "studio" as const, data: s, date: s.createdAt }));

      const merged = [...conversations, ...studioItems]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, MAX_ITEMS);

      setItems(merged);
    } catch {
      setError("Không tải được lịch sử.");
      loadedRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const searchTerm = searchQuery.trim();
  useEffect(() => {
    setSearchResults(null);
    setSearchError("");
    if (searchTerm.length < 2) {
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    setSearching(true);
    const timeout = window.setTimeout(() => {
      void assistantService.conversations(undefined, controller.signal, branchId, searchTerm)
        .then(page => {
          if (!controller.signal.aborted) setSearchResults(page.items.map(data => ({ type: "conversation" as const, data, date: data.updatedAt })));
        })
        .catch(cause => {
          if (!controller.signal.aborted) setSearchError((cause as Error).message || "Không tìm được lịch sử.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [branchId, searchTerm]);

  function toggle() {
    if (!open) { setOpen(true); void load(); }
    else setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      const inDropdown = containerRef.current?.contains(target);
      const inTrigger = triggerRef.current?.contains(target);
      if (!inDropdown && !inTrigger && !(target instanceof Element && target.closest("[data-assistant-project-menu]"))) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function handleSelect(item: UnifiedItem) {
    setOpen(false);
    if (item.type === "conversation") onOpenConversation(item.data);
    else onOpenStudio(item.data);
  }

  function getTitle(item: UnifiedItem): string {
    if (item.type === "conversation") return item.data.title || "Chưa có tiêu đề";
    return item.data.title || item.data.label;
  }

  const normalizedSearch = normalizeHistorySearch(searchTerm);
  const studioMatches = items.filter(item => item.type === "studio" && normalizeHistorySearch(`${getTitle(item)} ${item.data.label}`).includes(normalizedSearch));
  const matchingItems = searchTerm.length >= 2
    ? [...(searchResults || []), ...studioMatches]
    : items.filter(item => !normalizedSearch || normalizeHistorySearch(`${getTitle(item)} ${item.type === "conversation" ? item.data.preview : item.data.label}`).includes(normalizedSearch));
  const visibleItems = matchingItems
    .filter(item => item.type !== "conversation" || !assignedConversationIds.has(item.data.conversationId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_ITEMS);
  const searchingAll = searchTerm.length >= 2;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Xem nhanh lịch sử"
        title="Xem nhanh lịch sử"
        aria-expanded={open}
          aria-controls={open ? "assistant-quick-history-list" : undefined}
        onClick={toggle}
        className={cn(
          "flex size-7 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface",
          focusClass
        )}
      >
        <ChevronDown
          className={cn("size-3.5 transition-transform duration-150", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          ref={containerRef}
          id="assistant-quick-history-list"
          role="region"
          aria-label="Lịch sử gần nhất"
          aria-busy={loading || searching}
          className="absolute left-0 z-50 w-full overflow-hidden bg-surface-container-lowest py-1"
          style={{ top: "calc(100% + 6px)" }}
        >
          <label className="flex shrink-0 items-center gap-2 border-b border-outline-variant bg-surface-container-lowest px-3 py-2">
            <Search className="size-3.5 shrink-0 text-on-surface-variant" aria-hidden="true" />
            <span className="sr-only">Tìm trong lịch sử trò chuyện</span>
            <input
              type="search"
              value={searchQuery}
              maxLength={120}
              onChange={event => setSearchQuery(event.currentTarget.value)}
              placeholder="Tìm lịch sử"
              className={cn("min-w-0 flex-1 rounded-sm bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant", focusClass)}
            />
          </label>
          <div
            onWheel={event => { if (event.deltaY > 0) onHistoryScrollDown?.(); }}
            className={cn("max-h-40 overflow-y-auto overscroll-contain", compactHistory && "max-h-56")}
          >
            {loading && !searchingAll && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-on-surface-variant">
                <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Đang tải…
              </div>
            )}
            {error && !loading && (
              <p className="px-3 py-2 text-xs text-error">{error}</p>
            )}
            {searching && <p role="status" className="px-3 py-2 text-xs text-on-surface-variant">Đang tìm lịch sử…</p>}
            {searchError && !searching && <p role="alert" className="px-3 py-2 text-xs text-error">{searchError}</p>}
            {searchTerm.length === 1 && <p role="status" className="px-3 py-2 text-xs text-on-surface-variant">Nhập thêm ký tự để tìm toàn bộ lịch sử.</p>}
            {!loading && !searching && !error && !searchError && searchTerm.length !== 1 && visibleItems.length === 0 && (
              <p className="px-3 py-2 text-xs text-on-surface-variant">{searchTerm ? "Không tìm thấy lịch sử phù hợp." : "Chưa có lịch sử nào."}</p>
            )}
            {!loading && !searching && visibleItems.length > 0 && (
              <ul>
                {visibleItems.map((item, index) => {
                  const key = item.type === "conversation" ? item.data.conversationId : item.data.id;
                  return (
                    <li key={`${item.type}-${key}-${index}`} className="flex items-center">
                      <button
                        type="button"
                        onClick={() => handleSelect(item)}
                        className={cn(
                          "min-w-0 flex-1 truncate px-3 py-1.5 text-left text-sm text-on-surface hover:bg-surface-container-low hover:text-primary",
                          focusClass
                        )}
                      >
                        {getTitle(item)}
                      </button>
                      {item.type === "conversation" && <AssistantMoveToProjectMenu conversation={item.data} projects={projects} projectsLocked={projectsLocked} onMove={onMoveConversation} onOpenProjects={() => { setOpen(false); onOpenProjects(); }} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); onOpenHistory(searchTerm); }}
            className={cn("mt-1 w-full shrink-0 border-t border-outline-variant px-3 py-2 text-left text-xs font-medium text-primary hover:bg-surface-container-low", focusClass)}
          >
            Mở toàn bộ lịch sử
          </button>
        </div>
      )}
    </>
  );
}

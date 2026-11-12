import { useEffect, useRef, useState } from "react";
import { ChevronDown, LoaderCircle } from "lucide-react";
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

const MAX_ITEMS = 20;

type UnifiedItem =
  | { type: "conversation"; data: AssistantConversationSummary; date: string }
  | { type: "studio"; data: AssistantStudioHistoryEntry; date: string };

export interface AssistantQuickHistoryDropdownProps {
  branchId?: string;
  onOpenConversation: (conversation: AssistantConversationSummary) => void;
  onOpenStudio: (item: AssistantStudioHistoryEntry) => void;
  onOpenHistory: () => void;
  projects: AssistantProject[];
  assignedConversationIds: ReadonlySet<string>;
  onMoveConversation: (conversation: AssistantConversationSummary, projectId: string) => void;
  onOpenProjects: () => void;
}

export function AssistantQuickHistoryDropdown({
  branchId,
  onOpenConversation,
  onOpenStudio,
  onOpenHistory,
  projects,
  assignedConversationIds,
  onMoveConversation,
  onOpenProjects,
}: AssistantQuickHistoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const loadedRef = useRef(false);

  async function load() {
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
  }

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
          role="group"
          aria-label="Lịch sử gần nhất"
          className="absolute left-0 z-50 w-full overflow-y-auto bg-surface-container-lowest py-1"
          style={{ top: "calc(100% + 6px)", maxHeight: "16rem" }}
        >
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-on-surface-variant">
              <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Đang tải…
            </div>
          )}
          {error && !loading && (
            <p className="px-3 py-2 text-xs text-error">{error}</p>
          )}
          {!loading && !error && items.filter(item => item.type !== "conversation" || !assignedConversationIds.has(item.data.conversationId)).length === 0 && (
            <p className="px-3 py-2 text-xs text-on-surface-variant">Chưa có lịch sử nào.</p>
          )}
          {!loading && items.length > 0 && (
            <ul>
              {items.filter(item => item.type !== "conversation" || !assignedConversationIds.has(item.data.conversationId)).map((item, index) => {
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
                    {item.type === "conversation" && <AssistantMoveToProjectMenu conversation={item.data} projects={projects} onMove={onMoveConversation} onOpenProjects={() => { setOpen(false); onOpenProjects(); }} />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

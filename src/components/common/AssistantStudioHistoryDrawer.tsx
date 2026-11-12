import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AudioLines, BarChart3, FileAudio, FileText, History, Image, Network, Presentation, WandSparkles, X } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";

export type AssistantStudioHistoryKind = "image" | "edit-image" | "infographic" | "chart" | "mindmap" | "slide" | "speech" | "transcription";

const historyKinds: Record<AssistantStudioHistoryKind, { icon: typeof History; color: string }> = {
  image: { icon: Image, color: "bg-pink-500" },
  "edit-image": { icon: WandSparkles, color: "bg-violet-500" },
  infographic: { icon: FileText, color: "bg-orange-500" },
  chart: { icon: BarChart3, color: "bg-blue-500" },
  mindmap: { icon: Network, color: "bg-teal-500" },
  slide: { icon: Presentation, color: "bg-indigo-500" },
  speech: { icon: AudioLines, color: "bg-cyan-600" },
  transcription: { icon: FileAudio, color: "bg-emerald-600" },
};

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest";

export function AssistantStudioHistoryAction({ open, onClick }: { open: boolean; onClick: () => void }) {
  return <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? "assistant-studio-history-drawer" : undefined} onClick={onClick} className={cn("inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 text-sm font-medium text-on-surface hover:bg-surface-container-low", focusClass)}>
    <History className="size-4 text-on-surface-variant" aria-hidden="true" />
    <span>Lịch sử</span>
  </button>;
}

export function AssistantStudioHistoryKindIcon({ kind, className }: { kind: AssistantStudioHistoryKind; className?: string }) {
  const { icon: Icon, color } = historyKinds[kind];
  return <span aria-hidden="true" className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-white shadow-xs", color, className)}><Icon className="size-5" strokeWidth={2.25} /></span>;
}

export function AssistantStudioHistoryDrawer({ open, title, onClose, children, widthClassName, contentClassName, headerLeading, headerAction, titleClassName, closeLabel = "Đóng lịch sử" }: { open: boolean; title: string; onClose: () => void; children: ReactNode; widthClassName?: string; contentClassName?: string; headerLeading?: ReactNode; headerAction?: ReactNode; titleClassName?: string; closeLabel?: string }) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  const transitionDuration = 200;

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    let timer: number;
    if (open) {
      setMounted(true);
      timer = window.setTimeout(() => setVisible(true), 16);
      return () => window.clearTimeout(timer);
    }

    setVisible(false);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setMounted(false);
      return;
    }
    timer = window.setTimeout(() => setMounted(false), transitionDuration);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!mounted || !panel) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) {
        event.preventDefault();
        first.focus();
      }
    }

    panel.addEventListener("keydown", onKeyDown);
    return () => {
      panel.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [mounted]);

  if (!mounted) return null;

  return <div className={cn("fixed inset-0 z-50 bg-on-surface/40 transition-opacity duration-200 ease-out motion-reduce:transition-none", visible ? "opacity-100" : "opacity-0")} onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseRef.current(); }}>
    <aside ref={panelRef} id="assistant-studio-history-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={cn("absolute inset-y-0 right-0 flex w-full max-w-full flex-col border-l border-outline-variant bg-surface-container-lowest text-on-surface shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none sm:w-96", widthClassName, visible ? "translate-x-0" : "translate-x-full")}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex min-w-0 items-center gap-3">
          {headerLeading ?? <span className="grid size-10 shrink-0 place-items-center text-on-surface-variant"><History className="size-5" aria-hidden="true" /></span>}
          <h2 id={titleId} className={cn("truncate text-balance text-sm font-semibold", titleClassName)}>{title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {headerAction}
          <button ref={closeRef} type="button" aria-label={closeLabel} title={closeLabel} onClick={onClose} className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface", focusClass)}><X className="size-4" aria-hidden="true" /></button>
        </div>
      </header>
      <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]", contentClassName)}>{children}</div>
    </aside>
  </div>;
}

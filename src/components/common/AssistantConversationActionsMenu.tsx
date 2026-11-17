import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, FolderInput, Lock, MoreHorizontal, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import type { AssistantConversationSummary } from "../../services/assistantService";
import type { AssistantProject } from "./assistant-project-data";
import { AssistantProjectIcon } from "./AssistantProjectIcon";

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest";

export function AssistantConversationActionsMenu({ conversation, projects, projectsLocked = false, isFavorite = false, onMove, onOpenProjects, onToggleFavorite, onRename, onDelete }: {
  conversation: AssistantConversationSummary;
  projects: AssistantProject[];
  projectsLocked?: boolean;
  isFavorite?: boolean;
  onMove: (conversation: AssistantConversationSummary, projectId: string) => void;
  onOpenProjects: () => void;
  onToggleFavorite?: (conversation: AssistantConversationSummary, favorite: boolean) => void;
  onRename?: (conversation: AssistantConversationSummary, title: string) => void;
  onDelete?: (conversation: AssistantConversationSummary) => void;
}) {
  const [open, setOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState(conversation.title);
  const [renameError, setRenameError] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameDialogRef = useRef<HTMLDialogElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameTitleId = useId();
  const renameInputId = useId();
  const renameErrorId = useId();
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, [open]);

  useEffect(() => {
    if (!renameOpen) return;
    const dialog = renameDialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    renameInputRef.current?.focus();
    return () => { if (dialog.open && typeof dialog.close === "function") dialog.close(); };
  }, [renameOpen]);

  function closeMenu() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function toggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = Math.min(320, window.innerHeight - 16);
      setPosition({
        top: Math.max(8, Math.min(rect.top, window.innerHeight - menuHeight - 8)),
        left: Math.max(8, Math.min(rect.right + 4, window.innerWidth - 232)),
      });
    }
    setOpen(value => !value);
  }

  function beginRename() {
    setRenameTitle(conversation.title);
    setRenameError("");
    setOpen(false);
    setRenameOpen(true);
  }

  function closeRename() {
    setRenameOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function saveRename(event: FormEvent) {
    event.preventDefault();
    const title = renameTitle.trim();
    if (!title) { setRenameError("Nhập tên cuộc trò chuyện."); return; }
    onRename?.(conversation, title);
    closeRename();
  }

  return <>
    <button ref={triggerRef} type="button" aria-label={`Tùy chọn cuộc trò chuyện ${conversation.title}`} aria-haspopup="true" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={toggle} className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low", focusClass)}>
      <MoreHorizontal className="size-4" aria-hidden="true" />
    </button>
    {open && createPortal(<div ref={menuRef} id={menuId} data-assistant-conversation-menu role="group" aria-label={`Các thao tác cho ${conversation.title}`} style={{ top: position.top, left: position.left, maxHeight: Math.min(320, window.innerHeight - 16) }} className="fixed z-50 w-56 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest p-1 text-on-surface shadow-md">
      {onToggleFavorite && <button type="button" aria-pressed={isFavorite} onClick={() => { onToggleFavorite(conversation, !isFavorite); closeMenu(); }} className={cn("flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-surface-container-low", focusClass)}>
        <Star className={cn("size-4 shrink-0", isFavorite && "fill-tertiary text-tertiary")} aria-hidden="true" />{isFavorite ? "Bỏ yêu thích" : "Yêu thích"}
      </button>}
      {onRename && <button type="button" onClick={beginRename} className={cn("flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-surface-container-low", focusClass)}>
        <Pencil className="size-4 shrink-0" aria-hidden="true" />Sửa tên
      </button>}
      <details className="group">
        <summary className={cn("flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md px-2 text-sm hover:bg-surface-container-low [&::-webkit-details-marker]:hidden", focusClass)}>
          <FolderInput className="size-4 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">Di chuyển sang dự án</span><ChevronRight className="size-4 shrink-0" aria-hidden="true" />
        </summary>
        <div className="ml-4 border-l border-outline-variant py-1 pl-1">
          <button type="button" disabled={projectsLocked} title={projectsLocked ? "Tab Dự án đang bị khóa" : undefined} onClick={() => { closeMenu(); onOpenProjects(); }} className={cn("flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50", focusClass)}>
            <Plus className="size-4 shrink-0" aria-hidden="true" />Dự án mới{projectsLocked && <Lock className="ml-auto size-3.5" aria-hidden="true" />}
          </button>
          {projects.length === 0 ? <p className="px-2 py-2 text-center text-xs text-on-surface-variant">Chưa có dự án nào</p> : projects.map(project => <button key={project.id} type="button" onClick={() => { closeMenu(); onMove(conversation, project.id); }} className={cn("flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-surface-container-low", focusClass)}>
            <AssistantProjectIcon icon={project.icon} tone={project.tone} /><span className="truncate">{project.name}</span>
          </button>)}
        </div>
      </details>
      {onDelete && <button type="button" onClick={() => { closeMenu(); onDelete(conversation); }} className={cn("mt-1 flex min-h-9 w-full items-center gap-2 rounded-md border-t border-outline-variant px-2 pt-1 text-left text-sm text-error hover:bg-error-container", focusClass)}>
        <Trash2 className="size-4 shrink-0" aria-hidden="true" />Xóa
      </button>}
    </div>, document.body)}
    {renameOpen && <dialog ref={renameDialogRef} aria-labelledby={renameTitleId} onCancel={event => { event.preventDefault(); closeRename(); }} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-0 text-on-surface shadow-xl backdrop:bg-on-surface/40">
      <div className="border-b border-outline-variant px-5 py-4"><h2 id={renameTitleId} className="text-balance text-sm font-semibold">Sửa tên cuộc trò chuyện</h2></div>
      <form onSubmit={saveRename} className="p-5">
        <label htmlFor={renameInputId} className="block text-sm font-medium">Tên cuộc trò chuyện</label>
        <input ref={renameInputRef} id={renameInputId} value={renameTitle} onChange={event => { setRenameTitle(event.target.value); setRenameError(""); }} maxLength={100} autoComplete="off" aria-invalid={Boolean(renameError)} aria-describedby={renameError ? renameErrorId : undefined} className="mt-2 min-h-10 w-full rounded-lg border border-outline-variant px-3 text-sm focus:border-primary focus:outline-none" />
        {renameError && <p id={renameErrorId} role="alert" className="mt-2 text-sm text-error">{renameError}</p>}
        <div className="mt-6 flex justify-end gap-2 border-t border-outline-variant pt-4">
          <button type="button" onClick={closeRename} className={cn("min-h-9 rounded-lg border border-outline-variant px-4 text-sm", focusClass)}>Hủy</button>
          <button type="submit" className={cn("min-h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary", focusClass)}>Lưu</button>
        </div>
      </form>
    </dialog>}
  </>;
}

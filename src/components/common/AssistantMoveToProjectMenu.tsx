import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FolderInput, Lock, MoreHorizontal } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import type { AssistantConversationSummary } from "../../services/assistantService";
import type { AssistantProject } from "./assistant-project-data";
import { AssistantProjectIcon } from "./AssistantProjectIcon";

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest";

export function AssistantMoveToProjectMenu({ conversation, projects, projectsLocked = false, onMove, onOpenProjects }: {
  conversation: AssistantConversationSummary;
  projects: AssistantProject[];
  projectsLocked?: boolean;
  onMove: (conversation: AssistantConversationSummary, projectId: string) => void;
  onOpenProjects: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!triggerRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, [open]);
  function toggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({ top: Math.min(rect.top, window.innerHeight - Math.min(240, 80 + projects.length * 36)), left: Math.max(8, Math.min(rect.right + 4, window.innerWidth - 220)) });
    }
    setOpen(value => !value);
  }
  return <>
    <button ref={triggerRef} type="button" aria-label={`Tùy chọn hội thoại ${conversation.title}`} aria-expanded={open} aria-controls={open ? `assistant-move-project-${conversation.conversationId}` : undefined} onClick={toggle} className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low", focusClass)}><MoreHorizontal className="size-4" aria-hidden="true" /></button>
    {open && createPortal(<div ref={menuRef} id={`assistant-move-project-${conversation.conversationId}`} data-assistant-project-menu role="group" aria-label="Di chuyển sang dự án" style={{ top: position.top, left: position.left }} className="fixed z-50 max-h-64 w-52 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest p-1 text-on-surface shadow-md">
      <p className="px-2 py-1 text-xs font-medium text-on-surface-variant">Di chuyển sang dự án</p>
      <button type="button" disabled={projectsLocked} title={projectsLocked ? "Tab Dự án đang bị khóa" : undefined} onClick={() => { setOpen(false); onOpenProjects(); }} className={cn("flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50", focusClass)}><FolderInput className="size-4" aria-hidden="true" />Dự án mới{projectsLocked && <Lock className="ml-auto size-3.5" aria-hidden="true" />}</button>
      {projects.map(project => <button key={project.id} type="button" onClick={() => { onMove(conversation, project.id); setOpen(false); }} className={cn("flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-surface-container-low", focusClass)}><AssistantProjectIcon icon={project.icon} tone={project.tone} /><span className="truncate">{project.name}</span></button>)}
    </div>, document.body)}
  </>;
}

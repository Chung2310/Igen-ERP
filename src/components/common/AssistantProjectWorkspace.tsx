import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { ChevronRight, CornerUpRight, Download, FileText, Folder, FolderInput, LoaderCircle, MoreHorizontal, Paperclip, Pencil, Plus, Search, SlidersHorizontal, Star, Trash2, X } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import { assistantService } from "../../services/assistantService";
import { assistantPageCreateButtonClass } from "./assistantPageCreateButton";
import { ConfirmDialog } from "./ConfirmDialog";
import { AssistantProjectIcon, projectIconOptions } from "./AssistantProjectIcon";
import type { AssistantProject, AssistantProjectConversation, AssistantProjectFile, ProjectIcon, ProjectTone } from "./assistant-project-data";

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest";
const toneClasses: Record<ProjectTone, string> = {
  primary: "bg-primary", secondary: "bg-secondary", tertiary: "bg-tertiary", error: "bg-error",
};
const toneLabels: Record<ProjectTone, string> = { primary: "Xanh", secondary: "Xám xanh", tertiary: "Cam", error: "Đỏ" };

function ProjectDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    dialog.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea")?.focus();
    return () => { if (dialog.open && typeof dialog.close === "function") dialog.close(); previousFocus?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-0 text-on-surface shadow-xl backdrop:bg-on-surface/40">
    <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4"><h2 id={titleId} className="text-balance text-sm font-semibold">{title}</h2><button type="button" onClick={onClose} aria-label="Đóng" className={cn("grid size-9 place-items-center rounded-lg hover:bg-surface-container-low", focusClass)}><X className="size-4" aria-hidden="true" /></button></div>{children}
  </dialog>;
}

export function AssistantProjectWorkspace({ projects, onProjectsChange, selectedId, onSelect, createRequest = 0, onCreateRequestHandled, onOpenConversation, onDeleteConversation, composer, onUploadFile, branchId }: {
  projects: AssistantProject[];
  onProjectsChange: (projects: AssistantProject[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  createRequest?: number;
  onCreateRequestHandled?: () => void;
  onOpenConversation?: (id: string) => void;
  onDeleteConversation?: (conversation: AssistantProjectConversation) => void;
  composer?: ReactNode;
  onUploadFile?: (projectId: string, file: File) => Promise<AssistantProjectFile>;
  branchId?: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const [detailTab, setDetailTab] = useState<"conversations" | "files">("conversations");
  const [dialog, setDialog] = useState<"create" | "edit" | "instructions" | "files" | "renameConversation" | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<ProjectIcon>("folder");
  const [tone, setTone] = useState<ProjectTone>("primary");
  const [instructions, setInstructions] = useState("");
  const [fileQuery, setFileQuery] = useState("");
  const [fileError, setFileError] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [nameError, setNameError] = useState("");
  const [notice, setNotice] = useState<{ projectId: string; text: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssistantProject | null>(null);
  const [renameTarget, setRenameTarget] = useState<AssistantProjectConversation | null>(null);
  const [conversationName, setConversationName] = useState("");
  const [conversationNameError, setConversationNameError] = useState("");
  useEffect(() => {
    const closeOutsideMenu = (event: PointerEvent) => {
      document.querySelectorAll<HTMLDetailsElement>("details[data-project-conversation-menu][open]").forEach(menu => {
        if (event.target instanceof Node && !menu.contains(event.target)) menu.removeAttribute("open");
      });
    };
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const menus = document.querySelectorAll<HTMLDetailsElement>("details[data-project-conversation-menu][open]");
      if (menus.length === 0) return;
      event.preventDefault();
      menus.forEach(menu => {
        menu.querySelectorAll("details[open]").forEach(item => item.removeAttribute("open"));
        menu.removeAttribute("open");
      });
      menus[menus.length - 1]?.querySelector<HTMLElement>("summary")?.focus();
    };
    document.addEventListener("pointerdown", closeOutsideMenu);
    document.addEventListener("keydown", closeMenuOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOutsideMenu); document.removeEventListener("keydown", closeMenuOnEscape); };
  }, []);
  useEffect(() => {
    if (createRequest < 1) return;
    setName(""); setIcon("folder"); setTone("primary"); setNameError(""); setDialog("create"); onCreateRequestHandled?.();
  }, [createRequest]);
  const selected = projects.find(project => project.id === selectedId) ?? null;
  const visible = projects.filter(project => project.name.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const files = selected?.files.filter(file => file.name.toLocaleLowerCase("vi").includes(fileQuery.trim().toLocaleLowerCase("vi"))) ?? [];
  const projectConversations = selected?.conversations.slice().sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)) ?? [];

  function update(id: string, change: (project: AssistantProject) => AssistantProject) {
    onProjectsChange(projects.map(project => project.id === id ? change(project) : project));
  }
  function openCreate() { setName(""); setIcon("folder"); setTone("primary"); setNameError(""); setDialog("create"); }
  function openEdit(project: AssistantProject) { onSelect(project.id); setName(project.name); setIcon(project.icon); setTone(project.tone); setNameError(""); setDialog("edit"); }
  function openConversationRename(conversation: AssistantProjectConversation) { setRenameTarget(conversation); setConversationName(conversation.title); setConversationNameError(""); setDialog("renameConversation"); }
  function saveConversationName(event: FormEvent) {
    event.preventDefault();
    if (!selected || !renameTarget) return;
    const nextName = conversationName.trim();
    if (!nextName) { setConversationNameError("Nhập tên cuộc trò chuyện."); return; }
    update(selected.id, project => ({ ...project, conversations: project.conversations.map(item => item.id === renameTarget.id ? { ...item, title: nextName } : item) }));
    setDialog(null);
    setRenameTarget(null);
  }
  function moveConversation(conversation: AssistantProjectConversation, targetProjectId: string) {
    if (!selected || !conversation.sourceConversationId) return;
    onProjectsChange(projects.map(project => {
      if (project.id === selected.id) return { ...project, conversations: project.conversations.filter(item => item.id !== conversation.id) };
      if (project.id === targetProjectId) return { ...project, conversations: [{ ...conversation, id: crypto.randomUUID() }, ...project.conversations.filter(item => item.sourceConversationId !== conversation.sourceConversationId)] };
      return project;
    }));
  }
  function closeConversationMenu(event: MouseEvent<HTMLButtonElement>) {
    const menu = event.currentTarget.closest("details[data-project-conversation-menu]");
    menu?.querySelectorAll("details[open]").forEach(item => item.removeAttribute("open"));
    menu?.removeAttribute("open");
    menu?.querySelector<HTMLElement>("summary")?.focus();
  }
  function saveProject(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setNameError("Nhập tên dự án."); return; }
    if (dialog === "edit" && selected) update(selected.id, project => ({ ...project, name: name.trim(), icon, tone }));
    else {
      const created: AssistantProject = { id: crypto.randomUUID(), name: name.trim(), icon, tone, favorite: false, instructions: "", model: "iGenAI", conversations: [], files: [], createdAt: new Date().toISOString() };
      onProjectsChange([created, ...projects]); onSelect(created.id);
    }
    setDialog(null);
  }
  async function addFiles(fileList: FileList | null) {
    if (!selected || !fileList?.length) return;
    const sourceFiles = Array.from(fileList);
    if (sourceFiles.some(file => file.size > 15 * 1024 * 1024)) { setFileError("Mỗi tệp phải nhỏ hơn 15 MB."); return; }
    if (sourceFiles.some(file => !/\.(pdf|docx|txt)$/i.test(file.name))) { setFileError("Chỉ hỗ trợ tệp PDF, DOCX và TXT."); return; }
    if (selected.files.length + sourceFiles.length > 100) { setFileError("Mỗi dự án chỉ hỗ trợ tối đa 100 tệp."); return; }
    if (!onUploadFile) { setFileError("Chưa kết nối được dịch vụ tải tệp dự án."); return; }

    setIsUploadingFiles(true);
    setFileError("");
    const added: AssistantProjectFile[] = [];
    try {
      for (const file of sourceFiles) added.push(await onUploadFile(selected.id, file));
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Không tải được tệp lên máy chủ.");
    } finally {
      setIsUploadingFiles(false);
    }
    if (added.length) {
      update(selected.id, project => ({ ...project, files: [...project.files, ...added] }));
      setSelectedFiles(added.map(file => file.name));
    }
  }
  async function downloadFile(file: AssistantProjectFile) {
    if (!selected) return;
    setDownloadingFileId(file.id);
    setFileError("");
    try {
      const blob = await assistantService.downloadProjectFile(selected.id, file.id, branchId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Không tải được tệp xuống.");
    } finally {
      setDownloadingFileId(null);
    }
  }
  function card(project: AssistantProject) {
    return <li key={project.id} className="relative min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md focus-within:-translate-y-0.5 focus-within:shadow-md motion-reduce:transform-none">
      <div className="flex items-center justify-between gap-2"><AssistantProjectIcon icon={project.icon} tone={project.tone} /><div className="flex items-center gap-1"><button type="button" onClick={() => update(project.id, item => ({ ...item, favorite: !item.favorite }))} aria-label={project.favorite ? `Bỏ yêu thích ${project.name}` : `Yêu thích ${project.name}`} aria-pressed={project.favorite} className={cn("grid size-8 place-items-center rounded-md hover:bg-surface-container-low", focusClass)}><Star className={cn("size-4", project.favorite ? "fill-current text-favorite" : "text-on-surface-variant")} aria-hidden="true" /></button><details className="relative"><summary aria-label={`Tùy chọn ${project.name}`} className={cn("grid size-8 cursor-pointer list-none place-items-center rounded-md hover:bg-surface-container-low [&::-webkit-details-marker]:hidden", focusClass)}><MoreHorizontal className="size-4" aria-hidden="true" /></summary><div className="absolute right-0 top-full z-20 w-36 rounded-lg border border-outline-variant bg-surface-container-lowest p-1 shadow-md"><button type="button" onClick={() => openEdit(project)} className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-container-low">Sửa dự án</button><button type="button" onClick={() => setDeleteTarget(project)} className="w-full rounded-md px-3 py-2 text-left text-sm text-error hover:bg-error-container">Xóa dự án</button></div></details></div></div>
      <button type="button" onClick={() => { onSelect(project.id); setDetailTab("conversations"); }} className={cn("mt-1 block w-full truncate rounded-md text-left text-sm font-semibold", focusClass)}>{project.name}</button>
    </li>;
  }

  return <section aria-label="Dự án" className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-surface-container-lowest text-on-surface">
    {selected ? <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
      <nav aria-label="Đường dẫn dự án" className="mb-5 flex items-center gap-2 text-xs"><button type="button" onClick={() => onSelect(null)} className={cn("text-on-surface-variant hover:text-on-surface", focusClass)}>Dự án</button><ChevronRight className="size-3" aria-hidden="true" /><span className="truncate font-medium">{selected.name}</span></nav>
      <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="flex min-w-0 items-center gap-2 text-balance text-lg font-semibold"><AssistantProjectIcon icon={selected.icon} tone={selected.tone} className="size-5" /><span className="truncate">{selected.name}</span></h1><div className="flex items-center gap-2"><button type="button" onClick={() => { setInstructions(selected.instructions); setDialog("instructions"); }} className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 text-sm hover:bg-surface-container-low", focusClass)}><SlidersHorizontal className="size-4" aria-hidden="true" />Thiết lập chỉ dẫn</button><details className="relative"><summary aria-label="Tùy chọn dự án" className={cn("grid size-9 cursor-pointer list-none place-items-center rounded-lg hover:bg-surface-container-low [&::-webkit-details-marker]:hidden", focusClass)}><MoreHorizontal className="size-4" aria-hidden="true" /></summary><div className="absolute right-0 z-20 w-36 rounded-lg border border-outline-variant bg-surface-container-lowest p-1 shadow-md"><button type="button" onClick={() => openEdit(selected)} className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-container-low">Sửa dự án</button><button type="button" onClick={() => setDeleteTarget(selected)} className="w-full rounded-md px-3 py-2 text-left text-sm text-error hover:bg-error-container">Xóa dự án</button></div></details></div></header>
      {composer && <div className="mt-6">{composer}</div>}
      {notice?.projectId === selected.id && <p role="status" className="mt-2 text-pretty text-xs text-on-surface-variant">{notice.text}</p>}
      {fileError && !dialog && <p role="alert" className="mt-2 text-pretty text-sm text-error">{fileError}</p>}
      <div className="mt-5 flex gap-5 border-b border-outline-variant" aria-label="Nội dung dự án"><button type="button" aria-pressed={detailTab === "conversations"} onClick={() => setDetailTab("conversations")} className={cn("border-b-2 px-2 py-3 text-sm", detailTab === "conversations" ? "border-primary font-semibold text-primary" : "border-transparent text-on-surface-variant", focusClass)}>Danh sách trò chuyện</button><button type="button" aria-pressed={detailTab === "files"} onClick={() => setDetailTab("files")} className={cn("border-b-2 px-2 py-3 text-sm", detailTab === "files" ? "border-primary font-semibold text-primary" : "border-transparent text-on-surface-variant", focusClass)}>Tệp đính kèm</button></div>
      {detailTab === "conversations" ? projectConversations.length ? <ul className="divide-y divide-outline-variant">{projectConversations.map(conversation => (
        <li key={conversation.id} className="flex items-center gap-3 py-3">
          <button type="button" onClick={() => conversation.sourceConversationId && onOpenConversation?.(conversation.sourceConversationId)} disabled={!conversation.sourceConversationId} className={cn("min-w-0 flex-1 text-left disabled:cursor-default", focusClass)}>
            <span className="block truncate text-sm font-medium">{conversation.title}</span>
            <span className="mt-1 block truncate text-xs text-on-surface-variant">{conversation.preview}</span>
          </button>
          <time className="shrink-0 text-xs tabular-nums text-on-surface-variant" dateTime={conversation.updatedAt || conversation.createdAt}>{new Date(conversation.updatedAt || conversation.createdAt).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</time>
          <details className="relative shrink-0" data-project-conversation-menu>
            <summary aria-label={`Tùy chọn cuộc trò chuyện ${conversation.title}`} className={cn("grid size-8 cursor-pointer list-none place-items-center rounded-md text-on-surface-variant hover:bg-surface-container-low [&::-webkit-details-marker]:hidden", focusClass)}><MoreHorizontal className="size-4" aria-hidden="true" /></summary>
            <div role="group" aria-label={`Các thao tác cho ${conversation.title}`} className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-outline-variant bg-surface-container-lowest p-1 text-on-surface shadow-md">
              <details className="group">
                <summary className={cn("flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md px-2 text-sm hover:bg-surface-container-low [&::-webkit-details-marker]:hidden", focusClass)}><FolderInput className="size-4 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">Di chuyển sang dự án</span><ChevronRight className="size-4 shrink-0" aria-hidden="true" /></summary>
                <div className="ml-4 border-l border-outline-variant pl-1">
                  {projects.filter(project => project.id !== selected.id).map(project => <button key={project.id} type="button" disabled={!conversation.sourceConversationId} onClick={event => { closeConversationMenu(event); moveConversation(conversation, project.id); }} className={cn("flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50", focusClass)}><AssistantProjectIcon icon={project.icon} tone={project.tone} /><span className="truncate">{project.name}</span></button>)}
                  {projects.length < 2 && <p className="px-2 py-2 text-xs text-on-surface-variant">Chưa có dự án khác.</p>}
                </div>
              </details>
              <button type="button" onClick={event => { closeConversationMenu(event); update(selected.id, project => ({ ...project, conversations: project.conversations.filter(item => item.id !== conversation.id) })); }} className={cn("flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-surface-container-low", focusClass)}><CornerUpRight className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">Xóa khỏi &quot;{selected.name}&quot;</span></button>
              <button type="button" onClick={event => { closeConversationMenu(event); openConversationRename(conversation); }} className={cn("flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-surface-container-low", focusClass)}><Pencil className="size-4 shrink-0" aria-hidden="true" />Sửa tên</button>
              {conversation.sourceConversationId && onDeleteConversation && <button type="button" onClick={event => { closeConversationMenu(event); onDeleteConversation(conversation); }} className={cn("flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-error hover:bg-error-container", focusClass)}><Trash2 className="size-4 shrink-0" aria-hidden="true" />Xóa trò chuyện</button>}
            </div>
          </details>
        </li>
      ))}</ul> : <div className="py-20 text-center"><FileText className="mx-auto size-8 text-on-surface-variant/50" aria-hidden="true" /><p className="mt-3 text-sm text-on-surface-variant">Chưa có cuộc hội thoại</p><p className="mt-1 text-pretty text-xs text-on-surface-variant">Bắt đầu bằng ô trò chuyện phía trên.</p></div> : <div className="py-5"><div className="flex flex-wrap items-center justify-between gap-3"><label className="relative block w-full max-w-64"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" /><span className="sr-only">Tìm kiếm tệp</span><input value={fileQuery} onChange={event => setFileQuery(event.target.value)} placeholder="Tìm kiếm tệp" className="min-h-9 w-full rounded-lg border border-outline-variant pl-9 pr-3 text-sm focus:border-primary focus:outline-none" /></label><button type="button" onClick={() => setDialog("files")} className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 text-sm font-medium text-primary", focusClass)}><Plus className="size-4" aria-hidden="true" />Thêm tệp</button></div>{files.length ? <ul className="mt-4 divide-y divide-outline-variant rounded-lg border border-outline-variant">{files.map(file => <li key={file.id} className="flex items-center gap-3 px-4 py-3"><FileText className="size-4 shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 flex-1 truncate text-sm">{file.name}</span><span className="text-xs tabular-nums text-on-surface-variant">{Math.max(1, Math.round(file.size / 1024))} KB</span><button type="button" disabled={downloadingFileId === file.id} onClick={() => void downloadFile(file)} aria-label={`Tải xuống ${file.name}`} className={cn("grid size-8 shrink-0 place-items-center rounded-md text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50", focusClass)}>{downloadingFileId === file.id ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}</button><button type="button" onClick={() => update(selected.id, project => ({ ...project, files: project.files.filter(item => item.id !== file.id) }))} aria-label={`Bỏ tệp ${file.name}`} className={cn("grid size-8 shrink-0 place-items-center rounded-md text-on-surface-variant hover:text-error", focusClass)}><X className="size-4" aria-hidden="true" /></button></li>)}</ul> : <div className="py-20 text-center"><Paperclip className="mx-auto size-8 text-on-surface-variant/50" aria-hidden="true" /><p className="mt-3 text-sm text-on-surface-variant">Chưa có tệp đính kèm</p><button type="button" onClick={() => setDialog("files")} className={cn("mt-3 text-sm font-medium text-primary", focusClass)}>Thêm tệp đầu tiên</button></div>}</div>}
    </div> : <div className="w-full px-4 pt-4 pb-6 sm:px-6 lg:px-8"><div className="flex justify-end"><button type="button" onClick={openCreate} className={cn(assistantPageCreateButtonClass, focusClass)}><Plus className="size-4" aria-hidden="true" />Tạo dự án</button></div><div className="mx-auto max-w-5xl"><header className="text-center"><div><h1 className="assistant-large-page-title text-balance text-center text-on-surface">Dự án</h1><p className="mt-1 text-pretty text-sm text-on-surface-variant">Quản lý các cuộc hội thoại của bạn trong một dự án duy nhất.</p></div></header><label className="relative mx-auto mt-6 block max-w-2xl"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" /><span className="sr-only">Tìm kiếm dự án</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm kiếm dự án..." className="min-h-10 w-full rounded-lg border border-outline-variant pl-10 pr-3 text-sm focus:border-primary focus:outline-none" /></label><div className="mt-4 flex gap-5 border-b border-outline-variant" aria-label="Bộ lọc dự án"><button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={cn("border-b-2 px-2 py-3 text-sm", filter === "all" ? "border-primary font-semibold text-primary" : "border-transparent", focusClass)}>Tất cả</button><button type="button" aria-pressed={filter === "mine"} onClick={() => setFilter("mine")} className={cn("border-b-2 px-2 py-3 text-sm", filter === "mine" ? "border-primary font-semibold text-primary" : "border-transparent", focusClass)}>Dự án của tôi</button></div>{filter === "all" && visible.some(project => project.favorite) && <section className="mt-6"><h2 className="mb-3 text-sm font-semibold">Dự án yêu thích</h2><ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.filter(project => project.favorite).map(card)}</ul></section>}<section className="mt-6"><h2 className="mb-3 text-sm font-semibold">Dự án của tôi</h2>{visible.length ? <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map(card)}</ul> : <div className="rounded-xl border border-dashed border-outline-variant px-4 py-14 text-center"><Folder className="mx-auto size-8 text-on-surface-variant/50" aria-hidden="true" /><p className="mt-3 text-sm text-on-surface-variant">{query ? "Không tìm thấy dự án phù hợp." : "Chưa có dự án nào."}</p><button type="button" onClick={query ? () => setQuery("") : openCreate} className={cn("mt-3 text-sm font-medium text-primary", focusClass)}>{query ? "Xóa tìm kiếm" : "Tạo dự án đầu tiên"}</button></div>}</section></div></div>}
    {(dialog === "create" || dialog === "edit") && <ProjectDialog title={dialog === "create" ? "Tạo dự án" : "Sửa dự án"} onClose={() => setDialog(null)}><form onSubmit={saveProject} className="p-5"><label htmlFor="assistant-project-name" className="block text-sm font-medium">Tên dự án</label><div className="mt-2 flex items-center gap-2 rounded-lg border border-outline-variant px-3 focus-within:border-primary"><AssistantProjectIcon icon={icon} tone={tone} /><input id="assistant-project-name" value={name} onChange={event => { setName(event.target.value); setNameError(""); }} maxLength={100} placeholder="Nhập tên dự án" aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "assistant-project-name-error" : undefined} className="min-h-10 min-w-0 flex-1 bg-transparent text-sm focus:outline-none" /><span className="text-xs tabular-nums text-on-surface-variant">{name.length}/100</span></div>{nameError && <p id="assistant-project-name-error" role="alert" className="mt-2 text-sm text-error">{nameError}</p>}<fieldset className="mt-4"><legend className="text-sm font-medium">Màu biểu tượng</legend><div className="mt-2 flex gap-2">{(Object.keys(toneClasses) as ProjectTone[]).map(choice => <button key={choice} type="button" aria-label={`Màu ${toneLabels[choice]}`} aria-pressed={tone === choice} onClick={() => setTone(choice)} className={cn("grid size-9 place-items-center rounded-full border", tone === choice ? "border-outline" : "border-transparent", focusClass)}><span className={cn("size-5 rounded-full", toneClasses[choice])} /></button>)}</div></fieldset><fieldset className="mt-4"><legend className="text-sm font-medium">Biểu tượng</legend><div className="mt-2 grid max-h-48 grid-cols-6 gap-2 overflow-y-auto rounded-lg border border-outline-variant p-2 sm:grid-cols-8">{projectIconOptions.map(choice => <button key={choice.id} type="button" aria-label={`Biểu tượng ${choice.label}`} aria-pressed={icon === choice.id} onClick={() => setIcon(choice.id)} className={cn("grid size-10 place-items-center rounded-lg border", icon === choice.id ? "border-primary bg-primary/10" : "border-outline-variant hover:bg-surface-container-low", focusClass)}><AssistantProjectIcon icon={choice.id} tone={tone} className="size-5" /></button>)}</div></fieldset><div className="mt-6 flex justify-end gap-2 border-t border-outline-variant pt-4"><button type="button" onClick={() => setDialog(null)} className={cn("min-h-9 rounded-lg border border-outline-variant px-4 text-sm", focusClass)}>Hủy</button><button type="submit" className={cn("min-h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary", focusClass)}>Lưu</button></div></form></ProjectDialog>}
    {dialog === "instructions" && selected && <ProjectDialog title="Thiết lập chỉ dẫn" onClose={() => setDialog(null)}>
      <form onSubmit={event => { event.preventDefault(); update(selected.id, project => ({ ...project, instructions })); setDialog(null); }} className="p-5">
        <p className="text-pretty text-sm text-on-surface-variant">Thêm chỉ dẫn cho dự án này để định hướng cách iGenAI phản hồi.</p>
        <label htmlFor="assistant-project-instructions" className="mt-4 block text-sm font-medium">Chỉ dẫn cho dự án</label>
        <textarea id="assistant-project-instructions" maxLength={10000} rows={7} value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="Ví dụ: Trả lời bằng tiếng Việt, giọng thân thiện, tập trung vào mục tiêu của dự án..." className="mt-2 w-full resize-y rounded-lg border border-outline-variant p-3 text-sm focus:border-primary focus:outline-none" />
        <p className="text-right text-xs tabular-nums text-on-surface-variant">{instructions.length}/10.000</p>
        <span className="mt-3 block text-sm font-medium">Mô hình</span>
        <div className="mt-2 flex h-10 items-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2 text-sm text-on-surface" aria-label="Mô hình iGenAI">
          <img src="/igenai.png" alt="" aria-hidden="true" className="size-8 shrink-0 object-contain" />iGenAI
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t border-outline-variant pt-4"><button type="button" onClick={() => setDialog(null)} className={cn("min-h-9 rounded-lg border border-outline-variant px-4 text-sm", focusClass)}>Hủy</button><button type="submit" className={cn("min-h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary", focusClass)}>Lưu</button></div>
      </form>
    </ProjectDialog>}
    {dialog === "files" && selected && <ProjectDialog title="Thêm tệp" onClose={() => { if (!isUploadingFiles) setDialog(null); }}><div className="p-5"><p className="text-pretty text-sm text-on-surface-variant">Tệp được tải lên và trích xuất văn bản để iGenAI tham khảo trong các cuộc trò chuyện của dự án.</p><label className="mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant p-5 text-center hover:border-primary focus-within:border-primary"><Paperclip className="size-6 text-primary" aria-hidden="true" /><span className="mt-3 text-sm font-medium text-primary">Chọn tệp từ máy tính</span><span className="mt-1 text-xs text-on-surface-variant">PDF, DOCX hoặc TXT · tối đa 15 MB mỗi tệp</span><input type="file" multiple accept=".pdf,.docx,.txt" disabled={isUploadingFiles} onChange={event => { void addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} className="sr-only" /></label>{isUploadingFiles && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-on-surface-variant"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Đang tải lên và trích xuất nội dung tệp…</p>}{fileError && <p role="alert" className="mt-2 text-sm text-error">{fileError}</p>}{selectedFiles.length > 0 && <p role="status" className="mt-3 text-sm text-on-surface-variant">Đã tải lên: {selectedFiles.join(", ")}</p>}<div className="mt-6 flex justify-end border-t border-outline-variant pt-4"><button type="button" disabled={isUploadingFiles} onClick={() => { setSelectedFiles([]); setDialog(null); }} className={cn("min-h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-50", focusClass)}>{isUploadingFiles ? "Đang tải lên…" : "Xong"}</button></div></div></ProjectDialog>}
    {dialog === "renameConversation" && selected && renameTarget && <ProjectDialog title={"S\u1eeda t\u00ean cu\u1ed9c tr\u00f2 chuy\u1ec7n"} onClose={() => { setDialog(null); setRenameTarget(null); }}>
      <form onSubmit={saveConversationName} className="p-5">
        <label htmlFor="assistant-conversation-name" className="block text-sm font-medium">T&#234;n cu&#7897;c tr&#242; chuy&#7879;n</label>
        <input id="assistant-conversation-name" value={conversationName} onChange={event => { setConversationName(event.target.value); setConversationNameError(""); }} maxLength={100} autoComplete="off" aria-invalid={Boolean(conversationNameError)} aria-describedby={conversationNameError ? "assistant-conversation-name-error" : undefined} className="mt-2 min-h-10 w-full rounded-lg border border-outline-variant px-3 text-sm focus:border-primary focus:outline-none" />
        {conversationNameError && <p id="assistant-conversation-name-error" role="alert" className="mt-2 text-sm text-error">{conversationNameError}</p>}
        <div className="mt-6 flex justify-end gap-2 border-t border-outline-variant pt-4">
          <button type="button" onClick={() => { setDialog(null); setRenameTarget(null); }} className={cn("min-h-9 rounded-lg border border-outline-variant px-4 text-sm", focusClass)}>H&#7911;y</button>
          <button type="submit" className={cn("min-h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary", focusClass)}>L&#432;u</button>
        </div>
      </form>
    </ProjectDialog>}
    <ConfirmDialog appearance="erp" native isOpen={Boolean(deleteTarget)} title="Xóa dự án?" description={`Dự án “${deleteTarget?.name || ""}” và dữ liệu giao diện trong dự án sẽ bị xóa.`} confirmLabel="Xóa dự án" onClose={() => setDeleteTarget(null)} onConfirm={() => { if (!deleteTarget) return; onProjectsChange(projects.filter(project => project.id !== deleteTarget.id)); if (selectedId === deleteTarget.id) onSelect(null); setDeleteTarget(null); }} />
  </section>;
}

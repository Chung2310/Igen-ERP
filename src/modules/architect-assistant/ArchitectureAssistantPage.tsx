import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Download, FolderOpen, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { useAuth } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import type { ArchitecturePlan, ArchitectureProject, ArchitectureProjectInput, ArchitectureToolId } from "../../shared/architecture-assistant";
import { cn } from "../student-management/lib/utils";
import { architectAssistantApi } from "./api";
import { ARCHITECTURE_TOOL_NAV, ArchitectureCreativeTools } from "./ArchitectureCreativeTools";
import ArchitectAssistantHome from "./ArchitectAssistantHome";
import FloorPlanEditor, { ArchitecturePlanSvg } from "./FloorPlanEditor";
import "./architect-assistant.css";

const inputClass = "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60";
const emptyPlan = (): ArchitecturePlan => ({ rooms: [], notes: "" });
const blankProject: ArchitectureProjectInput = { name: "", areaM2: 100, floors: 1, style: "Hiện đại", requirements: "" };
type ArchitecturePage = "home" | "projects" | "rendering" | ArchitectureToolId;
const RENDERING_TABS: Array<{ label: string; tool: ArchitectureToolId }> = [
  { label: "Render", tool: "render" },
  { label: "Cải thiện Render", tool: "enhance" },
  { label: "Upscale", tool: "upscale" },
  { label: "Đồng bộ", tool: "sync" },
  { label: "Chỉnh sửa ảnh", tool: "edit" },
  { label: "Virtual staging", tool: "staging" },
  { label: "Canvas", tool: "canvas" },
  { label: "Tiện ích khác", tool: "utilities" },
];
function apiMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] || char);
}

async function makePlanImage(plan: ArchitecturePlan, floor: number) {
  const rootStyles = getComputedStyle(document.documentElement);
  const color = (token: string) => rootStyles.getPropertyValue(`--color-${token}`).trim();
  const background = color("surface-container-lowest");
  const roomFill = color("surface-container");
  const textColor = color("on-surface");
  const mutedColor = color("on-surface-variant");
  const borderColor = color("outline");
  const gridColor = color("outline-variant");
  const primaryColor = color("primary");
  const secondaryFill = color("secondary-container");
  const windowColor = color("tertiary");
  if (![background, roomFill, textColor, mutedColor, borderColor, gridColor, primaryColor, secondaryFill, windowColor].every(Boolean)) throw new Error("Thiếu màu giao diện để xuất sơ đồ.");
  const visibleRooms = plan.rooms.filter(room => room.floor === floor);
  const roomIds = new Set(visibleRooms.map(room => room.id));
  const rooms = visibleRooms.map(room => {
    const x = room.x * 1.2; const y = room.y * 0.9; const width = room.width * 1.2; const height = room.height * 0.9;
    const furniture = (plan.furniture || []).filter(item => item.roomId === room.id).map(item => {
      const fx = (room.x + item.x / 100 * room.width) * 1.2; const fy = (room.y + item.y / 100 * room.height) * 0.9;
      const fw = item.width / 100 * room.width * 1.2; const fh = item.height / 100 * room.height * 0.9;
      return `<g><rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="0.4" fill="${secondaryFill}" stroke="${primaryColor}" stroke-width="0.25"/><text x="${fx + fw / 2}" y="${fy + fh / 2}" text-anchor="middle" dominant-baseline="middle" fill="${textColor}" font-size="1.3">${escapeXml(item.name.slice(0, 12))}</text></g>`;
    }).join("");
    return `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="0.6" fill="${roomFill}" stroke="${borderColor}" stroke-width="0.55"/><text x="${(room.x + room.width / 2) * 1.2}" y="${(room.y + room.height / 2) * 0.9 - 1}" text-anchor="middle" fill="${textColor}" font-size="2.7">${escapeXml(room.name)}</text><text x="${(room.x + room.width / 2) * 1.2}" y="${(room.y + room.height / 2) * 0.9 + 2.5}" text-anchor="middle" fill="${mutedColor}" font-size="2">${room.areaM2} m²</text>${furniture}</g>`;
  }).join("");
  const openings = (plan.openings || []).filter(opening => roomIds.has(opening.roomId)).map(opening => {
    const room = visibleRooms.find(candidate => candidate.id === opening.roomId)!;
    const half = Math.min(opening.width, 100) / 2; const start = Math.max(0, opening.offset - half); const end = Math.min(100, opening.offset + half);
    const x1 = (room.x + (opening.wall === "east" ? room.width : opening.wall === "west" ? 0 : start / 100 * room.width)) * 1.2;
    const y1 = (room.y + (opening.wall === "south" ? room.height : opening.wall === "north" ? 0 : start / 100 * room.height)) * 0.9;
    const x2 = (room.x + (opening.wall === "east" ? room.width : opening.wall === "west" ? 0 : end / 100 * room.width)) * 1.2;
    const y2 = (room.y + (opening.wall === "south" ? room.height : opening.wall === "north" ? 0 : end / 100 * room.height)) * 0.9;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${opening.type === "door" ? primaryColor : windowColor}" stroke-width="0.8"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 120 90"><rect width="120" height="90" fill="${background}"/><path d="${Array.from({ length: 21 }, (_, i) => `M${i * 6} 0v90`).join("")}${Array.from({ length: 16 }, (_, i) => `M0 ${i * 6}h120`).join("")}" stroke="${gridColor}" stroke-width="0.12"/>${rooms}${openings}</svg>`;
  const imageUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = imageUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1200; canvas.height = 900;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Không thể dựng ảnh mặt bằng.");
    context.drawImage(image, 0, 0);
    return canvas.toDataURL("image/png");
  } finally { URL.revokeObjectURL(imageUrl); }
}

export default function ArchitectureAssistantPage() {
  const { userProfile, hasPermission } = useAuth();
  const branch = useBranch();
  const canManage = hasPermission("architect-assistant:manage");
  const canUseAi = canManage && hasPermission("architect-ai:manage");
  if (branch.loading) return <div className="p-6 text-sm text-on-surface-variant" role="status">Đang tải chi nhánh…</div>;
  if (!branch.activeBranchId) return <div className="m-5 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 text-sm text-on-surface-variant" role="alert">
    {branch.error || "Chọn chi nhánh đang hoạt động để sử dụng Trợ lý kiến trúc."}
    {branch.error && <button type="button" onClick={branch.retry} className="ml-3 rounded-sm underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary">Thử lại</button>}
  </div>;
  return <ArchitectureWorkspace key={`${userProfile?.uid}:${userProfile?.companyCode}:${branch.activeBranchId}`} branchId={branch.activeBranchId} canManage={canManage} canUseAi={canUseAi} />;
}

function ArchitectureWorkspace({ branchId, canManage, canUseAi }: { branchId: string; canManage: boolean; canUseAi: boolean }) {
  const api = useMemo(() => architectAssistantApi(branchId), [branchId]);
  const [projects, setProjects] = useState<ArchitectureProject[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState<ArchitectureProjectInput>(blankProject);
  const [projectDraft, setProjectDraft] = useState<ArchitectureProjectInput>(blankProject);
  const [planDraft, setPlanDraft] = useState<ArchitecturePlan>(emptyPlan);
  const [activeFloor, setActiveFloor] = useState(1);
  const [tab, setTab] = useState<ArchitectureToolId>("plan");
  const [page, setPage] = useState<ArchitecturePage>("home");
  const [showProjectsPanel, setShowProjectsPanel] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("4:3");
  const [resolution, setResolution] = useState("1K");
  const [renderPrompt, setRenderPrompt] = useState("");
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const selected = projects.find(project => project._id === selectedId) || null;
  const assetSignature = selected?.renders.map(asset => asset.id).join(",") || "";

  const loadProjects = async () => {
    setLoading(true); setError("");
    try {
      const result = await api.list();
      setProjects(result.projects);
      setSelectedId(current => result.projects.some(project => project._id === current) ? current : result.projects[0]?._id || "");
    } catch (cause) { setError(apiMessage(cause, "Không tải được danh sách dự án.")); }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadProjects(); }, [api]);
  useEffect(() => {
    if (!selected) { setProjectDraft(blankProject); setPlanDraft(emptyPlan()); setActiveFloor(1); return; }
    setActiveFloor(1);
    setProjectDraft({ name: selected.name, areaM2: selected.areaM2, floors: selected.floors, style: selected.style, requirements: selected.requirements });
    setPlanDraft(selected.plan ? structuredClone(selected.plan) : emptyPlan());
  }, [selectedId]);
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    if (!selected) { setAssetUrls({}); return; }
    void Promise.all(selected.renders.map(async asset => {
      try {
        const blob = await api.asset(selected._id, asset.id);
        const url = URL.createObjectURL(blob); created.push(url);
        return [asset.id, url] as const;
      } catch { return null; }
    })).then(entries => { if (!cancelled) setAssetUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry)))); });
    return () => { cancelled = true; created.forEach(URL.revokeObjectURL); };
  }, [api, selected?._id, assetSignature]);

  const replaceProject = (project: ArchitectureProject) => setProjects(current => [project, ...current.filter(item => item._id !== project._id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  const createProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await api.create(createDraft);
      setProjects(current => [result.project, ...current]); setSelectedId(result.project._id);
      setShowCreate(false); setCreateDraft(blankProject); setTab("plan"); setNotice("Đã tạo dự án.");
    } catch (cause) { setError(apiMessage(cause, "Không tạo được dự án.")); }
    finally { setBusy(false); }
  };
  const saveProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError("");
    try { const result = await api.update(selected._id, selected.revision, projectDraft); replaceProject(result.project); setActiveFloor(current => Math.min(current, result.project.floors)); setNotice("Đã lưu thông tin dự án."); }
    catch (cause) { setError(apiMessage(cause, "Không lưu được thông tin dự án.")); }
    finally { setBusy(false); }
  };
  const savePlan = async () => {
    if (!selected || !planDraft.rooms.length) return;
    setBusy(true); setError("");
    try {
      const result = await api.update(selected._id, selected.revision, { plan: planDraft });
      replaceProject(result.project); setPlanDraft(result.project.plan || emptyPlan()); setNotice("Đã lưu mặt bằng.");
    } catch (cause) { setError(apiMessage(cause, "Không lưu được mặt bằng.")); }
    finally { setBusy(false); }
  };
  const downloadPlan = async () => {
    if (!planDraft.rooms.length) return;
    setError("");
    try {
      const image = await makePlanImage(planDraft, activeFloor);
      const link = document.createElement("a");
      link.href = image;
      link.download = `${selected?.name || "mat-bang"}-tang-${activeFloor}.png`;
      link.click();
    } catch (cause) { setError(apiMessage(cause, "Không xuất được bản vẽ mặt bằng.")); }
  };
  const generatePlan = async (instructions = "", outline?: NonNullable<ArchitecturePlan["outline"]>) => {
    if (!selected) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api.generatePlan(selected._id, instructions, outline);
      replaceProject(result.project); setPlanDraft(result.project.plan || emptyPlan()); setNotice("Đã tạo mặt bằng bằng AI. Kiểm tra và chỉnh lại kích thước trước khi dùng.");
    } catch (cause) { setError(apiMessage(cause, "Không tạo được mặt bằng.")); }
    finally { setBusy(false); }
  };
  const generateRender = async () => {
    if (!selected || !planDraft.rooms.some(room => room.floor === activeFloor)) return;
    setBusy(true); setError(""); setNotice("");
    const finishNotes = planDraft.rooms.filter(room => room.floor === activeFloor).map(room => {
      const finish = room.finishes || {};
      return `${room.name}: ${room.style || selected.style}; sàn ${finish.flooring || "Gỗ sáng"}; tường ${finish.walls || "Trắng ấm"}; trần ${finish.ceiling || "Trắng"}; cửa ${finish.doors || "Gỗ tự nhiên"}; cửa sổ ${finish.windows || "Kính trong, khung nhôm"}`;
    }).join("\n");
    const prompt = [renderPrompt, `Apply these room materials and styles:\n${finishNotes}`].filter(Boolean).join("\n");
    try {
      if (JSON.stringify(planDraft) !== JSON.stringify(selected.plan)) {
        const saved = await api.update(selected._id, selected.revision, { plan: planDraft });
        replaceProject(saved.project); setPlanDraft(saved.project.plan || emptyPlan());
        const planImage = await makePlanImage(saved.project.plan || emptyPlan(), activeFloor);
        const result = await api.render(selected._id, planImage, aspectRatio, prompt, activeFloor, resolution);
        replaceProject(result.project);
      } else {
        const planImage = await makePlanImage(planDraft, activeFloor);
        const result = await api.render(selected._id, planImage, aspectRatio, prompt, activeFloor, resolution);
        replaceProject(result.project);
      }
      setNotice("Đã tạo phối cảnh. Hình ảnh được lưu trong dự án.");
    } catch (cause) { setError(apiMessage(cause, "Không tạo được phối cảnh.")); }
    finally { setBusy(false); }
  };
  const generateRenderFrom3D = async (referenceImage: string) => {
    if (!selected || !canUseAi || !planDraft.rooms.some(room => room.floor === activeFloor)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (referenceImage.length > 5_000_000) throw new Error("Ảnh góc nhìn 3D vượt quá giới hạn tải lên.");
      let projectForRender = selected;
      if (JSON.stringify(planDraft) !== JSON.stringify(selected.plan)) {
        const saved = await api.update(selected._id, selected.revision, { plan: planDraft });
        projectForRender = saved.project; replaceProject(saved.project); setPlanDraft(saved.project.plan || emptyPlan());
      }
      const finishNotes = planDraft.rooms.filter(room => room.floor === activeFloor).map(room => {
        const finish = room.finishes || {};
        return `${room.name}: ${room.style || selected.style}; sàn ${finish.flooring || "Gỗ sáng"}; tường ${finish.walls || "Trắng ấm"}; trần ${finish.ceiling || "Trắng"}; cửa ${finish.doors || "Gỗ tự nhiên"}; cửa sổ ${finish.windows || "Kính trong, khung nhôm"}`;
      }).join("\n");
      const result = await api.generateImage(projectForRender._id, {
        kind: "render", aspectRatio, resolution, referenceImages: [referenceImage],
        prompt: `Create a photorealistic architectural render from this exact 3D camera view. Preserve the camera angle, room layout, doors, windows, furniture placement, and proportions. Apply the project's selected finishes:\n${finishNotes}`,
      });
      replaceProject(result.project); setNotice("Đã tạo phối cảnh từ góc nhìn 3D và lưu vào thư viện dự án.");
    } catch (cause) { setError(apiMessage(cause, "Không tạo được phối cảnh từ góc nhìn 3D.")); }
    finally { setBusy(false); }
  };
  const deleteProject = async () => {
    if (!selected) return;
    setDeleting(true); setError("");
    try {
      await api.remove(selected._id, selected.revision);
      const remaining = projects.filter(project => project._id !== selected._id);
      setProjects(remaining); setSelectedId(remaining[0]?._id || ""); setDeleteOpen(false); setNotice("Đã xóa dự án.");
    } catch (cause) { setError(apiMessage(cause, "Không xóa được dự án.")); }
    finally { setDeleting(false); }
  };

  if (page === "home") return <ArchitectAssistantHome
    onOpenTool={tool => { setTab(tool); setPage(tool === "render" ? "rendering" : tool); setShowProjectsPanel(false); setNotice(""); setError(""); }}
    onOpenProjects={() => { setPage("projects"); setShowProjectsPanel(true); setTab("plan"); }}
  />;

  const pageTitle = page === "projects"
    ? "Dự án kiến trúc"
    : page === "rendering"
      ? "Rendering"
      : page === "plan"
        ? "Vẽ bản vẽ AI"
        : ARCHITECTURE_TOOL_NAV.find(item => item.id === page)?.label || "Trợ lý kiến trúc";

  return <div className="architect-assistant-source min-h-full space-y-5 overflow-auto bg-surface p-4 sm:p-6" aria-busy={busy || loading}>
    <header className="sticky top-0 z-30 -mx-4 -mt-4 flex min-h-16 items-center justify-between gap-3 border-b border-white/40 bg-white/70 px-4 py-3 shadow-sm shadow-slate-900/5 backdrop-blur-xl sm:-mx-6 sm:-mt-6 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={() => setPage("home")} aria-label="Về trang công cụ kiến trúc" className="flex size-10 shrink-0 items-center justify-center rounded-full text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <img src="https://res.cloudinary.com/dfbk14k5w/image/upload/v1783992125/igen_assets/brand-icon.png" alt="iGen" className="hidden h-10 object-contain sm:block" referrerPolicy="no-referrer" />
        <div className="min-w-0">
          <h1 className="truncate text-base font-extrabold uppercase text-on-surface sm:text-lg">{pageTitle}</h1>
          <p className="truncate text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">Powered by iGen Vision Engine</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={() => { setPage("projects"); setShowProjectsPanel(value => !value); setTab("plan"); }} aria-pressed={showProjectsPanel} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-3 text-xs font-semibold text-on-surface shadow-sm hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary sm:px-4 sm:text-sm">
          <FolderOpen className="size-4 text-primary" aria-hidden="true" />
          <span className="max-w-40 truncate">{selected?.name || "Dự án kiến trúc"}</span>
        </button>
        {page === "projects" && <button type="button" onClick={() => void loadProjects()} disabled={loading} aria-label="Làm mới dự án" className="flex size-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60">
          <RefreshCw className="size-4" aria-hidden="true" />
        </button>}
      </div>
    </header>

    {error && <div className="flex items-start justify-between gap-3 rounded-lg border border-error/40 bg-error-container/20 px-4 py-3 text-sm text-on-surface" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} className="rounded-sm underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary">Đóng</button></div>}
    {notice && <p className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface" role="status"><Check className="size-4 text-primary" aria-hidden="true" />{notice}</p>}

    <div className={cn("grid items-start gap-5", showProjectsPanel ? "xl:grid-cols-[17rem_minmax(0,1fr)]" : "grid-cols-1")}>
      {showProjectsPanel && <aside className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <div className="flex items-center justify-between gap-2"><h3 data-typography="section-title" className="text-sm font-semibold text-on-surface">Dự án</h3>
          {canManage && <button type="button" aria-label="Tạo dự án" onClick={() => { setShowCreate(value => !value); setError(""); }} className="flex size-9 items-center justify-center rounded-lg bg-primary text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"><Plus className="size-4" aria-hidden="true" /></button>}
        </div>
        {showCreate && <form className="space-y-3 border-t border-outline-variant pt-3" onSubmit={createProject}>
          <label className="block space-y-1 text-sm text-on-surface-variant"><span>Tên dự án</span><input required minLength={2} maxLength={120} className={inputClass} value={createDraft.name} onChange={event => setCreateDraft({ ...createDraft, name: event.target.value })} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1 text-sm text-on-surface-variant"><span>Diện tích (m²)</span><input required type="number" min={20} max={20000} className={inputClass} value={createDraft.areaM2} onChange={event => setCreateDraft({ ...createDraft, areaM2: Number(event.target.value) })} /></label>
            <label className="block space-y-1 text-sm text-on-surface-variant"><span>Số tầng</span><input required type="number" min={1} max={12} className={inputClass} value={createDraft.floors} onChange={event => setCreateDraft({ ...createDraft, floors: Number(event.target.value) })} /></label>
          </div>
          <label className="block space-y-1 text-sm text-on-surface-variant"><span>Phong cách</span><input required minLength={2} maxLength={100} className={inputClass} value={createDraft.style} onChange={event => setCreateDraft({ ...createDraft, style: event.target.value })} /></label>
          <label className="block space-y-1 text-sm text-on-surface-variant"><span>Yêu cầu</span><textarea maxLength={3000} className={`${inputClass} min-h-20 resize-y`} value={createDraft.requirements} onChange={event => setCreateDraft({ ...createDraft, requirements: event.target.value })} /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="min-h-9 rounded-lg border border-outline-variant px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary">Hủy</button><button type="submit" disabled={busy} className="min-h-9 rounded-lg bg-primary px-3 text-sm font-medium text-on-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60">Tạo dự án</button></div>
        </form>}
        {loading ? <p className="py-4 text-sm text-on-surface-variant" role="status">Đang tải dự án…</p> : !projects.length ? <p className="py-4 text-pretty text-sm text-on-surface-variant">Chưa có dự án trong chi nhánh này. {canManage ? "Dùng nút Tạo dự án để bắt đầu." : ""}</p> : <ul className="space-y-1" aria-label="Danh sách dự án">{projects.map(project => <li key={project._id}>
          <button type="button" onClick={() => { setSelectedId(project._id); if (page === "projects") setTab("plan"); setNotice(""); }} aria-current={project._id === selectedId ? "page" : undefined} className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-primary", project._id === selectedId ? "bg-primary/10 text-primary" : "text-on-surface hover:bg-surface-container")}>
            <span className="min-w-0"><span className="block truncate font-medium">{project.name}</span><span className="mt-0.5 block text-xs tabular-nums text-on-surface-variant">{project.areaM2} m² · {project.floors} tầng</span></span><ChevronRight className="size-4 shrink-0" aria-hidden="true" />
          </button>
        </li>)}</ul>}
      </aside>}

      {!selected ? <section className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center">
        <FolderOpen className="mb-4 size-12 text-primary" aria-hidden="true" />
        <h2 className="text-balance text-xl font-bold text-on-surface">Chọn dự án để bắt đầu</h2>
        <p className="mt-2 max-w-md text-pretty text-sm text-on-surface-variant">Các bản vẽ, phối cảnh và ảnh được lưu trong dự án đang chọn.</p>
        <button type="button" onClick={() => { setPage("projects"); setShowProjectsPanel(true); }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary">
          <FolderOpen className="size-4" aria-hidden="true" /> Mở danh sách dự án
        </button>
      </section> : <section className="min-w-0 space-y-4 rounded-xl bg-surface p-1 sm:p-2">
        {page === "projects" && <>
        <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs text-on-surface-variant">Dự án kiến trúc</p><h3 data-typography="section-title" className="mt-1 text-balance text-lg font-semibold text-on-surface">{selected.name}</h3><p className="mt-1 text-sm tabular-nums text-on-surface-variant">{selected.areaM2} m² · {selected.floors} tầng · {selected.style}</p></div>
          {canManage && <button type="button" onClick={() => setDeleteOpen(true)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 text-sm text-error hover:bg-error-container/20 focus-visible:outline-2 focus-visible:outline-primary"><Trash2 className="size-4" aria-hidden="true" />Xóa</button>}
        </div>
        {canManage && <details className="rounded-lg border border-outline-variant">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-on-surface focus-visible:outline-2 focus-visible:outline-primary">Thông tin dự án</summary>
          <form onSubmit={saveProject} className="grid gap-3 border-t border-outline-variant p-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm text-on-surface-variant"><span>Tên dự án</span><input required minLength={2} maxLength={120} className={inputClass} value={projectDraft.name} onChange={event => setProjectDraft({ ...projectDraft, name: event.target.value })} /></label>
            <label className="block space-y-1 text-sm text-on-surface-variant"><span>Phong cách</span><input required minLength={2} maxLength={100} className={inputClass} value={projectDraft.style} onChange={event => setProjectDraft({ ...projectDraft, style: event.target.value })} /></label>
            <label className="block space-y-1 text-sm text-on-surface-variant"><span>Diện tích (m²)</span><input required type="number" min={20} max={20000} className={inputClass} value={projectDraft.areaM2} onChange={event => setProjectDraft({ ...projectDraft, areaM2: Number(event.target.value) })} /></label>
            <label className="block space-y-1 text-sm text-on-surface-variant"><span>Số tầng</span><input required type="number" min={1} max={12} className={inputClass} value={projectDraft.floors} onChange={event => setProjectDraft({ ...projectDraft, floors: Number(event.target.value) })} /></label>
            <label className="block space-y-1 text-sm text-on-surface-variant sm:col-span-2"><span>Yêu cầu thiết kế</span><textarea maxLength={3000} className={`${inputClass} min-h-20 resize-y`} value={projectDraft.requirements} onChange={event => setProjectDraft({ ...projectDraft, requirements: event.target.value })} /></label>
            <div className="sm:col-span-2"><button type="submit" disabled={busy} className="min-h-9 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60">Lưu thông tin</button></div>
          </form>
        </details>}

        <nav className="flex gap-1 overflow-x-auto border-b border-outline-variant pb-3" aria-label="Công cụ thiết kế kiến trúc">
          {ARCHITECTURE_TOOL_NAV.map(item => <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id)} className={cn("min-h-9 shrink-0 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary", tab === item.id ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:bg-surface-container")}>
            {item.id === "renders" ? `${item.label} (${selected.renders.length})` : item.label}
          </button>)}
          {tab === "plan" && canUseAi && <button type="button" onClick={() => void generatePlan()} disabled={busy} className="ml-auto inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"><Sparkles className="size-4" aria-hidden="true" />{busy ? "Đang tạo…" : "Tạo mặt bằng bằng AI"}</button>}
        </nav>

        </>}

        {page === "rendering" && <nav className="flex gap-1 overflow-x-auto rounded-full bg-surface-container-low p-1.5" aria-label="Công cụ rendering">
          {RENDERING_TABS.map(item => <button key={item.tool} type="button" aria-pressed={tab === item.tool} onClick={() => setTab(item.tool)} className={cn("min-h-10 shrink-0 rounded-full px-4 text-xs font-bold focus-visible:outline-2 focus-visible:outline-primary sm:px-6", tab === item.tool ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface")}>
            {item.label}
          </button>)}
        </nav>}

        {(page === "plan" || (page === "projects" && tab === "plan")) && selected.floors > 1 && <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Chọn tầng">
          <span className="text-sm text-on-surface-variant">Tầng</span>
          {Array.from({ length: selected.floors }, (_, index) => index + 1).map(floor => <button key={floor} type="button" aria-pressed={activeFloor === floor} onClick={() => setActiveFloor(floor)} className={cn("min-h-9 min-w-9 rounded-lg border px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary", activeFloor === floor ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface hover:bg-surface-container")}>{floor}</button>)}
        </div>}

        {(page === "plan" || (page === "projects" && tab === "plan")) ? <div className="space-y-4">
          <FloorPlanEditor key={selected._id} plan={planDraft} onChange={setPlanDraft} disabled={!canManage || busy} floor={activeFloor} floorsCount={selected.floors} canGenerateAi={canUseAi && planDraft.rooms.some(room => room.floor === activeFloor)} canAskAi={canUseAi} aiGenerating={busy} generationError={error} rendering={busy} onGeneratePlan={(prompt, outline) => void generatePlan(prompt, outline)} onGenerate3DRender={image => void generateRenderFrom3D(image)} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant pt-4">
            <p className="text-xs text-on-surface-variant">AI đề xuất phương án tham khảo; hãy kiểm tra kích thước và quy chuẩn trước khi triển khai.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void downloadPlan()} disabled={busy || !planDraft.rooms.length} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 text-sm text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"><Download className="size-4" aria-hidden="true" />Tải bản vẽ PNG</button>
              {canManage && <button type="button" onClick={() => void savePlan()} disabled={busy || !planDraft.rooms.length} className="min-h-9 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60">{busy ? "Đang lưu…" : "Lưu mặt bằng"}</button>}
            </div>
          </div>
        </div> : page === "projects" && tab === "renders" ? <div className="space-y-5">
          <div className="grid gap-4 rounded-lg border border-outline-variant p-4 md:grid-cols-[minmax(12rem,0.6fr)_minmax(12rem,1fr)_auto] md:items-end">
            <label className="block space-y-1 text-sm text-on-surface-variant"><span>Tỷ lệ ảnh</span><select className={inputClass} value={aspectRatio} onChange={event => setAspectRatio(event.target.value)}><option value="4:3">4:3</option><option value="16:9">16:9</option><option value="1:1">1:1</option><option value="3:2">3:2</option><option value="2:3">2:3</option></select></label>
            <label className="block space-y-1 text-sm text-on-surface-variant"><span>Độ phân giải</span><select className={inputClass} value={resolution} onChange={event => setResolution(event.target.value)}><option value="1K">1K · tiêu chuẩn</option><option value="2K">2K · cao</option><option value="4K">4K · tối đa</option></select></label>
            <label className="block space-y-1 text-sm text-on-surface-variant"><span>Yêu cầu phối cảnh</span><input className={inputClass} maxLength={1200} value={renderPrompt} onChange={event => setRenderPrompt(event.target.value)} placeholder="Ví dụ: ánh sáng tự nhiên buổi sáng" /></label>
            {canUseAi && <button type="button" onClick={() => void generateRender()} disabled={busy || !planDraft.rooms.some(room => room.floor === activeFloor)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"><Sparkles className="size-4" aria-hidden="true" />{busy ? "Đang tạo…" : "Tạo phối cảnh"}</button>}
          </div>
          {!planDraft.rooms.some(room => room.floor === activeFloor) && <p className="rounded-lg border border-outline-variant p-4 text-sm text-on-surface-variant">Hãy tạo hoặc thêm mặt bằng cho tầng này trước khi tạo phối cảnh.</p>}
          {selected.renders.length > 0 && <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{[...selected.renders].reverse().map(asset => <figure key={asset.id} className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container">
            {assetUrls[asset.id] ? asset.mimeType === "video/mp4" ? <video src={assetUrls[asset.id]} controls playsInline className="aspect-video w-full bg-surface" aria-label={asset.filename} /> : <img src={assetUrls[asset.id]} alt={`Phối cảnh ${selected.name}, tạo ngày ${new Date(asset.createdAt).toLocaleDateString("vi-VN")}`} className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center text-sm text-on-surface-variant" role="status">Đang tải tệp…</div>}
            <figcaption className="flex flex-wrap items-center justify-between gap-3 p-3 text-xs text-on-surface-variant"><span>{new Date(asset.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · <span className="tabular-nums">{Math.round(asset.bytes / 1024)} KB</span></span>{assetUrls[asset.id] && <a href={assetUrls[asset.id]} download={asset.filename} className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary"><Download className="size-4" aria-hidden="true" />Tải ảnh</a>}</figcaption>
          </figure>)}</div>}
          {!selected.renders.length && <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant text-center"><Sparkles className="mb-2 size-8 text-on-surface-variant" aria-hidden="true" /><p className="text-sm text-on-surface-variant">Chưa có phối cảnh trong dự án này.</p></div>}
          {selected.plan && <details className="rounded-lg border border-outline-variant p-4"><summary className="cursor-pointer text-sm font-medium text-on-surface">Xem lại mặt bằng gốc</summary><div className="mt-4 max-w-xl"><ArchitecturePlanSvg plan={selected.plan} floor={activeFloor} /></div></details>}
        </div> : page === "rendering" ? <ArchitectureCreativeTools tool={tab} project={selected} api={api} assetUrls={assetUrls} canUseAi={canUseAi} canManage={canManage} onProjectUpdated={replaceProject} onNavigate={setTab} /> : page === "projects" && tab !== "renders" ? <ArchitectureCreativeTools tool={tab} project={selected} api={api} assetUrls={assetUrls} canUseAi={canUseAi} canManage={canManage} onProjectUpdated={replaceProject} onNavigate={setTab} /> : page !== "projects" ? <ArchitectureCreativeTools tool={page} project={selected} api={api} assetUrls={assetUrls} canUseAi={canUseAi} canManage={canManage} onProjectUpdated={replaceProject} onNavigate={tool => { setTab(tool); setPage(tool === "render" ? "rendering" : tool); }} /> : null}
      </section>}
    </div>
    <ConfirmDialog appearance="erp" native isOpen={deleteOpen} title="Xóa dự án kiến trúc?" description={`Dự án “${selected?.name || ""}” sẽ bị xóa khỏi chi nhánh hiện tại.`} error={deleteOpen ? error : undefined} confirmLabel="Xóa dự án" isSubmitting={deleting} onClose={() => setDeleteOpen(false)} onConfirm={deleteProject} />
  </div>;
}

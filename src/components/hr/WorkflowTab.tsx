import React, { useState, useEffect, useCallback, useMemo } from "react";
import { renderAsync } from "docx-preview";
import {
  Plus,
  Save,
  Trash2,
  X,
  RefreshCw,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Info,
  FileText,
  Workflow as WorkflowIcon,
  Layers,
  GripVertical,
  ArrowDown,
  ArrowRight,
  ChevronDown,
  Clock,
  CheckCircle2,
  ExternalLink,
  Eye,
} from "lucide-react";
import {
  UserProfile,
  Workflow,
  WorkflowStep,
  WorkflowSubTask,
  TaskAttachment,
} from "../../types";
import { getAccessToken } from "../../services/authService";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { AttachmentEditor } from "./KanbanTab";

interface WorkflowTabProps {
  userProfile: UserProfile | null;
  selectedCompanyCode: string;
  isManager: boolean;
  activeBranchId?: string;
}

const ACCENT = "#00adfc";

let idCounter = 0;
const genId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

function WorkflowStageBranch({ childStages, stageNumber, isDark }: {
  childStages: WorkflowSubTask[];
  stageNumber: number;
  isDark: boolean;
}) {
  const cardHeight = 44;
  const gap = 8;
  const stackHeight = childStages.length * cardHeight + Math.max(0, childStages.length - 1) * gap;
  const height = Math.max(112, stackHeight);
  const middle = height / 2;
  const childCenters = childStages.map((_, index) => (height - stackHeight) / 2 + index * (cardHeight + gap) + cardHeight / 2);
  const lineColor = isDark ? "#38bdf8" : "#00adfc";

  return (
    <div className="flex shrink-0 items-center" aria-label={`${childStages.length} giai đoạn con của bước ${stageNumber}`}>
      <svg width="58" height={height} viewBox={`0 0 58 ${height}`} fill="none" aria-hidden="true" className="shrink-0 overflow-visible">
        {childCenters.map((y, index) => (
          <g key={childStages[index].id} stroke={lineColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={`M0 ${middle} C26 ${middle} 28 ${y} 58 ${y}`} />
            <path d={`m52 ${y - 4} 6 4 -6 4`} />
          </g>
        ))}
      </svg>
      <div className="flex w-40 shrink-0 flex-col justify-center gap-2" style={{ minHeight: height }}>
        {childStages.map((child, index) => (
          <div key={child.id} className={`canvas-node flex h-11 items-center gap-2 rounded-xl border px-2.5 text-xs shadow-sm ${isDark ? "border-zinc-700 bg-zinc-800 text-zinc-100" : "border-[#bceaff] bg-white text-slate-800"}`} title={child.title}>
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#00adfc]" />
            <span className="line-clamp-2 leading-snug">{stageNumber}.{index + 1} {child.title}</span>
          </div>
        ))}
      </div>
      <svg width="62" height={height} viewBox={`0 0 62 ${height}`} fill="none" aria-hidden="true" className="shrink-0 overflow-visible">
        <g stroke={lineColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {childCenters.map((y, index) => <path key={childStages[index].id} d={`M0 ${y} C28 ${y} 28 ${middle} 48 ${middle}`} />)}
          <path d={`M48 ${middle} H62`} />
          <path d={`m56 ${middle - 4} 6 4 -6 4`} />
        </g>
      </svg>
    </div>
  );
}

const WEEKDAY_LABELS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

const fmtScheduleDatetime = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export default function WorkflowTab({
  userProfile,
  selectedCompanyCode,
  isManager,
  activeBranchId,
}: WorkflowTabProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"list" | "detail">("list");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardData, setWizardData] = useState<Workflow | null>(null);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const askConfirm = (
    title: string,
    description: string,
    onConfirm: () => void | Promise<void>,
    confirmLabel = "Xác nhận",
    cancelLabel = "Hủy"
  ) => {
    setConfirmState({
      isOpen: true,
      title,
      description,
      confirmLabel,
      cancelLabel,
      onConfirm: async () => {
        try {
          await onConfirm();
        } finally {
          setConfirmState(null);
        }
      },
    });
  };

  // ---- Theme & Task linkage states ----
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // ---- Trạng thái trang chi tiết ----
  const [activeId, setActiveId] = useState<string>("");
  const [wfName, setWfName] = useState("");
  const [wfCategory, setWfCategory] = useState("");
  const [wfDescription, setWfDescription] = useState("");
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [saving, setSaving] = useState(false);

  // Modal chỉnh sửa bước
  const [stepDraft, setStepDraft] = useState<WorkflowStep | null>(null);

  const canEdit = isManager;

  // ---- Nạp danh sách quy trình ----
  const fetchWorkflows = useCallback(async () => {
    if (!selectedCompanyCode) return;
    setLoading(true);
    try {
      const url = "/api/v1/crud/workflows";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Không thể tải danh sách quy trình.");
      const json = await res.json();
      const list: Workflow[] = (json.data || []).map((it: any) => ({
        ...it,
        id: it._id,
      }));
      setWorkflows(list);
    } catch (err) {
      console.error("Lỗi tải danh sách quy trình:", err);
      toast.error(getApiErrorMessage(err, "Không thể tải danh sách quy trình."));
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyCode, activeBranchId]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // ---- Mở trang chi tiết (wf = null → tạo mới) ----
  const openDetail = (wf: Workflow | null) => {
    if (!wf) {
      setActiveId("");
      setWfName("Quy trình mới");
      setWfCategory("");
      setWfDescription("");
      setSteps([]);
    } else {
      setActiveId(wf.id);
      setWfName(wf.name);
      setWfCategory(wf.category || "");
      setWfDescription(wf.description || "");
      setSteps(wf.steps || []);
    }
    setStepDraft(null);
    setView("detail");
  };

  const backToList = () => {
    setView("list");
    setStepDraft(null);
    fetchWorkflows();
  };

  // ---- Tạo hoặc sửa quy trình từ wizard ----
  const handleWizardSubmit = async (data: {
    name: string;
    category: string;
    description: string;
    steps: WorkflowStep[];
  }) => {
    try {
      const isEdit = !!wizardData;
      const url = isEdit
        ? `/api/v1/crud/workflows/${wizardData.id}`
        : "/api/v1/crud/workflows";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          name: data.name.trim(),
          category: data.category.trim(),
          description: data.description.trim(),
          steps: data.steps,
          ...(isEdit ? {} : { creatorUid: userProfile?.uid || "" }),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Không thể lưu quy trình.");
      const json = await res.json();
      toast.success(isEdit ? "Đã cập nhật quy trình." : "Đã tạo quy trình mới.");
      setWizardOpen(false);
      setWizardData(null);
      await fetchWorkflows();

      // Mở detail nếu là quy trình tạo mới
      if (!isEdit) {
        const wf: Workflow = { ...json.data, id: json.data._id };
        openDetail(wf);
      }
    } catch (err) {
      console.error("Lỗi khi lưu quy trình từ wizard:", err);
      toast.error(getApiErrorMessage(err, "Không thể lưu quy trình."));
    }
  };

  // ---- Lưu quy trình; trả về id đã lưu (hoặc "" nếu lỗi) ----
  const persist = useCallback(
    async (
      override?: Partial<{ steps: WorkflowStep[] }>,
      opts?: { silent?: boolean }
    ): Promise<string> => {
      const payload = {
        name: wfName.trim() || "Quy trình mới",
        category: wfCategory.trim(),
        description: wfDescription.trim(),
        steps: override?.steps ?? steps,
        creatorUid: userProfile?.uid || "",
      };
      const url = activeId
        ? `/api/v1/crud/workflows/${activeId}`
        : "/api/v1/crud/workflows";
      const method = activeId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Không thể lưu quy trình.");
      const json = await res.json();
      const savedId = json.data?._id || activeId;
      if (savedId && savedId !== activeId) setActiveId(savedId);
      if (!opts?.silent)
        toast.success(activeId ? "Đã cập nhật quy trình." : "Đã tạo quy trình mới.");
      return savedId;
    },
    [wfName, wfCategory, wfDescription, steps, activeId, userProfile, activeBranchId]
  );

  // Tự lưu ngầm khi di chuyển bước (chỉ khi đã có bản ghi)
  const autoPersist = useCallback(
    async (override: Partial<{ steps: WorkflowStep[] }>) => {
      if (!activeId) return; // chưa lưu lần đầu → chờ nút Lưu
      try {
        await persist(override, { silent: true });
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Không thể đồng bộ thay đổi lên máy chủ."));
      }
    },
    [activeId, persist]
  );

  const handleSave = async () => {
    if (!wfName.trim()) {
      toast.error("Vui lòng nhập tên quy trình.");
      return;
    }
    setSaving(true);
    try {
      await persist();
      await fetchWorkflows();
    } catch (err) {
      console.error("Lỗi lưu quy trình:", err);
      toast.error(getApiErrorMessage(err, "Không thể lưu quy trình."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkflow = () => {
    if (!activeId) {
      backToList();
      return;
    }
    askConfirm(
      "Xóa quy trình?",
      `Bạn có chắc chắn muốn xóa quy trình "${wfName}"? Thao tác này không thể hoàn tác.`,
      async () => {
        try {
          const res = await fetch(`/api/v1/crud/workflows/${activeId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${getAccessToken()}` },
          });
          if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Không thể xóa quy trình.");
          toast.success("Đã xóa quy trình.");
          backToList();
        } catch (err) {
          console.error("Lỗi xóa quy trình:", err);
          toast.error(getApiErrorMessage(err, "Không thể xóa quy trình."));
        }
      },
      "Xóa quy trình",
      "Hủy"
    );
  };

  // ---- Thao tác với bước ----
  const openNewStep = () => {
    setStepDraft({
      id: genId("step"),
      title: `Bước ${steps.length + 1}`,
      description: "",
      assigneeUid: "",
      assignee: "",
      // Mặc định 1 ngày làm việc để quy trình mới luôn tính được lịch giao việc
      estDays: 1,
      deliverable: "",
      note: "",
    });
  };

  const saveStepDraft = (updated: WorkflowStep) => {
    if (!updated.title.trim()) {
      toast.error("Vui lòng nhập tên bước.");
      return;
    }
    const exists = steps.some((s) => s.id === updated.id);
    const next = exists
      ? steps.map((s) => (s.id === updated.id ? updated : s))
      : [...steps, updated];
    setSteps(next);
    setStepDraft(null);
    autoPersist({ steps: next });
  };

  const deleteStep = (id: string) => {
    askConfirm(
      "Xóa bước này?",
      "Bạn có chắc chắn muốn xóa bước này?",
      () => {
        const nextSteps = steps.filter((s) => s.id !== id);
        setSteps(nextSteps);
        autoPersist({ steps: nextSteps });
      },
      "Xóa bước",
      "Hủy"
    );
  };

  const moveStep = (id: string, dir: -1 | 1) => {
    const idx = steps.findIndex((s) => s.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[idx], next[target]] = [next[target], next[idx]];
    setSteps(next);
    autoPersist({ steps: next });
  };

  // ---- Cột hiển thị: mỗi bước ----
  const columns = useMemo(() => {
    return steps.map((s, i) => ({
      key: s.id,
      order: i + 1,
      step: s,
    }));
  }, [steps]);

  // =================== VIEW: DANH SÁCH ===================
  if (view === "detail") {
    return (
      <>
      <WorkflowReader
        workflow={{
          id: activeId,
          name: wfName,
          category: wfCategory,
          description: wfDescription,
          steps,
        }}
        canEdit={canEdit}
        saving={saving}
        onBack={backToList}
        onAddStep={openNewStep}
        onSave={handleSave}
        onDelete={handleDeleteWorkflow}
      />
      {confirmState && (
        <ConfirmDialog
          appearance="erp"
          showCancel={false}
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          onClose={() => setConfirmState(null)}
          onConfirm={confirmState.onConfirm}
        />
      )}
      </>
    );
  }

  if (view === "list") {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white" id="workflow_tab">
        <div className="mx-5 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce7f4] bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#e8f7ff] p-2.5 text-[#009fdf]">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="flex items-center gap-2 text-base font-medium text-slate-800">
                Quy trình làm việc
                <span className="rounded-full border border-[#bceaff] bg-[#f0faff] px-2.5 py-0.5 text-xs font-normal text-[#008dcc]">
                  {workflows.length}
                </span>
              </h2>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={fetchWorkflows}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-[#f1f8fd] hover:text-[#009fdf]"
              title="Tải lại"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => {
                setWizardData(null);
                setWizardOpen(true);
              }}
              disabled={!canEdit}
              className="flex items-center gap-1.5 rounded-xl bg-[#00adfc] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0097df] disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Quy trình mới
            </button>
          </div>
        </div>

        {wizardOpen && (
          <NewWorkflowWizard
            initialData={wizardData ? (wizardData as any) : undefined}
            onClose={() => {
              setWizardOpen(false);
              setWizardData(null);
            }}
            onSubmit={handleWizardSubmit}
          />
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {workflows.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-[#dce7f4] bg-[#f8fbff] px-5 text-center">
              <span className="rounded-2xl bg-[#e8f7ff] p-3 text-[#00a4ee]"><WorkflowIcon className="h-7 w-7" /></span>
              <p className="mt-3 text-sm font-medium text-slate-700">
                Chưa có quy trình nào
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Nhấn “Quy trình mới” để tạo quy trình gồm các bước thực hiện.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {workflows.map((wf) => {
                const total = wf.steps?.length || 0;
                return (
                  <div
                    key={wf.id}
                    className="group flex flex-col rounded-2xl border border-[#dce7f4] bg-white p-4 text-left shadow-sm transition-all hover:border-[#70d5ff] hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8f7ff] text-[#009fdf]">
                        <WorkflowIcon className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-1">
                        {wf.category && (
                          <span className="mr-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-normal text-slate-500">
                            {wf.category}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(wf);
                          }}
                          className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-[#e8f7ff] hover:text-[#009fdf]"
                          title="Xem chi tiết quy trình"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setWizardData(wf);
                              setWizardOpen(true);
                            }}
                            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-[#e8f7ff] hover:text-[#009fdf]"
                            title="Sửa quy trình"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <h3 className="mt-3 line-clamp-2 text-sm font-medium text-slate-800 group-hover:text-[#008dcc]">
                      {wf.name}
                    </h3>
                    {wf.description && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                        {wf.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-3 text-[11px] font-normal text-slate-500">
                      <span className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" /> {total} bước
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =================== VIEW: CHI TIẾT (BẢNG CỘT) ===================
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden" id="workflow_tab">
      {/* Thanh tiêu đề chính nổi bật */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={backToList}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-[#008dcc] transition-all cursor-pointer shadow-3xs shrink-0 active:scale-95"
            title="Quay lại danh sách quy trình"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Quay lại</span>
          </button>

          <div className="h-6 w-px bg-gray-200 shrink-0" />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-slate-900 truncate font-sans tracking-tight">
                {wfName || "Quy trình chưa đặt tên"}
              </h2>
              {wfCategory && (
                <span className="shrink-0 rounded-md bg-cyan-50 border border-cyan-200 px-2 py-0.5 text-[10px] font-medium tracking-wider text-cyan-700">
                  {wfCategory}
                </span>
              )}
            </div>
            {wfDescription && (
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {wfDescription}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden md:flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600">
            <Layers className="h-3.5 w-3.5 text-cyan-600" /> {steps.length} bước
          </span>
          <button
            onClick={openNewStep}
            disabled={!canEdit}
            className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium text-white shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-40"
            style={{ background: ACCENT }}
          >
            <Plus className="h-4 w-4" /> Thêm bước
          </button>
          <button
            onClick={handleSave}
            disabled={!canEdit || saving}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-700 shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? "Đang lưu..." : "Lưu"}
          </button>
          <button
            onClick={handleDeleteWorkflow}
            disabled={!canEdit}
            className="flex items-center gap-1 rounded-xl border border-red-200 bg-red-50/50 p-2 text-xs font-medium text-red-600 hover:bg-red-100 transition-all cursor-pointer disabled:opacity-40"
            title="Xóa quy trình"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bảng sơ đồ Snake Layout + Danh sách giai đoạn (giống giao diện Thiết lập giai đoạn) */}
      {steps.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
          <Layers className="h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-400">
            Chưa có bước nào trong quy trình
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Nhấn “Thêm bước” để tạo bước đầu tiên.
          </p>
          {canEdit && (
            <button
              onClick={openNewStep}
              className="mt-4 flex items-center gap-1.5 rounded-xl bg-[#00adfc] hover:bg-[#0097df] text-white px-4 py-2 text-xs font-medium transition-all shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Thêm bước mới
            </button>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 border-t border-gray-150">
          {/* Flowchart workspace (Left Column) - Snake Layout */}
          <div
            className={`flex-1 p-8 overflow-y-auto flex items-center justify-center min-h-[450px] relative border-r transition-colors ${isDark ? "bg-[#141414] border-zinc-800/80" : "bg-slate-50/50 border-gray-200"
              }`}
          >
            <div className="grid grid-cols-5 gap-y-16 gap-x-12 relative p-4 max-w-3xl w-full">
              {(() => {
                const rowsCount = Math.ceil(steps.length / 5);
                const cellsCount = rowsCount * 5;
                const gridCells = Array(cellsCount).fill(null);

                steps.forEach((s, idx) => {
                  const r = Math.floor(idx / 5);
                  const c = idx % 5;
                  const c_pos = r % 2 === 0 ? c : 4 - c;
                  gridCells[r * 5 + c_pos] = { step: s, index: idx };
                });

                return gridCells.map((cell, gridIdx) => {
                  if (!cell) {
                    return <div key={`empty-${gridIdx}`} className="w-32 h-20" />;
                  }

                  const { step: s, index: idx } = cell;
                  const r = Math.floor(idx / 5);

                  let arrow = null;
                  if (idx < steps.length - 1) {
                    const nextIdx = idx + 1;
                    const r_next = Math.floor(nextIdx / 5);
                    if (r === r_next) {
                      if (r % 2 === 0) {
                        arrow = (
                          <div className="absolute top-1/2 -translate-y-1/2 -right-8 z-10 flex items-center justify-center">
                            <ArrowRight className={`h-4 w-4 animate-pulse ${isDark ? "text-zinc-550" : "text-slate-400"}`} />
                          </div>
                        );
                      } else {
                        arrow = (
                          <div className="absolute top-1/2 -translate-y-1/2 -left-8 z-10 flex items-center justify-center">
                            <ArrowLeft className={`h-4 w-4 animate-pulse ${isDark ? "text-zinc-550" : "text-slate-400"}`} />
                          </div>
                        );
                      }
                    } else {
                      arrow = (
                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center">
                          <ArrowDown className={`h-4 w-4 animate-pulse ${isDark ? "text-zinc-550" : "text-slate-400"}`} />
                        </div>
                      );
                    }
                  }

                  return (
                    <div
                      key={s.id}
                      onClick={() => setStepDraft(s)}
                      className={`w-32 h-20 relative rounded-xl border flex flex-col justify-center items-center p-2.5 transition-all duration-300 cursor-pointer shadow-xs ${isDark
                        ? "border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/85 hover:border-sky-500"
                        : "border-gray-200 bg-white hover:bg-sky-50/50 hover:border-sky-400 hover:shadow-md"
                        }`}
                      title="Bấm để xem chi tiết / chỉnh sửa giai đoạn"
                    >
                      <span
                        className={`absolute -top-3 left-3 text-[9px] font-medium px-1.5 py-0.5 rounded border shadow-3xs transition-colors ${isDark
                          ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                          : "bg-white text-slate-550 border-gray-200"
                          }`}
                      >
                        {idx + 1}
                      </span>

                      <span
                        className={`text-[10px] font-medium text-center tracking-wide leading-tight px-1 line-clamp-3 transition-colors ${isDark ? "text-zinc-100" : "text-slate-800"
                          }`}
                      >
                        {s.title || "(Chưa đặt tên)"}
                      </span>

                      {idx === 0 && (
                        <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 bg-emerald-600/90 text-white font-medium text-[7px] tracking-wider px-1.5 py-0.5 rounded-t-md shadow-3xs">
                          Bắt đầu
                        </div>
                      )}

                      {arrow}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Sidebar list layout (Right Column) */}
          <div
            className={`w-80 flex flex-col border-l transition-colors duration-300 ${isDark ? "bg-[#1a1a1a] border-zinc-800" : "bg-white border-gray-200"
              }`}
          >
            <div
              className={`px-4 py-3 border-b flex items-center justify-between shadow-2xs transition-colors duration-300 ${isDark ? "bg-[#1d1d1d] border-zinc-800/85" : "bg-slate-50 border-gray-200"
                }`}
            >
              <span className="text-xs font-medium tracking-wider text-slate-500">
                Danh sách giai đoạn
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={openNewStep}
                  className="p-1.5 bg-[#00adfc] hover:bg-[#0097df] text-white rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1 text-[11px] font-medium px-2.5"
                  title="Thêm giai đoạn"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm
                </button>
              )}
            </div>

            {/* Sidebar scrollable list */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
              {steps.map((s, i) => (
                <div
                  key={s.id}
                  onClick={() => setStepDraft(s)}
                  className={`flex items-center gap-3 border p-2.5 rounded-xl transition-all cursor-pointer shadow-3xs ${isDark
                    ? "bg-[#242424] hover:bg-[#2e2e2e] border-zinc-800"
                    : "bg-white hover:bg-slate-50/80 border-gray-200 hover:border-sky-300"
                    }`}
                >
                  <span
                    className={`font-medium text-xs px-2 py-0.5 rounded-lg shadow-3xs border transition-colors ${isDark
                      ? "bg-zinc-800 text-zinc-350 border-zinc-700"
                      : "bg-gray-100 text-slate-500 border-gray-200"
                      }`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`text-xs font-medium truncate flex-1 transition-colors ${isDark ? "text-zinc-200" : "text-slate-750"
                      }`}
                  >
                    {s.title || "(Chưa đặt tên)"}
                  </span>
                  {i === 0 && (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] px-1.5 py-0.5 rounded-md font-medium shadow-3xs">
                      Bắt đầu
                    </span>
                  )}
                  {canEdit && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => moveStep(s.id, -1)}
                        disabled={i === 0}
                        className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-20 cursor-pointer"
                        title="Chuyển lên"
                      >
                        <ChevronLeft className="h-3.5 w-3.5 rotate-90" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(s.id, 1)}
                        disabled={i === steps.length - 1}
                        className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-20 cursor-pointer"
                        title="Chuyển xuống"
                      >
                        <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setStepDraft(s)}
                        className={`p-1 rounded-md transition-colors cursor-pointer ${isDark
                          ? "text-zinc-450 hover:bg-zinc-800 hover:text-sky-400"
                          : "text-slate-400 hover:bg-slate-100 hover:text-[#008dcc]"
                          }`}
                        title="Sửa giai đoạn"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteStep(s.id)}
                        className={`p-1 rounded-md transition-colors cursor-pointer ${isDark
                          ? "text-zinc-450 hover:bg-zinc-800 hover:text-rose-455"
                          : "text-slate-400 hover:bg-slate-100 hover:text-rose-650"
                          }`}
                        title="Xóa giai đoạn"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal chỉnh sửa bước — dùng chung editor với wizard tạo quy trình */}
      {stepDraft && (
        <WizardStepEditorModal
          step={stepDraft}
          steps={steps}
          stepIndex={(() => {
            const i = steps.findIndex((s) => s.id === stepDraft.id);
            return i >= 0 ? i : steps.length; // bước mới → coi như nằm cuối
          })()}
          isDark={isDark}
          onClose={() => setStepDraft(null)}
          onSave={saveStepDraft}
        />
      )}

      {confirmState && (
        <ConfirmDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          onClose={() => setConfirmState(null)}
          onConfirm={confirmState.onConfirm}
        />
      )}
    </div>
  );
}

// ============ Wizard 2 bước tạo quy trình mới ============
export function WorkflowReader({
  workflow,
  canEdit,
  saving = false,
  onBack,
  onAddStep,
  onSave,
  onDelete,
}: {
  workflow: Pick<Workflow, "id" | "name" | "category" | "description" | "steps">;
  canEdit: boolean;
  saving?: boolean;
  onBack: () => void;
  onAddStep: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<TaskAttachment | null>(null);
  const [showStageBranches, setShowStageBranches] = useState(false);
  const flowRef = React.useRef<HTMLDivElement>(null);
  const [flowWidth, setFlowWidth] = useState(0);

  useEffect(() => {
    const element = flowRef.current;
    if (!element) return;
    const updateWidth = () => setFlowWidth(element.clientWidth);
    updateWidth();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [workflow.steps.length]);

  const branchWidth = (step: WorkflowStep) => showStageBranches && step.subTasks?.length ? 280 : 0;
  const rowWidth = (start: number, end: number) => {
    let width = 0;
    for (let index = start; index < end; index++) {
      width += 192;
      if (index < end - 1) width += branchWidth(workflow.steps[index]) || 46;
      else if (end < workflow.steps.length) width += branchWidth(workflow.steps[index]);
      else if (branchWidth(workflow.steps[index])) width += 280 + 192;
    }
    return width;
  };
  const rowHeight = (start: number, end: number) => Math.max(112, ...workflow.steps.slice(start, end).map((step) => {
    const count = showStageBranches ? step.subTasks?.length || 0 : 0;
    return count ? count * 44 + (count - 1) * 8 : 112;
  }));
  const flowRows: { start: number; end: number; width: number; height: number; offset: number }[] = [];
  const availableWidth = Math.max(640, (flowWidth || 948) - 48);
  for (let start = 0; start < workflow.steps.length;) {
    const previousRow = flowRows[flowRows.length - 1];
    let desiredOffset = 0;
    if (previousRow) {
      // Center the next main stage below the previous row's outgoing arrow.
      desiredOffset = previousRow.offset + previousRow.width - 96;
    }
    let end = start + 1;
    while (end < workflow.steps.length && rowWidth(start, end + 1) <= availableWidth - desiredOffset) end++;
    const offset = Math.min(desiredOffset, Math.max(0, availableWidth - rowWidth(start, end)));
    flowRows.push({ start, end, width: rowWidth(start, end), height: rowHeight(start, end), offset });
    start = end;
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white" id="workflow_tab">
        <div className="mx-5 mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#dce7f4] bg-white px-4 py-3 shadow-sm">
          <button onClick={onBack} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-[#f1f8fd]">
            <ArrowLeft className="h-4 w-4" /> Danh sách quy trình
          </button>
          <div className="ml-auto flex items-center gap-2">
            {canEdit && (
              <>
                <button onClick={onAddStep} className="flex items-center gap-1 rounded-xl bg-[#00adfc] px-3 py-2 text-xs font-medium text-white hover:bg-[#0097df]">
                  <Plus className="h-3.5 w-3.5" /> Thêm bước
                </button>
                <button onClick={onSave} disabled={saving} className="flex items-center gap-1 rounded-xl border border-[#bceaff] bg-[#e8f7ff] px-3 py-2 text-xs font-medium text-[#008dcc] hover:bg-[#d7f2ff] disabled:opacity-50">
                  <Save className="h-3.5 w-3.5" /> {saving ? "Đang lưu..." : "Lưu"}
                </button>
                <button onClick={onDelete} className="flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2 py-2 text-xs font-medium text-red-600 hover:bg-red-100" title="Xóa quy trình">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="mx-auto max-w-6xl">
            <div className="rounded-2xl border border-[#dce7f4] bg-[#f8fbff] p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-normal text-[#008dcc]">Hướng dẫn quy trình</p>
                  <h1 className="mt-2 text-xl font-medium text-slate-800">{workflow.name}</h1>
                  {workflow.category && <p className="mt-1 text-xs font-normal text-slate-500">{workflow.category}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {workflow.steps.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowStageBranches((current) => !current)}
                      aria-label={showStageBranches ? "Ẩn chi tiết giai đoạn con" : "Xem chi tiết giai đoạn con"}
                      aria-pressed={showStageBranches}
                      title={showStageBranches ? "Ẩn giai đoạn con" : "Xem giai đoạn con"}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${showStageBranches ? "border-[#00adfc] bg-[#e8f7ff] text-[#008dcc]" : "border-[#dce7f4] bg-white text-slate-500 hover:border-[#8edcff] hover:text-[#008dcc]"}`}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
              </div>
              {workflow.description && <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-600">{workflow.description}</p>}
            </div>

            {workflow.steps.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-[#dce7f4] bg-[#f8fbff] p-8 text-center text-sm font-normal text-slate-500">
                Chưa có bước nào trong quy trình.
              </div>
            ) : (
              <div ref={flowRef} className="mt-5 overflow-x-auto rounded-2xl border border-[#dce7f4] bg-[#f8fbff] p-6" style={{ backgroundImage: "radial-gradient(#d5e4f4 0.8px, transparent 0.8px)", backgroundSize: "20px 20px" }}>
                <div className="flex flex-col items-start py-8">
                {flowRows.map((row, rowIndex) => {
                  const hasNextRow = rowIndex < flowRows.length - 1;
                  const nextRow = flowRows[rowIndex + 1];
                  const connectorHeight = row.height / 2 + 64 + (nextRow ? (nextRow.height - 112) / 2 : 0);
                  const nextCenter = nextRow ? nextRow.offset - row.offset + 96 : 96;
                  const connectorLeft = Math.min(0, nextCenter);
                  const connectorWidth = Math.max(row.width, nextCenter) - connectorLeft;
                  return <div key={row.start} className="relative" style={{ width: row.width, minHeight: row.height, marginBottom: hasNextRow ? 64 : 0, marginLeft: row.offset }}>
                  <ol className="relative z-10 flex items-center" style={{ minHeight: row.height }}>
                  {workflow.steps.slice(row.start, row.end).map((step, offset) => {
                    const index = row.start + offset;
                    const childStages = step.subTasks || [];
                    const hasNext = index < workflow.steps.length - 1;
                    const hasNextInRow = index < row.end - 1;
                    return (
                      <React.Fragment key={step.id}>
                        <li
                          onClick={() => setSelectedStep(step)}
                          className="flex h-28 w-48 shrink-0 cursor-pointer flex-col justify-center rounded-2xl border border-[#dce7f4] bg-white p-4 shadow-sm transition-all hover:border-[#70d5ff] hover:shadow-md"
                        >
                          <span className="text-[10px] text-[#008dcc]">Bước {index + 1}</span>
                          <h2 className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-slate-800">{step.title || `Bước ${index + 1}`}</h2>
                          {!showStageBranches && childStages.length > 0 && <span className="mt-2 text-[10px] text-slate-500">{childStages.length} giai đoạn con</span>}
                        </li>
                        {showStageBranches && childStages.length > 0 ? (
                          <>
                            <li className="list-none"><WorkflowStageBranch childStages={childStages} stageNumber={index + 1} isDark={false} /></li>
                            {!hasNext && <li className="flex h-28 w-48 shrink-0 items-center justify-center rounded-2xl border border-[#dce7f4] bg-white text-sm text-slate-700 shadow-sm">Kết thúc</li>}
                          </>
                        ) : hasNextInRow ? (
                          <li className="list-none" aria-hidden="true"><svg width="46" height="112" viewBox="0 0 46 112" fill="none" aria-hidden="true" className="shrink-0"><path d="M0 56h46m-6-5 6 5-6 5" stroke="#00adfc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></li>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </ol>
                {hasNextRow && <svg className="pointer-events-none absolute top-1/2 overflow-visible" style={{ left: connectorLeft }} width={connectorWidth} height={connectorHeight} viewBox={`${connectorLeft} 0 ${connectorWidth} ${connectorHeight}`} fill="none" aria-hidden="true"><path d={`M${row.width} 0 V${connectorHeight - 22} H${nextCenter} V${connectorHeight}`} stroke="#00adfc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d={`m${nextCenter - 5} ${connectorHeight - 5} 5 5 5 -5`} stroke="#00adfc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>;
                })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {selectedStep && (
        <WorkflowStepDetailModal
          step={selectedStep}
          stepIndex={workflow.steps.findIndex((step) => step.id === selectedStep.id)}
          canEdit={canEdit}
          onClose={() => setSelectedStep(null)}
          onPreview={setPreviewAttachment}
        />
      )}
      {previewAttachment && <WorkflowAttachmentPreview attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />}
    </>
  );
}

function WorkflowStepDetailModal({
  step,
  stepIndex,
  canEdit,
  onClose,
  onPreview,
}: {
  step: WorkflowStep;
  stepIndex: number;
  canEdit: boolean;
  onClose: () => void;
  onPreview: (attachment: TaskAttachment) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#dce7f4] bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="workflow-step-detail-title" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-normal text-[#008dcc]">Bước {stepIndex + 1}</p>
            <h2 id="workflow-step-detail-title" className="mt-1 text-xl font-medium text-slate-800">{step.title || `Bước ${stepIndex + 1}`}</h2>
          </div>
          <button onClick={onClose} className="rounded-full bg-rose-500 p-2 text-white hover:bg-rose-600" aria-label="Đóng"><X className="h-4 w-4" /></button>
        </div>
        {step.description && <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">{step.description}</p>}
        {step.note && <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800"><strong>Lưu ý:</strong> {step.note}</div>}
        {step.deliverable && <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800"><strong>Kết quả cần đạt:</strong> {step.deliverable}</div>}
        {!!step.subTasks?.length && <div className="mt-5"><h3 className="text-xs font-medium tracking-wide text-slate-500">Giai đoạn con</h3><ul className="mt-2 space-y-2">{step.subTasks.map((task) => <li key={task.id} className="flex items-center gap-2 text-sm text-slate-700"><span className="h-2 w-2 shrink-0 rounded-full bg-[#00adfc]" />{task.title}</li>)}</ul></div>}
        {!!step.attachments?.length && <div className="mt-5"><h3 className="text-xs font-medium tracking-wide text-slate-500">Tệp đính kèm</h3><div className="mt-2 flex flex-wrap gap-2">{step.attachments.map((attachment) => <button key={attachment.id} type="button" onClick={() => onPreview(attachment)} className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-sky-600 hover:bg-sky-50"><ExternalLink className="h-3.5 w-3.5" />Xem preview: {attachment.name}</button>)}</div></div>}
      </div>
    </div>
  );
}

function WorkflowAttachmentPreview({ attachment, onClose }: { attachment: TaskAttachment; onClose: () => void }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [docxError, setDocxError] = useState(false);
  const type = (attachment.type || "").toLowerCase(); const name = (attachment.name || attachment.url).toLowerCase(); const extension = name.split("?")[0].split(".").pop() || "";
  const isImage = type === "image" || type.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(extension); const isVideo = type === "video" || type.startsWith("video/") || ["mp4", "webm", "mov"].includes(extension); const isAudio = type === "audio" || type.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "aac"].includes(extension); const isPdf = type.includes("pdf") || extension === "pdf"; const isDocx = extension === "docx" || type.includes("wordprocessingml");
  const isOffice = ["doc", "xls", "xlsx", "ppt", "pptx"].includes(extension) || /word|excel|sheet|presentation/.test(type);
  const accessToken = getAccessToken() || "";
  const downloadUrl = `/api/v1/media/download?url=${encodeURIComponent(attachment.url)}&filename=${encodeURIComponent(attachment.name || "tai-lieu-quy-trinh")}&token=${encodeURIComponent(accessToken)}`; const previewUrl = `${downloadUrl}&inline=true`;
  useEffect(() => { const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose(); document.addEventListener("keydown", fn); return () => document.removeEventListener("keydown", fn); }, [onClose]);
  useEffect(() => { if (!isDocx || !containerRef.current) return; let cancelled = false; void fetch(attachment.url).then((r) => r.ok ? r.blob() : Promise.reject(new Error("download failed"))).then((blob) => !cancelled && containerRef.current && renderAsync(blob, containerRef.current, undefined, { className: "docx-preview" })).catch(() => !cancelled && setDocxError(true)); return () => { cancelled = true; }; }, [attachment.url, isDocx]);
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="presentation" onClick={onClose}><div className="w-full max-w-5xl rounded-2xl bg-white p-5 shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-contain" role="dialog" aria-modal="true" aria-label="Preview tệp" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between gap-3"><h2 className="truncate text-base font-medium text-slate-800">{attachment.name}</h2><button type="button" onClick={onClose} aria-label="Đóng preview" className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100">×</button></div><div className="mt-4 flex min-h-48 max-h-[70vh] items-center justify-center overflow-auto rounded-xl bg-slate-100 p-4">{isImage && <img src={attachment.url} alt={attachment.name} className="max-h-[65vh] max-w-full object-contain" />}{isVideo && <video src={attachment.url} controls className="max-h-[65vh] max-w-full" />}{isAudio && <audio src={attachment.url} controls />}{isPdf && <iframe src={previewUrl} className="h-[65vh] w-full border-0 bg-white" title={attachment.name} />}{isDocx && !docxError && <div ref={containerRef} className="w-full bg-white p-4" />}{isOffice && !isPdf && !isDocx && <iframe src={`https://docs.google.com/gview?url=${encodeURIComponent(attachment.url)}&embedded=true`} className="h-[65vh] w-full border-0 bg-white" title={attachment.name} />}{!isImage && !isVideo && !isAudio && !isPdf && !isOffice && <PreviewFallback downloadUrl={downloadUrl} />}{docxError && <PreviewFallback downloadUrl={downloadUrl} />}</div><div className="mt-4 flex justify-end gap-2"><a href={downloadUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-[#00adfc] px-3 py-2 text-xs font-medium text-white">Tải xuống</a><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600">Đóng</button></div></div></div>;
}
function PreviewFallback({ downloadUrl }: { downloadUrl: string }) { return <div className="text-center text-sm text-slate-600"><p>Không thể xem trước trực tiếp loại tệp này.</p><a href={downloadUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg bg-[#00adfc] px-3 py-2 font-medium text-white">Mở tệp</a></div>; }
function NewWorkflowWizard({
  initialData,
  onClose,
  onSubmit,
}: {
  initialData?: {
    name: string;
    category: string;
    description: string;
    steps: WorkflowStep[];
  };
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    category: string;
    description: string;
    steps: WorkflowStep[];
  }) => void | Promise<void>;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(initialData?.name || "Quy trình mới");
  const [category, setCategory] = useState(initialData?.category || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [steps, setSteps] = useState<WorkflowStep[]>(initialData?.steps || []);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState<"diagram" | "list">("list");


  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".canvas-node") || (e.target as HTMLElement).closest("button")) {
      return;
    }
    if (e.button !== 0) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsPanning(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest(".canvas-node") || (e.target as HTMLElement).closest("button")) {
      return;
    }
    if (e.touches.length !== 1) return;
    setIsPanning(true);
    const touch = e.touches[0];
    setPanStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPanning) return;
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPan({
      x: touch.clientX - panStart.x,
      y: touch.clientY - panStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
  };


  const handleZoom = (factor: number) => {
    setZoom((prev) => Math.min(Math.max(prev * factor, 0.5), 2));
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);
  const [showStageBranches, setShowStageBranches] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const isEditing = Boolean(initialData);

  // Check if dark mode is active in the document element
  const [isDarkTheme, setIsDarkTheme] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    // Observe class changes on documentElement to dynamically toggle theme
    const observer = new MutationObserver(() => {
      setIsDarkTheme(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const isDark = isDarkTheme;

  const addStage = () => {
    const s: WorkflowStep = {
      id: genId("step"),
      title: `Giai đoạn ${steps.length + 1}`,
      description: "",
      assigneeUid: "",
      assignee: "",
      // Mặc định 1 ngày làm việc để quy trình mới luôn tính được lịch giao việc
      estDays: 1,
      deliverable: "",
      note: "",
    };
    setSteps((prev) => [...prev, s]);
    setSelectedId(s.id);
  };

  const deleteStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (expandedStageId === id) setExpandedStageId(null);
  };

  const toggleStageDetails = (id: string) => {
    setSelectedId(id);
    setExpandedStageId((current) => current === id ? null : id);
  };

  const reorder = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setSteps((prev) => {
      const arr = [...prev];
      const from = arr.findIndex((s) => s.id === dragId);
      const to = arr.findIndex((s) => s.id === targetId);
      if (from < 0 || to < 0) return prev;
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
    setDragId(null);
  };

  const moveStep = (id: string, direction: -1 | 1) => {
    setSteps((prev) => {
      const arr = [...prev];
      const idx = arr.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= arr.length) return prev;
      const [moved] = arr.splice(idx, 1);
      arr.splice(nextIdx, 0, moved);
      return arr;
    });
  };


  const goNext = () => {
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên quy trình.");
      return;
    }
    setStep(2);
  };

  const handleFinish = async () => {
    if (steps.length === 0) {
      toast.error("Hãy thêm ít nhất một giai đoạn công việc.");
      return;
    }
    if (steps.some((s) => !s.title.trim())) {
      toast.error("Mỗi bước cần có tên.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ name, category, description, steps });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-[22px] shadow-[0_28px_90px_rgba(24,46,85,0.25)] transition-all duration-300 ${step === 2 ? "max-w-[1380px]" : "max-w-4xl"
          } ${isDark
            ? "bg-[#121212] border border-zinc-800 text-zinc-100"
            : "bg-white border border-[#dce7f4] text-slate-850"
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + Title */}
        <div
          className={`flex items-center justify-between border-b px-5 py-4 sm:px-7 transition-colors ${isDark ? "bg-[#181818] border-zinc-800" : "bg-white border-[#e4edf7]"
            }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isDark ? "bg-sky-950/60" : "bg-[#e8f7ff]"}`}>
              <WorkflowIcon className="h-5 w-5 text-[#00adfc]" />
            </span>
            <div className="min-w-0">
              <h3 className={`text-lg font-semibold leading-tight ${isDark ? "text-zinc-100" : "text-slate-900"}`}>
                {isEditing ? "Sửa quy trình" : "Tạo quy trình mới"}
              </h3>
              <p className={`mt-0.5 text-xs ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                Thiết kế luồng công việc phù hợp với cách vận hành của bạn
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng popup quy trình"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-rose-500 text-white shadow-sm transition-colors hover:bg-rose-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Các bước thiết lập hiện có */}
        <div className={`flex flex-wrap items-center gap-2 border-b px-5 py-2.5 sm:px-7 ${isDark ? "border-zinc-800 bg-[#181818]" : "border-[#e4edf7] bg-[#f8fbff]"}`}>
            {[
              { n: 1, label: "Thông tin quy trình" },
              { n: 2, label: "Thiết lập giai đoạn" },
            ].map((s, i) => (
              <React.Fragment key={s.n}>
                <div className={`flex items-center gap-2 rounded-full px-2.5 py-1.5 ${step === s.n ? (isDark ? "bg-sky-950/50" : "bg-[#e8f7ff]") : ""}`}>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${step >= (s.n as 1 | 2) ? "bg-[#00adfc] text-white" : isDark ? "bg-zinc-700 text-zinc-300" : "bg-[#e0e9f4] text-slate-600"
                      }`}
                  >
                    {s.n}
                  </span>
                  <span className={`text-xs font-medium ${step === s.n ? "text-[#008dcc]" : isDark ? "text-zinc-400" : "text-slate-500"}`}>
                    {s.label}
                  </span>
                </div>
                {i === 0 && <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />}
              </React.Fragment>
            ))}
        </div>


        {/* Mobile View Toggle Tabs for Step 2 */}
        {step === 2 && (
          <div className={`flex md:hidden border-b p-2 gap-2 transition-colors ${
            isDark ? "bg-[#181818] border-zinc-800" : "bg-slate-50 border-gray-200"
          }`}>
            <button
              type="button"
              onClick={() => setActiveTab("diagram")}
              className={`flex-1 py-1.5 text-xs font-medium rounded-xl transition-all ${
                activeTab === "diagram"
                  ? "bg-[#00adfc] text-white shadow-xs"
                  : isDark
                    ? "text-zinc-400 hover:bg-zinc-800"
                    : "text-slate-500 hover:bg-gray-105"
              }`}
            >
              Sơ đồ quy trình
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("list")}
              className={`flex-1 py-1.5 text-xs font-medium rounded-xl transition-all ${
                activeTab === "list"
                  ? "bg-[#00adfc] text-white shadow-xs"
                  : isDark
                    ? "text-zinc-400 hover:bg-zinc-800"
                    : "text-slate-500 hover:bg-gray-105"
              }`}
            >
              Danh sách ({steps.length})
            </button>
          </div>
        )}

        {/* ---- BƯỚC 1: Thông tin ---- */}
        {step === 1 && (
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-normal text-slate-700">
                <FileText className="h-4 w-4" /> Tên quy trình
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Hướng dẫn nhân viên mới"
                className="mt-1.5 w-full rounded-xl border border-[#dce7f4] px-4 py-2.5 text-sm font-normal outline-none transition-all focus:border-[#00adfc] focus:ring-2 focus:ring-[#00adfc]/10"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-normal text-slate-700">
                <Layers className="h-4 w-4" /> Nhóm / phân loại
              </label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="VD: Nhân sự, Vận hành…"
                className="mt-1.5 w-full rounded-xl border border-[#dce7f4] px-4 py-2.5 text-sm font-normal outline-none transition-all focus:border-[#00adfc] focus:ring-2 focus:ring-[#00adfc]/10"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-normal text-slate-700">
                <Info className="h-4 w-4" /> Ghi chú / mô tả quy trình
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Mục tiêu, phạm vi áp dụng, lưu ý chung của quy trình…"
                className="mt-1.5 w-full resize-none rounded-xl border border-[#dce7f4] px-4 py-2.5 text-sm font-normal outline-none transition-all focus:border-[#00adfc] focus:ring-2 focus:ring-[#00adfc]/10"
              />
            </div>
          </div>
        )}

        {/* ---- BƯỚC 2: Thiết lập giai đoạn theo snake layout ---- */}
        {step === 2 && (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            {/* Flowchart workspace (Left Column) */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                const data = e.dataTransfer.getData("text/plain");
                if (data === "new-step") {
                  addStage();
                }
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className={`flex-1 overflow-hidden items-center justify-center min-h-[480px] relative border-r transition-colors touch-none ${
                isPanning ? "cursor-grabbing" : "cursor-grab"
              } ${isDark ? "bg-[#141414] border-zinc-800/80" : "bg-[#f8fbff] border-[#dce7f4]"} ${
                activeTab === "diagram" ? "flex" : "hidden md:flex"
              }`}
              style={{
                backgroundImage: isDark
                  ? "radial-gradient(#334155 0.8px, transparent 0.8px)"
                  : "radial-gradient(#d5e4f4 0.8px, transparent 0.8px)",
                backgroundSize: "20px 20px",
              }}
            >
              {/* Điều khiển sơ đồ */}
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
              <button
                type="button"
                draggable
                onClick={addStage}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", "new-step");
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className={`flex items-center gap-1.5 rounded-xl border border-dashed px-3 py-2 text-xs transition-colors shadow-sm cursor-grab active:cursor-grabbing ${isDark
                  ? "bg-[#1f1f1f] border-zinc-700 text-sky-400 hover:bg-zinc-800"
                  : "bg-white border-[#8edcff] text-[#008dcc] hover:bg-[#e8f7ff]"
                  }`}
                title="Bấm hoặc Kéo thả vào vùng làm việc để tạo giai đoạn mới"
              >
                <Plus className="h-4 w-4" /> Thêm giai đoạn
              </button>
              <button
                type="button"
                onClick={() => setShowStageBranches((current) => !current)}
                aria-label={showStageBranches ? "Ẩn chi tiết giai đoạn con" : "Xem chi tiết giai đoạn con"}
                aria-pressed={showStageBranches}
                title={showStageBranches ? "Ẩn giai đoạn con" : "Xem giai đoạn con"}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-colors ${showStageBranches
                  ? isDark ? "border-sky-500 bg-sky-950 text-sky-300" : "border-[#00adfc] bg-[#e8f7ff] text-[#008dcc]"
                  : isDark ? "border-zinc-700 bg-[#1f1f1f] text-zinc-300 hover:text-sky-400" : "border-[#dce7f4] bg-white text-slate-500 hover:border-[#8edcff] hover:text-[#008dcc]"}`}
              >
                <Eye className="h-4 w-4" />
              </button>
              </div>

              {steps.length === 0 ? (
                <div className={`text-center transition-colors ${isDark ? "text-zinc-550" : "text-slate-400"}`}>
                  <WorkflowIcon className={`h-10 w-10 mx-auto mb-3 ${isDark ? "text-zinc-700" : "text-slate-300"}`} />
                  <p className="text-xs font-medium">Chưa có giai đoạn nào</p>
                  <p className={`text-[10px] mt-1 ${isDark ? "text-zinc-650" : "text-slate-400"}`}>
                    Hãy thêm giai đoạn ở danh sách bên phải.
                  </p>
                </div>
              ) : (
                <div
                  className="flex w-max min-w-max select-none flex-col gap-y-12 p-16"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: "center center",
                    transition: isPanning ? "none" : "transform 0.15s ease-out",
                  }}
                >
                  {(() => {
                    const rows: { step: WorkflowStep; index: number }[][] = [];
                    const addRows = (start: number, end: number) => {
                      for (let i = start; i < end; i += 3) {
                        rows.push(steps.slice(i, Math.min(i + 3, end)).map((step, idx) => ({ step, index: i + idx })));
                      }
                    };
                    if (showStageBranches) {
                      rows.push(steps.map((step, index) => ({ step, index })));
                    } else {
                      addRows(0, steps.length);
                    }

                    return rows.map((row, rowIndex) => (
                      <div key={rowIndex} className="relative flex w-max min-w-max items-center">
                        {row.map(({ step: s, index: idx }, cellIndex) => {
                          const isSelected = selectedId === s.id;
                          const isExpanded = showStageBranches;
                          const childStages = s.subTasks || [];
                          const hasNextInRow = cellIndex < row.length - 1;

                          return (
                            <React.Fragment key={s.id}>
                              {/* Node Card */}
                              <div
                                draggable
                                onClick={() => setSelectedId(s.id)}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData("text/plain", `workflow-step:${s.id}`);
                                  e.dataTransfer.effectAllowed = "move";
                                  setDragId(s.id);
                                  setSelectedId(s.id);
                                }}
                                onDragOver={(e) => {
                                  if (!dragId || dragId === s.id) return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  e.dataTransfer.dropEffect = "move";
                                  setDropTargetId(s.id);
                                }}
                                onDragLeave={(e) => {
                                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTargetId(null);
                                }}
                                onDrop={(e) => {
                                  if (!dragId) return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  reorder(s.id);
                                  setDropTargetId(null);
                                }}
                                onDragEnd={() => {
                                  setDragId(null);
                                  setDropTargetId(null);
                                }}
                                className={`canvas-node relative min-h-28 w-48 shrink-0 cursor-grab rounded-2xl border p-4 text-left shadow-[0_8px_22px_rgba(35,67,113,0.10)] transition-all duration-200 active:cursor-grabbing ${dragId === s.id ? "opacity-50" : ""} ${dropTargetId === s.id ? "ring-2 ring-[#00adfc] ring-offset-2" : ""} ${
                                  isSelected
                                    ? isDark
                                      ? "border-sky-500 bg-sky-950/20 ring-2 ring-sky-500/20"
                                      : "border-[#00adfc] bg-white ring-2 ring-[#00adfc]/15 shadow-[0_10px_26px_rgba(0,173,252,0.16)]"
                                    : isDark
                                      ? "border-zinc-750 bg-zinc-900/60 hover:bg-zinc-800/80 hover:border-zinc-500"
                                      : "border-[#dce7f4] bg-white hover:border-[#8edcff] hover:shadow-[0_12px_26px_rgba(35,67,113,0.15)]"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`text-[10px] ${isDark ? "text-sky-400" : "text-[#008dcc]"}`}>Bước {idx + 1}</span>
                                </div>

                                <h4
                                  className={`mt-1 line-clamp-2 text-sm font-medium leading-snug transition-colors ${
                                    isSelected
                                      ? isDark
                                        ? "text-sky-400"
                                        : "text-sky-700"
                                      : isDark
                                        ? "text-zinc-100"
                                        : "text-slate-800"
                                  }`}
                                >
                                  {s.title || "(Chưa đặt tên)"}
                                </h4>

                                {s.description && (
                                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                                    {s.description}
                                  </p>
                                )}
                                {childStages.length > 0 && !isExpanded && <p className={`mt-2 text-[10px] ${isDark ? "text-zinc-400" : "text-slate-500"}`}>{childStages.length} giai đoạn con</p>}
                              </div>
                              {isExpanded && childStages.length > 0 ? (
                                <>
                                  <WorkflowStageBranch childStages={childStages} stageNumber={idx + 1} isDark={isDark} />
                                  {!hasNextInRow && (
                                    <div className={`canvas-node flex min-h-28 w-48 shrink-0 items-center justify-center rounded-2xl border text-sm ${isDark ? "border-zinc-700 bg-zinc-900 text-zinc-200" : "border-[#dce7f4] bg-white text-slate-700"}`}>
                                      Kết thúc
                                    </div>
                                  )}
                                </>
                              ) : hasNextInRow ? (
                                <svg width="46" height="112" viewBox="0 0 46 112" fill="none" aria-hidden="true" className="shrink-0">
                                  <path d="M0 56h46m-6-5 6 5-6 5" stroke={isDark ? "#38bdf8" : "#00adfc"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              ) : null}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>
              )}

              {/* Zoom Controls */}
              {steps.length > 0 && (
                <div className={`absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-xl border p-1 shadow-sm ${isDark ? "border-zinc-700 bg-[#1f1f1f]" : "border-[#dce7f4] bg-white"}`}>
                  <button
                    type="button"
                    onClick={() => handleZoom(0.85)}
                    className={`h-8 w-8 flex items-center justify-center rounded-xl border shadow-3xs text-sm font-medium transition-all active:scale-90 cursor-pointer ${
                      isDark ? "bg-[#1f1f1f] border-zinc-800 text-zinc-300 hover:bg-zinc-800" : "bg-white border-gray-200 text-slate-600 hover:bg-slate-50"
                    }`}
                    title="Thu nhỏ"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }}
                    className={`h-8 px-3 flex items-center justify-center rounded-xl border shadow-3xs text-[10px] font-medium tracking-wider transition-all active:scale-90 cursor-pointer ${
                      isDark ? "bg-[#1f1f1f] border-zinc-800 text-zinc-300 hover:bg-zinc-800" : "bg-white border-gray-200 text-slate-600 hover:bg-slate-50"
                    }`}
                    title="Đặt lại"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleZoom(1.15)}
                    className={`h-8 w-8 flex items-center justify-center rounded-xl border shadow-3xs text-sm font-medium transition-all active:scale-90 cursor-pointer ${
                      isDark ? "bg-[#1f1f1f] border-zinc-800 text-zinc-300 hover:bg-zinc-800" : "bg-white border-gray-200 text-slate-600 hover:bg-slate-50"
                    }`}
                    title="Phóng to"
                  >
                    +
                  </button>
                </div>
              )}
            </div>

            {/* Sidebar list layout (Right Column) */}
            <div
              className={`w-full md:w-[360px] flex flex-col border-l transition-colors duration-300 ${
                isDark ? "bg-[#1a1a1a] border-zinc-800" : "bg-white border-[#dce7f4]"
              } ${activeTab === "list" ? "flex" : "hidden md:flex"}`}
            >
              <div
                className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 transition-colors duration-300 ${isDark ? "bg-[#1d1d1d] border-zinc-800/85" : "bg-white border-[#e4edf7]"
                  }`}
              >
                <h4 className={`text-sm font-semibold ${isDark ? "text-zinc-100" : "text-slate-900"}`}>Danh sách giai đoạn</h4>
                <button
                  type="button"
                  onClick={addStage}
                  className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#00adfc] px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#0097df]"
                >
                  <Plus className="h-4 w-4" /> Thêm giai đoạn
                </button>
              </div>

              {/* Sidebar scrollable list */}
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
                {steps.length === 0 ? (
                  <p className={`rounded-2xl border border-dashed px-4 py-8 text-center text-xs ${isDark ? "border-zinc-700 text-zinc-400" : "border-[#dce7f4] text-slate-500"}`}>Chưa có giai đoạn. Nhấn “Thêm giai đoạn” để bắt đầu.</p>
                ) : (
                  steps.map((s, i) => (
                    <React.Fragment key={s.id}>
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", `workflow-step:${s.id}`);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(s.id);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => reorder(s.id)}
                      onDragEnd={() => setDragId(null)}
                      className={`flex items-center gap-2 border p-3 rounded-2xl transition-all cursor-pointer shadow-sm ${selectedId === s.id
                        ? isDark
                          ? "border-sky-500/80 bg-sky-950/10"
                          : "border-[#00adfc] bg-[#f2faff]"
                        : isDark
                          ? "bg-[#242424] hover:bg-[#2e2e2e] border-zinc-800"
                          : "bg-white hover:bg-[#f8fbff] border-[#dce7f4]"
                        }`}
                      onClick={() => toggleStageDetails(s.id)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={expandedStageId === s.id}
                      onKeyDown={(e) => {
                        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          toggleStageDetails(s.id);
                        }
                      }}
                    >
                      <GripVertical
                        className={`h-4 w-4 shrink-0 cursor-grab transition-colors ${isDark ? "text-zinc-650 hover:text-zinc-450" : "text-slate-400 hover:text-slate-650"
                          }`}
                      />
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${isDark ? "bg-zinc-700 text-zinc-200" : "bg-[#e9f0f8] text-slate-700"}`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-xs font-medium ${isDark ? "text-zinc-200" : "text-slate-900"}`}>{s.title || "(Chưa đặt tên)"}</p>
                        {s.description && <p className={`mt-0.5 truncate text-[10px] ${isDark ? "text-zinc-400" : "text-slate-500"}`}>{s.description}</p>}
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleStageDetails(s.id)}
                          className={`rounded-md p-1 transition-colors ${expandedStageId === s.id ? "text-[#008dcc]" : isDark ? "text-zinc-400 hover:text-sky-400" : "text-slate-400 hover:text-[#008dcc]"}`}
                          aria-label={`${expandedStageId === s.id ? "Ẩn" : "Xem"} giai đoạn con của ${s.title}`}
                          aria-expanded={expandedStageId === s.id}
                          title={`${expandedStageId === s.id ? "Ẩn" : "Xem"} giai đoạn con`}
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandedStageId === s.id ? "rotate-180" : ""}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStep(s.id, -1)}
                          disabled={i === 0}
                          className="p-1 text-slate-350 hover:text-slate-600 disabled:opacity-20 cursor-pointer"
                          title="Chuyển lên"
                        >
                          <ChevronLeft className="h-3.5 w-3.5 rotate-90" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStep(s.id, 1)}
                          disabled={i === steps.length - 1}
                          className="p-1 text-slate-350 hover:text-slate-600 disabled:opacity-20 cursor-pointer"
                          title="Chuyển xuống"
                        >
                          <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(s.id);
                            setEditingStep(s);
                          }}
                          className={`p-1 rounded-md transition-colors cursor-pointer ${isDark
                            ? "text-zinc-450 hover:bg-zinc-800 hover:text-sky-400"
                            : "text-slate-400 hover:bg-slate-100 hover:text-[#008dcc]"
                            }`}
                          title="Sửa giai đoạn"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deleteStep(s.id);
                          }}
                          className={`p-1 rounded-md transition-colors cursor-pointer ${isDark
                            ? "text-zinc-450 hover:bg-zinc-800 hover:text-rose-455"
                            : "text-slate-400 hover:bg-slate-100 hover:text-rose-650"
                            }`}
                          title="Xóa giai đoạn"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {expandedStageId === s.id && (
                      <div className={`ml-5 space-y-2 border-l-2 pb-1 pl-4 ${isDark ? "border-sky-800" : "border-[#bceaff]"}`}>
                        <p className={`text-[11px] ${isDark ? "text-zinc-400" : "text-slate-500"}`}>Giai đoạn con ({s.subTasks?.length || 0})</p>
                        {(s.subTasks || []).map((child, childIndex) => (
                          <div key={child.id} className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${isDark ? "border-zinc-700 bg-zinc-800/70 text-zinc-200" : "border-[#dce7f4] bg-[#f8fbff] text-slate-700"}`}>
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00adfc]" />
                            <span className="break-words">{i + 1}.{childIndex + 1} {child.title}</span>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setEditingStep(s)}
                          className="flex items-center gap-1 text-xs text-[#008dcc] hover:text-[#0074aa]"
                        >
                          <Plus className="h-3.5 w-3.5" /> Thêm giai đoạn con
                        </button>
                      </div>
                    )}
                    </React.Fragment>
                  ))
                )}
              </div>
              <div className={`border-t p-4 ${isDark ? "border-zinc-800" : "border-[#e4edf7]"}`}>
                <p className={`mb-2 text-xs font-medium ${isDark ? "text-zinc-200" : "text-slate-800"}`}>Hướng dẫn</p>
                <div className={`space-y-1.5 rounded-xl px-3 py-2.5 text-[11px] ${isDark ? "bg-zinc-800/70 text-zinc-400" : "bg-[#f1f8ff] text-slate-600"}`}>
                  <p>• Kéo thả để sắp xếp thứ tự giai đoạn.</p>
                  <p>• Chọn giai đoạn trong danh sách hoặc dùng biểu tượng mắt cạnh “Thêm giai đoạn” để xem các nhánh con trên sơ đồ.</p>
                  <p>• Dùng biểu tượng bút để sửa thông tin.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer controls */}
        <div
          className={`flex items-center justify-between border-t px-5 py-3.5 sm:px-7 transition-colors ${isDark ? "bg-[#181818] border-zinc-800" : "bg-white border-[#e4edf7]"
            }`}
        >
          <div>
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-medium transition-colors ${isDark ? "border-zinc-700 bg-[#1f1f1f] text-zinc-300 hover:bg-zinc-800" : "border-[#dce7f4] bg-white text-slate-600 shadow-sm hover:bg-[#f3faff]"}`}
              >
                <ArrowLeft className="h-4 w-4" /> Quay lại
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {step === 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#00adfc] px-5 py-2.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#0097df]"
              >
                Tiếp tục <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={submitting}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#00adfc] px-6 py-2.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#0097df] disabled:opacity-50"
              >
                {submitting ? "Đang lưu..." : "Lưu quy trình"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pop-up modal to edit stage details */}
      {editingStep && (
        <WizardStepEditorModal
          step={editingStep}
          steps={steps}
          stepIndex={steps.findIndex((s) => s.id === editingStep.id)}
          isDark={isDark}
          onClose={() => setEditingStep(null)}
          onSave={(updatedStep) => {
            setSteps((prev) => prev.map((s) => (s.id === updatedStep.id ? updatedStep : s)));
            if (updatedStep.subTasks?.length) setExpandedStageId(updatedStep.id);
            setEditingStep(null);
          }}
        />
      )}
    </div>
  );
}

// ============ Modal chỉnh sửa thông tin giai đoạn trong Wizard ============
function WizardStepEditorModal({
  step,
  steps,
  stepIndex,
  isDark,
  onClose,
  onSave,
}: {
  step: WorkflowStep;
  steps: WorkflowStep[];
  stepIndex: number;
  isDark: boolean;
  onClose: () => void;
  onSave: (updatedStep: WorkflowStep) => void;
}) {
  const [title, setTitle] = useState(step.title);
  const [description, setDescription] = useState(step.description || "");
  const [subTasks, setSubTasks] = useState<WorkflowSubTask[]>(step.subTasks || []);
  const [newSubTask, setNewSubTask] = useState("");
  const [attachments, setAttachments] = useState<TaskAttachment[]>(step.attachments || []);

  const isFirstStep = stepIndex === 0;
  const nextStep = steps[stepIndex + 1] || null;

  const addSubTask = () => {
    if (!newSubTask.trim()) return;
    setSubTasks((prev) => [
      ...prev,
      { id: `st_${Date.now()}`, title: newSubTask.trim() },
    ]);
    setNewSubTask("");
  };

  const removeSubTask = (id: string) => {
    setSubTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSave = () => {
    const pendingChild = newSubTask.trim();
    onSave({
      ...step,
      title: title.trim() || step.title,
      description,
      subTasks: pendingChild ? [...subTasks, { id: genId("substep"), title: pendingChild }] : subTasks,
      attachments,
    });
  };

  const inp = `w-full rounded-xl border px-3 py-2.5 text-sm font-normal outline-none transition-colors focus:border-[#00adfc] focus:ring-2 focus:ring-[#00adfc]/10 ${isDark
    ? "bg-[#242424] border-zinc-700 text-zinc-200"
    : "bg-white border-[#dce7f4] text-slate-800"
    }`;

  const row = `space-y-1.5 py-2.5 border-b transition-colors ${isDark ? "border-zinc-800/60" : "border-[#e4edf7]"
    }`;

  const rowLabel = `block text-xs font-normal ${isDark ? "text-zinc-300" : "text-slate-700"
    }`;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[22px] border shadow-[0_24px_70px_rgba(24,46,85,0.25)] transition-colors ${isDark
          ? "bg-[#1c1c1c] text-zinc-100 border-zinc-800"
          : "bg-white text-slate-800 border-[#dce7f4]"
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4 transition-colors ${isDark ? "bg-[#1a1a1a] border-zinc-800/80" : "bg-white border-[#e4edf7]"
            }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className={`h-7 w-1 shrink-0 rounded-full ${isDark ? "bg-sky-500" : "bg-[#00adfc]"}`} aria-hidden="true" />
            <div className="min-w-0">
              <h3 className={`text-base font-medium ${isDark ? "text-zinc-100" : "text-slate-900"}`}>Chỉnh sửa giai đoạn</h3>
              <p className={`mt-0.5 truncate text-xs ${isDark ? "text-zinc-400" : "text-slate-500"}`}>Giai đoạn {stepIndex + 1}: {title || "Chưa đặt tên"}</p>
            </div>
            {isFirstStep && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700">Bắt đầu</span>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng chỉnh sửa giai đoạn"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-rose-500 text-white transition-colors hover:bg-rose-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 space-y-0.5 overflow-y-auto px-5 py-3">

          {/* Tên */}
          <div className={row}>
            <label className={rowLabel}>Tên giai đoạn *</label>
            <div className="flex flex-1 items-center gap-2">
              <input
                value={stepIndex + 1}
                disabled
                className={`w-10 self-stretch rounded-xl border text-center text-xs ${isDark ? "bg-zinc-800 border-zinc-700 text-zinc-400" : "bg-[#f3f7fc] border-[#dce7f4] text-slate-600"}`}
              />
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`${inp} min-w-0 flex-1`}
                placeholder="Tên giai đoạn..."
              />
            </div>
          </div>

          {/* Mô tả */}
          <div className={row}>
            <label className={rowLabel}>Mô tả</label>
            <div>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả giai đoạn..."
                className={inp}
              />
            </div>
          </div>

          {/* Công việc con */}
          <div className={`border-b py-3 transition-colors ${isDark ? "border-zinc-800/60" : "border-[#e4edf7]"
            }`}>
            <div className="mb-2 flex items-center justify-between">
              <span className={`text-xs ${isDark ? "text-zinc-300" : "text-slate-700"
                }`}>
                Giai đoạn con ({subTasks.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {subTasks.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-normal transition-colors ${isDark ? "bg-zinc-800/60 border-zinc-700 text-zinc-200" : "bg-[#f8fbff] border-[#dce7f4] text-slate-700"
                    }`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#00adfc]" />
                  <span className="flex-1">{t.title}</span>
                  <button type="button" onClick={() => removeSubTask(t.id)} className={`hover:text-red-400 ${isDark ? "text-zinc-500" : "text-slate-400"
                    }`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className={`mt-1 flex items-center gap-2 rounded-xl border px-3 py-2 ${isDark ? "border-zinc-700 bg-zinc-800/40" : "border-[#dce7f4] bg-white"}`}>
                <input
                  value={newSubTask}
                  onChange={(e) => setNewSubTask(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubTask(); } }}
                  placeholder="Nhập tên giai đoạn con..."
                  className={`min-w-0 flex-1 bg-transparent text-xs font-normal outline-none transition-colors ${isDark ? "text-zinc-300 placeholder-zinc-500" : "text-slate-700 placeholder-slate-400"
                    }`}
                />
                <button
                  onClick={addSubTask}
                  type="button"
                  disabled={!newSubTask.trim()}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[#008dcc] hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Thêm giai đoạn con"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm
                </button>
              </div>
            </div>
          </div>

          {/* File đính kèm */}
          <div className={`border-b py-3 transition-colors ${isDark ? "border-zinc-800/60" : "border-[#e4edf7]"}`}>
            <span className={`mb-2 block text-xs ${isDark ? "text-zinc-300" : "text-slate-700"}`}>
              Tệp, ảnh, video, ghi âm và liên kết
            </span>
            <div className="[&_a]:font-normal [&_button]:font-normal">
              <AttachmentEditor attachments={attachments} onChange={setAttachments} />
            </div>
          </div>

          {/* Giai đoạn tiếp theo */}
          {nextStep && (
            <div className="py-2.5">
              <span className={`mb-2 block text-xs ${isDark ? "text-zinc-300" : "text-slate-700"
                }`}>
                Giai đoạn tiếp theo
              </span>
              <div
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${isDark ? "border-zinc-700 bg-zinc-800/30" : "border-[#dce7f4] bg-[#f8fbff]"
                  }`}
              >
                <ArrowRight className={`h-4 w-4 shrink-0 ${isDark ? "text-sky-400" : "text-[#00adfc]"
                  }`} />
                <div
                  className={`flex items-center gap-2 text-xs font-normal ${isDark ? "text-zinc-200" : "text-slate-700"
                    }`}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${isDark ? "bg-zinc-700 text-zinc-300" : "bg-[#e9f0f8] text-slate-600"
                    }`}>
                    {steps.indexOf(nextStep) + 1}
                  </span>
                  {nextStep.title}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`flex shrink-0 justify-end gap-2.5 border-t px-5 py-3.5 transition-colors ${isDark ? "bg-[#1a1a1a] border-zinc-800/80" : "bg-white border-[#e4edf7]"
            }`}
        >
          <button
            type="button"
            onClick={handleSave}
            className="cursor-pointer rounded-xl bg-[#00adfc] px-5 py-2.5 text-xs font-normal text-white shadow-sm transition-colors hover:bg-[#0097df]"
          >
            Ghi nhận
          </button>
        </div>
      </div>
    </div>
  );
}


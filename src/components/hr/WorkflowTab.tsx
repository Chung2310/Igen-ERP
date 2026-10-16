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
  Check,
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
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-[#dce7f4] bg-[#f8fbff] p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-normal text-[#008dcc]">Hướng dẫn quy trình</p>
                  <h1 className="mt-2 text-xl font-medium text-slate-800">{workflow.name}</h1>
                  {workflow.category && <p className="mt-1 text-xs font-normal text-slate-500">{workflow.category}</p>}
                </div>
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              {workflow.description && <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-600">{workflow.description}</p>}
            </div>

            {workflow.steps.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-[#dce7f4] bg-[#f8fbff] p-8 text-center text-sm font-normal text-slate-500">
                Chưa có bước nào trong quy trình.
              </div>
            ) : (
              <ol className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {workflow.steps.map((step, index) => (
                  <li
                    key={step.id}
                    onClick={() => setSelectedStep(step)}
                    className="relative h-full cursor-pointer rounded-2xl border border-[#dce7f4] bg-white p-5 shadow-sm transition-all hover:border-[#70d5ff] hover:shadow-md"
                  >
                    {index < workflow.steps.length - 1 && <ArrowRight className="pointer-events-none absolute -bottom-3 left-1/2 z-10 h-5 w-5 -translate-x-1/2 rotate-90 rounded-full bg-white text-[#00adfc] sm:-right-3 sm:bottom-auto sm:left-auto sm:top-1/2 sm:translate-x-0 sm:-translate-y-1/2 sm:rotate-0" aria-hidden="true" />}
                    <div className="flex items-start gap-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00adfc] text-sm font-medium text-white">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <h2 className="break-words text-base font-medium leading-snug text-slate-800">{step.title || `Bước ${index + 1}`}</h2>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
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
        {!!step.subTasks?.length && <div className="mt-5"><h3 className="text-xs font-medium tracking-wide text-slate-500">Công việc cần làm</h3><ul className="mt-2 space-y-2">{step.subTasks.map((task) => <li key={task.id} className="flex items-center gap-2 text-sm text-slate-700"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{task.title}</li>)}</ul></div>}
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
  const [dragId, setDragId] = useState<string | null>(null);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl shadow-2xl transition-all duration-300 ${step === 2 ? "max-w-6xl" : "max-w-4xl"
          } ${isDark
            ? "bg-[#121212] border border-zinc-800 text-zinc-100"
            : "bg-white border border-gray-200 text-slate-850"
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + Title */}
        <div
          className={`flex items-center justify-between border-b px-6 py-4.5 transition-colors ${isDark ? "bg-[#181818] border-zinc-800" : "bg-white border-gray-250"
            }`}
        >
          <div className="flex items-center gap-2">
            <WorkflowIcon className="h-5 w-5 text-[#00adfc]" />
            <h3 className={`text-base font-medium ${isDark ? "text-zinc-150" : "text-slate-800"}`}>
              {isEditing ? "Sửa quy trình" : "Tạo quy trình mới"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-full bg-rose-500 p-2 text-white transition-colors hover:bg-rose-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step Indicator row (only on step 1) */}
        {!isDark && (
          <div className="flex items-center gap-2 border-b border-gray-150 bg-slate-50/60 px-6 py-3">
            {[
              { n: 1, label: "Thông tin quy trình" },
              { n: 2, label: "Thiết lập giai đoạn" },
            ].map((s, i) => (
              <React.Fragment key={s.n}>
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium ${step >= (s.n as 1 | 2) ? "bg-[#00adfc] text-white" : "bg-gray-200 text-slate-500"
                      }`}
                  >
                    {s.n}
                  </span>
                  <span className={`text-xs font-medium ${step === s.n ? "text-[#008dcc]" : "text-slate-400"}`}>
                    {s.label}
                  </span>
                </div>
                {i === 0 && <div className="h-px w-8 bg-gray-300" />}
              </React.Fragment>
            ))}
          </div>
        )}


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
              className={`flex-1 p-8 overflow-hidden items-center justify-center min-h-[450px] relative border-r transition-colors touch-none ${
                isPanning ? "cursor-grabbing" : "cursor-grab"
              } ${isDark ? "bg-[#141414] border-zinc-800/80" : "bg-slate-50/50 border-gray-200"} ${
                activeTab === "diagram" ? "flex" : "hidden md:flex"
              }`}
            >
              {/* Decorative top-left selection tool */}
              <button
                type="button"
                draggable
                onClick={addStage}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", "new-step");
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className={`absolute top-4 left-4 p-2.5 border rounded-xl transition-all shadow-sm cursor-grab active:cursor-grabbing z-20 ${isDark
                  ? "bg-[#1f1f1f] border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  : "bg-white border-gray-200 text-slate-400 hover:text-slate-600"
                  }`}
                title="Bấm hoặc Kéo thả vào vùng làm việc để tạo giai đoạn mới"
              >
                <div className={`w-4 h-4 border rounded ${isDark ? "border-zinc-500" : "border-gray-300"}`} />
              </button>

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
                  className="flex flex-col gap-y-16 p-20 select-none w-max min-w-max"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: "center center",
                    transition: isPanning ? "none" : "transform 0.15s ease-out",
                  }}
                >
                  {(() => {
                    const rows: { step: WorkflowStep; index: number }[][] = [];
                    for (let i = 0; i < steps.length; i += 5) {
                      rows.push(
                        steps.slice(i, i + 5).map((step, idx) => ({
                          step,
                          index: i + idx,
                        }))
                      );
                    }

                    return rows.map((row, rowIndex) => (
                      <div key={rowIndex} className="flex items-center gap-x-12 relative w-max min-w-max">
                        {row.map(({ step: s, index: idx }, cellIndex) => {
                          const isSelected = selectedId === s.id;
                          const hasNextInRow = cellIndex < row.length - 1;

                          return (
                            <React.Fragment key={s.id}>
                              {/* Node Card */}
                              <div
                                onClick={() => setSelectedId(s.id)}
                                className={`canvas-node w-48 rounded-2xl border p-4.5 transition-all duration-300 cursor-pointer shadow-md relative shrink-0 ${
                                  isSelected
                                    ? isDark
                                      ? "border-sky-500 bg-sky-950/20 ring-4 ring-sky-500/10 scale-102"
                                      : "border-sky-500 bg-sky-50/70 ring-4 ring-sky-500/10 scale-102 shadow-lg"
                                    : isDark
                                      ? "border-zinc-750 bg-zinc-900/60 hover:bg-zinc-800/80 hover:border-zinc-500"
                                      : "border-gray-200 bg-white hover:bg-slate-50/50 hover:border-gray-300"
                                }`}
                              >
                                {/* Step Number Badge */}
                                <span
                                  className={`absolute -top-3 left-4 text-[9px] font-medium px-2 py-0.5 rounded-lg border shadow-3xs transition-colors ${
                                    isDark
                                      ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                                      : "bg-white text-slate-550 border-gray-200"
                                  }`}
                                >
                                  Giai đoạn {idx + 1}
                                </span>

                                <h4
                                  className={`text-xs font-medium tracking-wide leading-tight line-clamp-2 transition-colors mt-1 ${
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
                                  <p className="text-[10px] text-slate-400 line-clamp-2 mt-1.5 leading-relaxed font-medium">
                                    {s.description}
                                  </p>
                                )}

                                {idx === 0 && (
                                  <div className="absolute -left-3 -top-3 bg-emerald-600 text-white font-medium text-[7px] tracking-wider px-2 py-0.5 rounded-lg shadow-sm">
                                    Khởi đầu
                                  </div>
                                )}
                              </div>

                              {/* Connector Line */}
                              {hasNextInRow && (
                                <div className="flex items-center justify-center shrink-0">
                                  <ArrowRight className={`h-5 w-5 animate-pulse ${isDark ? "text-sky-400" : "text-sky-600"}`} />
                                </div>
                              )}
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
                <div className="absolute bottom-4 right-4 flex items-center gap-1.5 z-20">
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
                    Mặc định
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
              className={`w-full md:w-80 flex flex-col border-l transition-colors duration-300 ${
                isDark ? "bg-[#1a1a1a] border-zinc-800" : "bg-white border-gray-200"
              } ${activeTab === "list" ? "flex" : "hidden md:flex"}`}
            >
              <div
                className={`px-4 py-3 border-b flex flex-wrap items-center justify-end gap-2 shadow-2xs transition-colors duration-300 ${isDark ? "bg-[#1d1d1d] border-zinc-800/85" : "bg-slate-50 border-gray-200"
                  }`}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addStage}
                    className="p-1.5 bg-[#00adfc] hover:bg-[#0097df] text-white rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
                    title="Thêm giai đoạn"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <div
                    className={`flex gap-0.5 border rounded-lg p-0.5 transition-colors ${isDark ? "border-zinc-800 bg-[#141414]" : "border-gray-200 bg-gray-50"
                      }`}
                  >
                    <button
                      className={`p-1 transition-colors ${isDark ? "text-zinc-650 hover:text-zinc-400" : "text-slate-400 hover:text-slate-655"
                        }`}
                      title="Sắp xếp"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 rotate-90" />
                    </button>
                    <button
                      className={`p-1 transition-colors ${isDark ? "text-zinc-650 hover:text-zinc-400" : "text-slate-400 hover:text-slate-655"
                        }`}
                      title="Bố cục"
                    >
                      <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sidebar scrollable list */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
                {steps.length === 0 ? (
                  <p className="text-center text-xs text-zinc-650 py-8 font-medium">Danh sách trống</p>
                ) : (
                  steps.map((s, i) => (
                    <div
                      key={s.id}
                      draggable
                      onDragStart={() => setDragId(s.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => reorder(s.id)}
                      className={`flex items-center gap-3 border p-2.5 rounded-xl transition-all cursor-pointer shadow-3xs ${selectedId === s.id
                        ? isDark
                          ? "border-sky-500/80 bg-sky-950/10"
                          : "border-sky-500/80 bg-sky-50/50"
                        : isDark
                          ? "bg-[#242424] hover:bg-[#2e2e2e] border-zinc-800"
                          : "bg-white hover:bg-slate-50/80 border-gray-200"
                        }`}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <GripVertical
                        className={`h-4 w-4 shrink-0 cursor-grab transition-colors ${isDark ? "text-zinc-650 hover:text-zinc-450" : "text-slate-400 hover:text-slate-650"
                          }`}
                      />
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
                        <span className="bg-emerald-955 text-emerald-400 border border-emerald-900/40 text-[9px] px-1.5 py-0.5 rounded-md font-medium shadow-3xs">
                          Bắt đầu
                        </span>
                      )}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer controls */}
        <div
          className={`flex items-center justify-between border-t px-6 py-4.5 transition-colors ${isDark ? "bg-[#181818] border-zinc-800" : "bg-white border-gray-250"
            }`}
        >
          <div>
            {isDark && (
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#1f1f1f] text-zinc-400 px-4.5 py-2 text-xs font-medium hover:bg-zinc-800 hover:text-zinc-200 transition-all cursor-pointer shadow-3xs"
              >
                <ArrowLeft className="h-4 w-4" /> Quay lại
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {step === 1 ? (
              <>
                <button
                  onClick={goNext}
                  className="flex items-center gap-1.5 rounded-xl bg-[#00adfc] px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#0097df]"
                >
                  Tiếp tục <ChevronRight className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleFinish}
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-xl bg-[#00adfc] px-6 py-2 text-xs font-medium text-white transition-colors hover:bg-[#0097df] disabled:opacity-50"
                >
                  {submitting ? "Đang lưu..." : "Lưu"}
                </button>
              </>
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
    onSave({
      ...step,
      title: title.trim() || step.title,
      description,
      subTasks,
      attachments,
    });
  };

  const inp = `w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 font-medium transition-all ${isDark
    ? "bg-[#242424] border border-zinc-750 text-zinc-200"
    : "bg-white border border-gray-200 text-slate-800"
    }`;

  const row = `flex items-start gap-3 py-2.5 border-b transition-colors ${isDark ? "border-zinc-800/60" : "border-gray-100"
    }`;

  const rowLabel = `w-28 shrink-0 text-[11px] font-medium pt-0.5 ${isDark ? "text-zinc-500" : "text-slate-450"
    }`;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors ${isDark
          ? "bg-[#1c1c1c] text-zinc-150 border-zinc-800"
          : "bg-white text-slate-850 border-gray-200"
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0 transition-colors ${isDark ? "bg-[#1a1a1a] border-zinc-800/80" : "bg-slate-50 border-gray-200"
            }`}
        >
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
              Giai đoạn
            </span>
            <span className="text-sm font-medium text-[#008dcc]">{title || "(Chưa đặt tên)"}</span>
            {isFirstStep && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-medium">
                Bắt đầu
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-full bg-rose-500 p-2 text-white transition-colors hover:bg-rose-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 pt-3 pb-2 space-y-0.5">

          {/* Tên */}
          <div className={row}>
            <span className={rowLabel}>Tên *</span>
            <div className="flex flex-1 items-center gap-2">
              <input
                value={stepIndex + 1}
                disabled
                className={`w-10 text-center rounded-xl text-xs font-medium border transition-all ${isDark ? "bg-zinc-800 border-zinc-700 text-zinc-400" : "bg-gray-100 border-gray-200 text-slate-500"
                  } py-1.5`}
              />
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`${inp} flex-1`}
                placeholder="Tên giai đoạn..."
              />
            </div>
          </div>

          {/* Mô tả */}
          <div className={row}>
            <span className={rowLabel}>Mô tả</span>
            <div className="flex-1 relative">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả giai đoạn..."
                className={`${inp} pr-8`}
              />
              <Pencil className={`absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${isDark ? "text-zinc-600" : "text-slate-350"
                }`} />
            </div>
          </div>

          {/* Công việc con */}
          <div className={`py-2.5 border-b transition-colors ${isDark ? "border-zinc-800/60" : "border-gray-100"
            }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[11px] font-medium tracking-wide ${isDark ? "text-cyan-400" : "text-cyan-600"
                }`}>
                Công việc con ({subTasks.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {subTasks.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${isDark ? "bg-zinc-800/60 border-zinc-700 text-zinc-200" : "bg-slate-50 border-gray-100 text-slate-700"
                    }`}
                >
                  <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                  <span className="flex-1 tracking-wide">{t.title}</span>
                  <button onClick={() => removeSubTask(t.id)} className={`hover:text-red-400 ${isDark ? "text-zinc-600" : "text-slate-350"
                    }`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-1">
                <input
                  value={newSubTask}
                  onChange={(e) => setNewSubTask(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addSubTask(); }}
                  placeholder="Thêm công việc con..."
                  className={`flex-1 text-xs font-medium outline-none bg-transparent transition-colors ${isDark ? "text-zinc-300 placeholder-zinc-700" : "text-slate-700 placeholder-slate-350"
                    }`}
                />
                {newSubTask && (
                  <button
                    onClick={addSubTask}
                    className="rounded-lg p-1 text-sky-500 hover:text-sky-400 hover:bg-sky-500/10"
                    title="Thêm công việc con"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* File đính kèm */}
          <div className={`py-3 border-b transition-colors ${isDark ? "border-zinc-800/60" : "border-gray-100"}`}>
            <span className={`text-[11px] font-medium tracking-wide mb-2 block ${isDark ? "text-cyan-400" : "text-cyan-600"}`}>
              Tệp, ảnh, video, ghi âm và liên kết
            </span>
            <AttachmentEditor attachments={attachments} onChange={setAttachments} />
          </div>

          {/* Giai đoạn tiếp theo */}
          {nextStep && (
            <div className={`py-2.5`}>
              <span className={`text-[11px] font-medium tracking-wide mb-2 block ${isDark ? "text-cyan-400" : "text-cyan-600"
                }`}>
                Giai đoạn tiếp theo
              </span>
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-dashed transition-colors ${isDark ? "border-zinc-700 bg-zinc-800/30" : "border-gray-200 bg-slate-50/50"
                  }`}
              >
                <ArrowRight className={`h-4 w-4 shrink-0 ${isDark ? "text-zinc-600" : "text-slate-300"
                  }`} />
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium tracking-wide ${isDark ? "bg-zinc-800 border-zinc-700 text-zinc-200" : "bg-white border-gray-200 text-slate-700"
                    }`}
                >
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border mr-1 ${isDark ? "bg-zinc-700 border-zinc-600 text-zinc-400" : "bg-gray-100 border-gray-200 text-slate-500"
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
          className={`flex justify-end gap-2.5 px-5 py-3.5 border-t flex-shrink-0 transition-colors ${isDark ? "bg-[#1a1a1a] border-zinc-800/80" : "bg-slate-50 border-gray-200"
            }`}
        >
          <button
            onClick={handleSave}
            className="cursor-pointer rounded-xl bg-[#00adfc] px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#0097df]"
          >
            Ghi nhận
          </button>
        </div>
      </div>
    </div>
  );
}


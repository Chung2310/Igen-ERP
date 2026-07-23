import React, { useState, useEffect, useCallback, useMemo } from "react";
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
}

const ACCENT = "#4f46e5";

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
      const res = await fetch("/api/v1/crud/workflows", {
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
  }, [selectedCompanyCode]);

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
    [wfName, wfCategory, wfDescription, steps, activeId, userProfile]
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
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden" id="workflow_tab">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-800">Quy trình</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              {workflows.length}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={fetchWorkflows}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-slate-500"
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
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-40"
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

        <div className="flex-1 overflow-y-auto p-4">
          {workflows.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <WorkflowIcon className="h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-400">
                Chưa có quy trình nào
              </p>
              <p className="text-xs text-slate-400">
                Nhấn “Quy trình mới” để tạo quy trình gồm các bước thực hiện.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {workflows.map((wf) => {
                const total = wf.steps?.length || 0;
                return (
                  <button
                    key={wf.id}
                    onClick={() => openDetail(wf)}
                    className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <WorkflowIcon className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {wf.category && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                            {wf.category}
                          </span>
                        )}
                        {canEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setWizardData(wf);
                              setWizardOpen(true);
                            }}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-650 transition-colors"
                            title="Sửa quy trình"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <h3 className="mt-3 line-clamp-2 text-sm font-bold text-slate-800 group-hover:text-indigo-700">
                      {wf.name}
                    </h3>
                    {wf.description && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                        {wf.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-3 text-[11px] font-semibold text-slate-500">
                      <span className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" /> {total} bước
                      </span>
                    </div>
                  </button>
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
      {/* Thanh tiêu đề */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-3 py-2">
        <button
          onClick={backToList}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-650 hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4" /> Danh sách
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={openNewStep}
            disabled={!canEdit}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
            style={{ background: ACCENT }}
          >
            <Plus className="h-3.5 w-3.5" /> Thêm bước
          </button>
          <button
            onClick={handleSave}
            disabled={!canEdit || saving}
            className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? "Đang lưu..." : "Lưu"}
          </button>
          <button
            onClick={handleDeleteWorkflow}
            disabled={!canEdit}
            className="flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-bold text-red-650 hover:bg-red-50 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Thanh thống kê nhỏ */}
      <div className="flex items-center gap-4 border-b border-gray-100 bg-slate-50/60 px-4 py-1.5 text-[11px] font-semibold text-slate-500">
        <span className="flex items-center gap-1">
          <Layers className="h-3.5 w-3.5" /> {steps.length} bước
        </span>
      </div>

      {/* Bảng sơ đồ Snake Layout + Danh sách giai đoạn (giống giao diện Thiết lập giai đoạn) */}
      {steps.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
          <Layers className="h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-400">
            Chưa có bước nào trong quy trình
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Nhấn “Thêm bước” để tạo bước đầu tiên.
          </p>
          {canEdit && (
            <button
              onClick={openNewStep}
              className="mt-4 flex items-center gap-1.5 rounded-xl bg-indigo-650 hover:bg-indigo-750 text-white px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Thêm bước mới
            </button>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 border-t border-gray-150">
          {/* Flowchart workspace (Left Column) - Snake Layout */}
          <div
            className={`flex-1 p-8 overflow-y-auto flex items-center justify-center min-h-[450px] relative border-r transition-colors ${
              isDark ? "bg-[#141414] border-zinc-800/80" : "bg-slate-50/50 border-gray-200"
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
                      className={`w-32 h-20 relative rounded-xl border flex flex-col justify-center items-center p-2.5 transition-all duration-300 cursor-pointer shadow-xs ${
                        isDark
                          ? "border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/85 hover:border-indigo-500"
                          : "border-gray-200 bg-white hover:bg-indigo-50/50 hover:border-indigo-400 hover:shadow-md"
                      }`}
                      title="Bấm để xem chi tiết / chỉnh sửa giai đoạn"
                    >
                      <span
                        className={`absolute -top-3 left-3 text-[9px] font-bold px-1.5 py-0.5 rounded border shadow-3xs transition-colors ${
                          isDark
                            ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                            : "bg-white text-slate-550 border-gray-200"
                        }`}
                      >
                        {idx + 1}
                      </span>

                      <span
                        className={`text-[10px] font-extrabold uppercase text-center tracking-wide leading-tight px-1 line-clamp-3 transition-colors ${
                          isDark ? "text-zinc-100" : "text-slate-800"
                        }`}
                      >
                        {s.title || "(CHƯA ĐẶT TÊN)"}
                      </span>

                      {idx === 0 && (
                        <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 bg-emerald-600/90 text-white font-extrabold text-[7px] uppercase tracking-wider px-1.5 py-0.5 rounded-t-md shadow-3xs">
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
            className={`w-80 flex flex-col border-l transition-colors duration-300 ${
              isDark ? "bg-[#1a1a1a] border-zinc-800" : "bg-white border-gray-200"
            }`}
          >
            <div
              className={`px-4 py-3 border-b flex items-center justify-between shadow-2xs transition-colors duration-300 ${
                isDark ? "bg-[#1d1d1d] border-zinc-800/85" : "bg-slate-50 border-gray-200"
              }`}
            >
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Danh sách giai đoạn
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={openNewStep}
                  className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1 text-[11px] font-bold px-2.5"
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
                  className={`flex items-center gap-3 border p-2.5 rounded-xl transition-all cursor-pointer shadow-3xs ${
                    isDark
                      ? "bg-[#242424] hover:bg-[#2e2e2e] border-zinc-800"
                      : "bg-white hover:bg-slate-50/80 border-gray-200 hover:border-indigo-300"
                  }`}
                >
                  <span
                    className={`font-extrabold text-xs px-2 py-0.5 rounded-lg shadow-3xs border transition-colors ${
                      isDark
                        ? "bg-zinc-800 text-zinc-350 border-zinc-700"
                        : "bg-gray-100 text-slate-500 border-gray-200"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`text-xs font-bold truncate flex-1 transition-colors ${
                      isDark ? "text-zinc-200" : "text-slate-750"
                    }`}
                  >
                    {s.title || "(Chưa đặt tên)"}
                  </span>
                  {i === 0 && (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] px-1.5 py-0.5 rounded-md font-extrabold shadow-3xs">
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
                        className={`p-1 rounded-md transition-colors cursor-pointer ${
                          isDark
                            ? "text-zinc-450 hover:bg-zinc-800 hover:text-indigo-400"
                            : "text-slate-400 hover:bg-slate-100 hover:text-indigo-650"
                        }`}
                        title="Sửa giai đoạn"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteStep(s.id)}
                        className={`p-1 rounded-md transition-colors cursor-pointer ${
                          isDark
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
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-50" id="workflow_tab">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <button onClick={onBack} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-650 hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4" /> Danh sách quy trình
        </button>
        <div className="ml-auto flex items-center gap-2">
          {canEdit && (
            <>
              <button onClick={onAddStep} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500">
                <Plus className="h-3.5 w-3.5" /> Thêm bước
              </button>
              <button onClick={onSave} disabled={saving} className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50">
                <Save className="h-3.5 w-3.5" /> {saving ? "Đang lưu..." : "Lưu"}
              </button>
              <button onClick={onDelete} className="flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-bold text-red-650 hover:bg-red-50" title="Xóa quy trình">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-500">Hướng dẫn quy trình</p>
                <h1 className="mt-2 text-2xl font-extrabold text-slate-900">{workflow.name}</h1>
                {workflow.category && <p className="mt-1 text-xs font-semibold text-slate-400">{workflow.category}</p>}
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            {workflow.description && <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-600">{workflow.description}</p>}
          </div>

          {workflow.steps.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-slate-400">
              Chưa có bước nào trong quy trình.
            </div>
          ) : (
            <ol className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workflow.steps.map((step, index) => (
                <li key={step.id} onClick={() => setSelectedStep(step)} className="relative h-full cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md sm:p-6">
                  {index < workflow.steps.length - 1 && <ArrowRight className="pointer-events-none absolute -bottom-3 left-1/2 z-10 h-5 w-5 -translate-x-1/2 rotate-90 rounded-full bg-white text-indigo-500 sm:-right-3 sm:bottom-auto sm:left-auto sm:top-1/2 sm:translate-x-0 sm:-translate-y-1/2 sm:rotate-0" aria-hidden="true" />}
                  <div className="flex items-start gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-extrabold text-white">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h2 className="text-base font-extrabold text-slate-800">{step.title || `Bước ${index + 1}`}</h2>
                      </div>
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
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="workflow-step-detail-title" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-500">Bước {stepIndex + 1}</p>
            <h2 id="workflow-step-detail-title" className="mt-1 text-xl font-extrabold text-slate-900">{step.title || `Bước ${stepIndex + 1}`}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100" aria-label="Đóng">×</button>
        </div>
        {step.description && <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">{step.description}</p>}
        {step.note && <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800"><strong>Lưu ý:</strong> {step.note}</div>}
        {step.deliverable && <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800"><strong>Kết quả cần đạt:</strong> {step.deliverable}</div>}
        {!!step.subTasks?.length && <div className="mt-5"><h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Công việc cần làm</h3><ul className="mt-2 space-y-2">{step.subTasks.map((task) => <li key={task.id} className="flex items-center gap-2 text-sm text-slate-700"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{task.title}</li>)}</ul></div>}
        {!!step.attachments?.length && <div className="mt-5"><h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Tệp đính kèm</h3><div className="mt-2 flex flex-wrap gap-2">{step.attachments.map((attachment) => <button key={attachment.id} type="button" onClick={() => onPreview(attachment)} className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"><ExternalLink className="h-3.5 w-3.5" />Xem preview: {attachment.name}</button>)}</div></div>}
        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Đóng</button>
        </div>
      </div>
    </div>
  );
}

function WorkflowAttachmentPreview({ attachment, onClose }: { attachment: TaskAttachment; onClose: () => void }) {
  const isImage = attachment.type === "image" || attachment.type.startsWith("image/");
  const isVideo = attachment.type === "video" || attachment.type.startsWith("video/");
  const isAudio = attachment.type === "audio" || attachment.type.startsWith("audio/");
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="presentation" onClick={onClose}>
    <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="Preview tệp" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between gap-3"><h2 className="truncate text-base font-bold text-slate-800">{attachment.name}</h2><button type="button" onClick={onClose} aria-label="Đóng preview" className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100">×</button></div>
      <div className="mt-4 flex min-h-48 items-center justify-center rounded-xl bg-slate-100 p-4">
        {isImage && <img src={attachment.url} alt={attachment.name} className="max-h-[65vh] max-w-full object-contain" />}
        {isVideo && <video src={attachment.url} controls className="max-h-[65vh] max-w-full" />}
        {isAudio && <audio src={attachment.url} controls />}
        {!isImage && !isVideo && !isAudio && <div className="text-center text-sm text-slate-600"><p>Không thể xem trực tiếp loại tệp này.</p><a href={attachment.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg bg-indigo-600 px-3 py-2 font-bold text-white">Mở tệp</a></div>}
      </div>
      <div className="mt-4 flex justify-end"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Đóng</button></div>
    </div>
  </div>;
}
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
            <WorkflowIcon className={`h-5 w-5 ${isDark ? "text-indigo-400" : "text-indigo-650"}`} />
            <h3 className={`text-sm font-extrabold uppercase tracking-wide ${isDark ? "text-zinc-150" : "text-slate-800"}`}>
              {isEditing ? "Sửa quy trình" : "Tạo quy trình mới"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${isDark ? "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200" : "hover:bg-gray-100 text-slate-405"
              }`}
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
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${step >= (s.n as 1 | 2) ? "bg-indigo-650 text-white" : "bg-gray-200 text-slate-500"
                      }`}
                  >
                    {s.n}
                  </span>
                  <span className={`text-xs font-bold ${step === s.n ? "text-indigo-700" : "text-slate-400"}`}>
                    {s.label}
                  </span>
                </div>
                {i === 0 && <div className="h-px w-8 bg-gray-300" />}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* ---- BƯỚC 1: Thông tin ---- */}
        {step === 1 && (
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                <FileText className="h-4 w-4" /> Tên quy trình
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Hướng dẫn nhân viên mới"
                className="mt-1.5 w-full rounded-2xl border border-gray-250 px-4 py-2.5 text-xs font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-2xs"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                <Layers className="h-4 w-4" /> Nhóm / phân loại
              </label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="VD: Nhân sự, Vận hành…"
                className="mt-1.5 w-full rounded-2xl border border-gray-250 px-4 py-2.5 text-xs font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-2xs"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                <Info className="h-4 w-4" /> Ghi chú / mô tả quy trình
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Mục tiêu, phạm vi áp dụng, lưu ý chung của quy trình…"
                className="mt-1.5 w-full resize-none rounded-2xl border border-gray-250 px-4 py-2.5 text-xs font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-2xs"
              />
            </div>
          </div>
        )}

        {/* ---- BƯỚC 2: Thiết lập giai đoạn theo snake layout ---- */}
        {step === 2 && (
          <div className="flex min-h-0 flex-1">
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
              className={`flex-1 p-8 overflow-y-auto flex items-center justify-center min-h-[450px] relative border-r transition-colors ${isDark ? "bg-[#141414] border-zinc-800/80" : "bg-slate-50/50 border-gray-200"
                }`}
            >
              {/* Decorative top-left selection tool */}
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", "new-step");
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className={`absolute top-4 left-4 p-2.5 border rounded-xl transition-all shadow-sm cursor-grab active:cursor-grabbing ${isDark
                    ? "bg-[#1f1f1f] border-zinc-800 text-zinc-500 hover:text-zinc-300"
                    : "bg-white border-gray-200 text-slate-400 hover:text-slate-600"
                  }`}
                title="Kéo thả vào vùng làm việc để tạo giai đoạn mới"
              >
                <div className={`w-4 h-4 border rounded ${isDark ? "border-zinc-500" : "border-gray-300"}`} />
              </button>

              {steps.length === 0 ? (
                <div className={`text-center transition-colors ${isDark ? "text-zinc-550" : "text-slate-400"}`}>
                  <WorkflowIcon className={`h-10 w-10 mx-auto mb-3 ${isDark ? "text-zinc-700" : "text-slate-300"}`} />
                  <p className="text-xs font-bold">Chưa có giai đoạn nào</p>
                  <p className={`text-[10px] mt-1 ${isDark ? "text-zinc-650" : "text-slate-400"}`}>
                    Hãy thêm giai đoạn ở danh sách bên phải.
                  </p>
                </div>
              ) : (
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
                      const isSelected = selectedId === s.id;
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
                          onClick={() => setSelectedId(s.id)}
                          className={`w-32 h-20 relative rounded-xl border flex flex-col justify-center items-center p-2.5 transition-all duration-300 cursor-pointer ${isSelected
                              ? isDark
                                ? "border-indigo-500 bg-indigo-950/20 shadow-md shadow-indigo-500/10 scale-102"
                                : "border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-500/10 scale-102"
                              : isDark
                                ? "border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/85 hover:border-zinc-500"
                                : "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300"
                            }`}
                        >
                          <span
                            className={`absolute -top-3 left-3 text-[9px] font-bold px-1.5 py-0.5 rounded border shadow-sm transition-colors ${isDark
                                ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                                : "bg-white text-slate-550 border-gray-200"
                              }`}
                          >
                            {idx + 1}
                          </span>

                          <span
                            className={`text-[10px] font-extrabold uppercase text-center tracking-wide leading-tight px-1 line-clamp-3 transition-colors ${isSelected
                                ? isDark
                                  ? "text-indigo-400"
                                  : "text-indigo-700"
                                : isDark
                                  ? "text-zinc-100"
                                  : "text-slate-700"
                              }`}
                          >
                            {s.title || "(CHƯA ĐẶT TÊN)"}
                          </span>

                          {idx === 0 && (
                            <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 bg-emerald-600/90 text-white font-extrabold text-[7px] uppercase tracking-wider px-1.5 py-0.5 rounded-t-md shadow-sm">
                              Bắt đầu
                            </div>
                          )}

                          {arrow}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* Sidebar list layout (Right Column) */}
            <div
              className={`w-80 flex flex-col border-l transition-colors duration-300 ${isDark ? "bg-[#1a1a1a] border-zinc-800" : "bg-white border-gray-200"
                }`}
            >
              <div
                className={`px-4 py-3 border-b flex flex-wrap items-center justify-end gap-2 shadow-2xs transition-colors duration-300 ${
                  isDark ? "bg-[#1d1d1d] border-zinc-800/85" : "bg-slate-50 border-gray-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addStage}
                    className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
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
                  <p className="text-center text-xs text-zinc-650 py-8 font-bold">Danh sách trống</p>
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
                            ? "border-indigo-500/80 bg-indigo-950/10"
                            : "border-indigo-500/80 bg-indigo-50/50"
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
                        className={`font-extrabold text-xs px-2 py-0.5 rounded-lg shadow-3xs border transition-colors ${isDark
                            ? "bg-zinc-800 text-zinc-350 border-zinc-700"
                            : "bg-gray-100 text-slate-500 border-gray-200"
                          }`}
                      >
                        {i + 1}
                      </span>
                      <span
                        className={`text-xs font-bold truncate flex-1 transition-colors ${isDark ? "text-zinc-200" : "text-slate-750"
                          }`}
                      >
                        {s.title || "(Chưa đặt tên)"}
                      </span>
                      {i === 0 && (
                        <span className="bg-emerald-955 text-emerald-400 border border-emerald-900/40 text-[9px] px-1.5 py-0.5 rounded-md font-extrabold shadow-3xs">
                          Bắt đầu
                        </span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(s.id);
                            setEditingStep(s);
                          }}
                          className={`p-1 rounded-md transition-colors cursor-pointer ${isDark
                              ? "text-zinc-450 hover:bg-zinc-800 hover:text-indigo-400"
                              : "text-slate-400 hover:bg-slate-100 hover:text-indigo-650"
                            }`}
                          title="Sửa giai đoạn"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
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
                className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#1f1f1f] text-zinc-400 px-4.5 py-2 text-xs font-bold hover:bg-zinc-800 hover:text-zinc-200 transition-all cursor-pointer shadow-3xs"
              >
                <ArrowLeft className="h-4 w-4" /> Quay lại
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {step === 1 ? (
              <>
                <button
                  onClick={onClose}
                  className="rounded-xl border border-gray-250 px-5 py-2 text-xs font-bold text-slate-650 hover:bg-slate-50 transition-all cursor-pointer shadow-3xs"
                >
                  Hủy
                </button>
                <button
                  onClick={goNext}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-650 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-750 transition-all cursor-pointer shadow-sm shadow-indigo-500/10"
                >
                  Tiếp tục <ChevronRight className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="rounded-xl border border-zinc-800 px-5 py-2 text-xs font-bold text-zinc-450 hover:text-zinc-200 hover:bg-zinc-800 transition-all cursor-pointer shadow-3xs"
                >
                  Hủy
                </button>
                <button
                  onClick={handleFinish}
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-655 hover:bg-indigo-750 text-white px-6 py-2 text-xs font-extrabold shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-98"
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
    });
  };

  const inp = `w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold transition-all ${isDark
      ? "bg-[#242424] border border-zinc-750 text-zinc-200"
      : "bg-white border border-gray-200 text-slate-800"
    }`;

  const row = `flex items-start gap-3 py-2.5 border-b transition-colors ${isDark ? "border-zinc-800/60" : "border-gray-100"
    }`;

  const rowLabel = `w-28 shrink-0 text-[11px] font-bold pt-0.5 ${isDark ? "text-zinc-500" : "text-slate-450"
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
            <span className={`text-xs font-bold ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
              Giai đoạn
            </span>
            <span className="text-sm font-extrabold text-indigo-500">{title.toUpperCase() || "(CHƯA ĐẶT TÊN)"}</span>
            {isFirstStep && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-extrabold uppercase">
                Bắt đầu
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isDark ? "hover:bg-zinc-800 text-zinc-450 hover:text-zinc-200" : "hover:bg-gray-100 text-slate-400"
              }`}
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
                className={`w-10 text-center rounded-xl text-xs font-bold border transition-all ${isDark ? "bg-zinc-800 border-zinc-700 text-zinc-400" : "bg-gray-100 border-gray-200 text-slate-500"
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
              <span className={`text-[11px] font-extrabold uppercase tracking-wide ${isDark ? "text-cyan-400" : "text-cyan-600"
                }`}>
                Công việc con ({subTasks.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {subTasks.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${isDark ? "bg-zinc-800/60 border-zinc-700 text-zinc-200" : "bg-slate-50 border-gray-100 text-slate-700"
                    }`}
                >
                  <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                  <span className="flex-1 uppercase tracking-wide">{t.title}</span>
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
                  className={`flex-1 text-xs font-semibold outline-none bg-transparent transition-colors ${isDark ? "text-zinc-300 placeholder-zinc-700" : "text-slate-700 placeholder-slate-350"
                    }`}
                />
                {newSubTask && (
                  <button
                    onClick={addSubTask}
                    className="rounded-lg p-1 text-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/10"
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
            <span className={`text-[11px] font-extrabold uppercase tracking-wide mb-2 block ${isDark ? "text-cyan-400" : "text-cyan-600"}`}>
              Tệp, ảnh, video, ghi âm và liên kết
            </span>
            <AttachmentEditor attachments={attachments} onChange={setAttachments} />
          </div>

          {/* Giai đoạn tiếp theo */}
          {nextStep && (
            <div className={`py-2.5`}>
              <span className={`text-[11px] font-extrabold uppercase tracking-wide mb-2 block ${isDark ? "text-cyan-400" : "text-cyan-600"
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
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-extrabold uppercase tracking-wide ${isDark ? "bg-zinc-800 border-zinc-700 text-zinc-200" : "bg-white border-gray-200 text-slate-700"
                    }`}
                >
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border mr-1 ${isDark ? "bg-zinc-700 border-zinc-600 text-zinc-400" : "bg-gray-100 border-gray-200 text-slate-500"
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
            onClick={onClose}
            className={`px-4.5 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${isDark
                ? "border-zinc-700 text-zinc-450 hover:text-zinc-200 hover:bg-zinc-800"
                : "border-gray-250 text-slate-600 hover:bg-gray-100"
              }`}
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="px-5.5 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-sm active:scale-98"
          >
            Ghi nhận
          </button>
        </div>
      </div>
    </div>
  );
}


import React, { useEffect, useState } from "react";
import type { HRTask } from "../../types/hr";
import { apiFetch } from "../../modules/shared/lib/apiFetch";
import {
  TrendingUp,
  LifeBuoy,
  CheckCircle2,
  UserPlus,
  Sliders,
  X,
  AlertTriangle,
  UserCheck,
  Clock,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import "./kanban-task-progress.css";

function progressOf(task: HRTask) {
  return ["Done", "done"].includes(task.status)
    ? 100
    : task.progress ?? (["In Progress", "doing", "Review/Testing"].includes(task.status) ? 1 : 0);
}

export function TaskProgressSummary({ task }: { task: HRTask }) {
  const currentProgress = progressOf(task);
  return (
    <div className="my-2 space-y-1 text-xs">
      <div className="flex items-center justify-between text-on-surface-variant dark:text-slate-300 font-medium">
        <span>Tiến độ: {currentProgress}%</span>
        <span className="text-[11px] text-on-surface-variant dark:text-slate-400">
          {currentProgress === 100 ? "Hoàn thành" : currentProgress > 0 ? "Đang làm" : "Chưa bắt đầu"}
        </span>
      </div>
      <progress
        aria-label="Tiến độ công việc"
        className="block h-2 w-full overflow-hidden rounded-full accent-primary dark:accent-indigo-500"
        value={currentProgress}
        max={100}
      />
      {task.progressNote && (
        <p className="line-clamp-2 text-on-surface-variant dark:text-slate-400 text-[11px] bg-surface dark:bg-slate-800/60 p-2 rounded-lg border border-outline-variant dark:border-slate-800">
          💬 {task.progressNote}
        </p>
      )}
      {task.helpRequested && (
        <p className="font-bold text-red-600 dark:text-red-400 text-xs flex items-center gap-1 mt-1" role="status">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          ● Cần trợ giúp: {task.helpReason}
        </p>
      )}
    </div>
  );
}

export function KanbanTaskProgress({
  task,
  uid,
  manager,
  employees = [],
  onSaved,
  onReload,
}: {
  task: HRTask;
  uid: string;
  manager: boolean;
  employees?: Array<{ id?: string; uid?: string; name: string; avatar?: string }>;
  onSaved: (task: HRTask) => void;
  onReload: () => void;
}) {
  const [progress, setProgress] = useState(progressOf(task));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Popups state
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpHelperUid, setHelpHelperUid] = useState("");
  const [helpReason, setHelpReason] = useState("");
  useEffect(() => {
    if (!showProgressModal && !showHelpModal) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) { setShowProgressModal(false); setShowHelpModal(false); }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showProgressModal, showHelpModal, busy]);

  useEffect(() => {
    setProgress(progressOf(task));
  }, [task.id, task.progress, task.status]);

  const owner = manager || uid === task.assigneeUid;
  const closed = task.status === "Archived";

  async function saveProgress() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch<{ data: HRTask & { _id: string } }>(
        `/kanban/tasks/${task.id}/activity`,
        {
          method: "PATCH",
          body: JSON.stringify({
            action: "progress",
            progress,
            note: note.trim(),
            revision: task.revision || 0,
          }),
        }
      );
      onSaved({ ...response.data, id: response.data._id });
      setNote("");
      setMessage("Đã lưu báo cáo tiến độ thành công.");
      setShowProgressModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật công việc.");
      if ((err as any)?.status === 409) onReload();
    } finally {
      setBusy(false);
    }
  }

  async function saveHelp() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const selectedEmp = employees.find(
        (e) => (e.id || e.uid) === helpHelperUid
      );
      const helperPayload = selectedEmp
        ? { uid: selectedEmp.id || selectedEmp.uid, name: selectedEmp.name }
        : undefined;

      const formattedNote = selectedEmp
        ? `Nhờ ${selectedEmp.name} hỗ trợ: ${helpReason.trim()}`
        : helpReason.trim();

      const response = await apiFetch<{ data: HRTask & { _id: string } }>(
        `/kanban/tasks/${task.id}/activity`,
        {
          method: "PATCH",
          body: JSON.stringify({
            action: "help",
            note: formattedNote,
            ...(helperPayload ? { helper: helperPayload } : {}),
            revision: task.revision || 0,
          }),
        }
      );
      onSaved({ ...response.data, id: response.data._id });
      setHelpReason("");
      setHelpHelperUid("");
      setMessage("Đã gửi yêu cầu trợ giúp thành công.");
      setShowHelpModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi yêu cầu trợ giúp.");
      if ((err as any)?.status === 409) onReload();
    } finally {
      setBusy(false);
    }
  }

  async function saveAction(action: "resolve" | "join") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch<{ data: HRTask & { _id: string } }>(
        `/kanban/tasks/${task.id}/activity`,
        {
          method: "PATCH",
          body: JSON.stringify({ action, revision: task.revision || 0 }),
        }
      );
      onSaved({ ...response.data, id: response.data._id });
      setMessage(
        action === "resolve"
          ? "Đã đóng yêu cầu trợ giúp."
          : "Đã tham gia hỗ trợ công việc."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật công việc.");
      if ((err as any)?.status === 409) onReload();
    } finally {
      setBusy(false);
    }
  }

  const availableEmployees = employees.filter(
    (emp) => (emp.id || emp.uid) !== uid && (emp.id || emp.uid) !== task.assigneeUid
  );

  return (
    <section
      className={`mb-5 rounded-2xl border p-4.5 transition-colors text-left ${
        task.helpRequested
          ? "task-needs-help bg-rose-50/70 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900"
          : "border-primary/20 bg-primary/10 dark:border-slate-800 dark:bg-slate-800/40"
      }`}
    >
      <div className="flex items-center justify-between border-b border-primary/20 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-on-primary shadow-xs">
            <TrendingUp className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-on-surface dark:text-slate-100">
            Tiến độ & trợ giúp
          </h3>
        </div>
        <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary dark:bg-surface dark:text-primary">
          {progressOf(task)}%
        </span>
      </div>

      <TaskProgressSummary task={task} />

      <div className="mt-3 space-y-1.5 text-xs text-on-surface-variant dark:text-slate-400">
        <p>
          Phụ trách chính / KPI:{" "}
          <strong className="text-on-surface dark:text-slate-200">
            {task.assignee || "Chưa phân công"}
          </strong>
        </p>
        {!!task.helpers?.length && (
          <p className="flex items-center gap-1 text-primary dark:text-primary font-medium">
            <UserCheck className="h-3.5 w-3.5" />
            Người hỗ trợ: {task.helpers.map((helper) => helper.name).join(", ")}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {owner && !closed && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setProgress(progressOf(task));
                setShowProgressModal(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-on-primary shadow-sm hover:bg-primary disabled:opacity-50 transition cursor-pointer"
            >
              <Sliders className="h-3.5 w-3.5" />
              Báo cáo tiến độ
            </button>

            {!task.helpRequested && progressOf(task) < 100 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setHelpReason("");
                  setShowHelpModal(true);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-rose-300 bg-surface-container-lowest px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/40 disabled:opacity-50 transition cursor-pointer"
              >
                <LifeBuoy className="h-3.5 w-3.5" />
                Yêu cầu trợ giúp
              </button>
            )}

            {task.helpRequested && (
              <button
                type="button"
                disabled={busy}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-surface-container-lowest px-3.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40 disabled:opacity-50 transition cursor-pointer"
                onClick={() => saveAction("resolve")}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Đã giải quyết trợ giúp
              </button>
            )}
          </>
        )}

        {!closed &&
          task.helpRequested &&
          uid !== task.assigneeUid &&
          !task.helpers?.some((helper) => helper.uid === uid) && (
            <button
              type="button"
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-on-primary shadow-sm hover:bg-rose-500 disabled:opacity-50 transition cursor-pointer"
              onClick={() => saveAction("join")}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Tham gia hỗ trợ
            </button>
          )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {message}
        </p>
      )}

      {/* POPUP 1: BÁO CÁO TIẾN ĐỘ (Drag Slider & Note) */}
      {showProgressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs ">
          <div role="dialog" aria-modal="true" aria-label="Báo cáo tiến độ công việc" className="relative w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-outline-variant pb-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-surface dark:text-primary">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-on-surface dark:text-slate-100">
                    Báo cáo tiến độ công việc
                  </h4>
                  <p className="text-xs text-on-surface-variant dark:text-slate-400 line-clamp-1">
                    {task.title || `Công việc #${task.id}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng báo cáo tiến độ"
                onClick={() => setShowProgressModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-on-surface-variant dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="mt-5 space-y-5">
              {/* Progress Slider Section */}
              <div className="rounded-xl border border-outline-variant bg-surface/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-on-surface-variant dark:text-slate-400">
                    Tiến độ hoàn thành:
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold text-primary dark:text-primary">
                      {progress}%
                    </span>
                    <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary dark:bg-surface dark:text-primary">
                      {progress === 100
                        ? "Hoàn thành"
                        : progress > 0
                        ? "Đang làm"
                        : "Chưa bắt đầu"}
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <label htmlFor={`progress-${task.id}`} className="sr-only">
                    Tiến độ báo cáo: {progress}% — {progress === 100 ? "Hoàn thành" : progress > 0 ? "Đang làm" : "Chưa bắt đầu"}
                  </label>
                  <input
                    id={`progress-${task.id}`}
                    autoFocus
                    aria-label="Cập nhật tiến độ"
                    className="w-full accent-primary h-2 bg-slate-200 rounded-lg cursor-pointer dark:bg-slate-700"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={progress}
                    disabled={busy}
                    onChange={(event) => setProgress(Number(event.target.value))}
                  />
                </div>

                {/* Quick Presets */}
                <div className="mt-3 flex items-center justify-between gap-1 text-[11px] font-semibold text-on-surface-variant">
                  {[0, 25, 50, 75, 100].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setProgress(val)}
                      className={`rounded-lg px-2 py-1 transition cursor-pointer ${
                        progress === val
                          ? "bg-primary text-on-primary"
                          : "hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress Note */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant dark:text-slate-300 mb-1.5">
                  Nội dung báo cáo tiến độ <span className="text-rose-500">*</span>
                </label>
                <textarea
                  aria-label="Ghi chú báo cáo hoặc lý do trợ giúp"
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-sm text-on-surface outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  rows={3}
                  maxLength={2000}
                  value={note}
                  disabled={busy}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Mô tả kết quả công việc đã hoàn thành, vướng mắc nếu có..."
                />
                <p className="mt-1 text-right text-[11px] text-slate-400">
                  {note.length}/2000 ký tự
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-outline-variant pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowProgressModal(false)}
                className="rounded-xl border border-outline-variant px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busy || !note.trim()}
                onClick={saveProgress}
                className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-on-primary shadow-md hover:bg-primary disabled:opacity-50 transition cursor-pointer"
              >
                {busy ? "Đang lưu..." : "Lưu báo cáo tiến độ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 2: GỬI YÊU CẦU TRỢ GIÚP (Select Helper & Reason) */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs ">
          <div role="dialog" aria-modal="true" aria-label="Yêu cầu trợ giúp công việc" className="relative w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-outline-variant pb-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                  <LifeBuoy className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-on-surface dark:text-slate-100">
                    Yêu cầu trợ giúp công việc
                  </h4>
                  <p className="text-xs text-on-surface-variant dark:text-slate-400">
                    Chọn người hỗ trợ và mô tả nguyên nhân cần trợ giúp
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng yêu cầu trợ giúp"
                onClick={() => setShowHelpModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-on-surface-variant dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="mt-5 space-y-4">
              {/* Select Helper */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant dark:text-slate-300 mb-1.5">
                  Chọn người trợ giúp
                </label>
                <select
                  aria-label="Chọn người trợ giúp"
                  className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-xs font-medium text-on-surface outline-none transition focus:border-rose-500 focus:bg-surface-container-lowest focus:ring-2 focus:ring-rose-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 cursor-pointer"
                  value={helpHelperUid}
                  onChange={(e) => setHelpHelperUid(e.target.value)}
                >
                  <option value="">Tất cả thành viên trong nhóm / Bất kỳ ai</option>
                  {availableEmployees.map((emp) => (
                    <option key={emp.id || emp.uid} value={emp.id || emp.uid}>
                      {emp.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Bạn có thể chỉ định cụ thể một người hoặc để cả đội ngũ cùng nhận được thông báo.
                </p>
              </div>

              {/* Help Reason */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant dark:text-slate-300 mb-1.5">
                  Nguyên nhân cần trợ giúp <span className="text-rose-500">*</span>
                </label>
                <textarea
                  aria-label="Nguyên nhân cần trợ giúp"
                  autoFocus
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-sm text-on-surface outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  rows={3}
                  maxLength={2000}
                  value={helpReason}
                  disabled={busy}
                  onChange={(e) => setHelpReason(e.target.value)}
                  placeholder="Mô tả cụ thể nguyên nhân, vướng mắc kỹ thuật hoặc khó khăn đang gặp..."
                />
                <p className="mt-1 text-right text-[11px] text-slate-400">
                  {helpReason.length}/2000 ký tự
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-outline-variant pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="rounded-xl border border-outline-variant px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busy || !helpReason.trim()}
                onClick={saveHelp}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-on-primary shadow-md hover:bg-rose-500 disabled:opacity-50 transition cursor-pointer"
              >
                {busy ? "Đang gửi..." : "Gửi yêu cầu trợ giúp"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

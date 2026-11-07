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

function progressOf(task: HRTask) {
  return ["Done", "done"].includes(task.status)
    ? 100
    : task.progress ?? (["In Progress", "doing", "Review/Testing"].includes(task.status) ? 1 : 0);
}

export function TaskProgressSummary({ task }: { task: HRTask }) {
  const currentProgress = progressOf(task);
  return (
    <div className="my-2 space-y-1 text-xs">
      <div className="flex items-center justify-between text-slate-600 font-medium">
        <span>Tiến độ: {currentProgress}%</span>
        <span className="text-[11px] text-slate-600">
          {currentProgress === 100 ? "Hoàn thành" : currentProgress > 0 ? "Đang làm" : "Chưa bắt đầu"}
        </span>
      </div>
      <progress
        aria-label="Tiến độ công việc"
        className="block h-2 w-full overflow-hidden rounded-full accent-primary"
        value={currentProgress}
        max={100}
      />
      {task.progressNote && (
        <p className="line-clamp-2 rounded-lg bg-white p-2 text-[11px] text-slate-600">
          💬 {task.progressNote}
        </p>
      )}
      {task.helpRequested && (
        <p className="mt-1 flex items-center gap-1 text-xs font-bold text-red-600" role="status">
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
    <section className="mb-5 rounded-xl bg-white p-4 text-left text-slate-900">
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-on-primary shadow-xs">
            <TrendingUp aria-hidden="true" className="size-4" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">
            Tiến độ & trợ giúp
          </h3>
        </div>
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          {progressOf(task)}%
        </span>
      </div>

      <TaskProgressSummary task={task} />

      <div className="mt-3 space-y-1.5 text-xs text-slate-600">
        <p>
          Phụ trách chính / KPI:{" "}
          <strong className="text-slate-900">
            {task.assignee || "Chưa phân công"}
          </strong>
        </p>
        {!!task.helpers?.length && (
          <p className="flex items-center gap-1 text-primary font-medium">
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
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-rose-300 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
              >
                <LifeBuoy className="h-3.5 w-3.5" />
                Yêu cầu trợ giúp
              </button>
            )}

            {task.helpRequested && (
              <button
                type="button"
                disabled={busy}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
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
        <p role="alert" className="mt-3 text-xs font-semibold text-rose-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-xs font-semibold text-emerald-700">
          {message}
        </p>
      )}

      {/* POPUP 1: BÁO CÁO TIẾN ĐỘ (Drag Slider & Note) */}
      {showProgressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs ">
          <div role="dialog" aria-modal="true" aria-label="Báo cáo tiến độ công việc" className="relative w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sliders aria-hidden="true" className="size-5" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-slate-900">
                    Báo cáo tiến độ công việc
                  </h4>
                  <p className="line-clamp-1 text-xs text-slate-600">
                    {task.title || `Công việc #${task.id}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng báo cáo tiến độ"
                onClick={() => setShowProgressModal(false)}
                className="cursor-pointer rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-primary"
               data-erp-modal-close>
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="mt-5 space-y-5">
              {/* Progress Slider Section */}
              <div className="rounded-xl bg-white p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-slate-600">
                    Tiến độ hoàn thành:
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold tabular-nums text-primary">
                      {progress}%
                    </span>
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
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
                    className="h-2 w-full cursor-pointer rounded-lg bg-slate-200 accent-primary focus-visible:outline-2 focus-visible:outline-primary"
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
                <div className="mt-3 flex items-center justify-between gap-1 text-[11px] font-semibold text-slate-600">
                  {[0, 25, 50, 75, 100].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setProgress(val)}
                      className={`rounded-lg px-2 py-1 transition cursor-pointer ${
                        progress === val
                          ? "bg-primary text-on-primary"
                          : "hover:bg-slate-100"
                      }`}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress Note */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Nội dung báo cáo tiến độ <span className="text-rose-500">*</span>
                </label>
                <textarea
                  aria-label="Ghi chú báo cáo hoặc lý do trợ giúp"
                  className="w-full rounded-md border border-outline-variant bg-white p-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-primary"
                  rows={3}
                  maxLength={2000}
                  value={note}
                  disabled={busy}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Mô tả kết quả công việc đã hoàn thành, vướng mắc nếu có..."
                />
                <p className="mt-1 text-right text-[11px] text-slate-600">
                  {note.length}/2000 ký tự
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-5 flex items-center justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setShowProgressModal(false)}
                className="cursor-pointer rounded-md border border-outline-variant bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-primary"
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
          <div role="dialog" aria-modal="true" aria-label="Yêu cầu trợ giúp công việc" className="relative w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <LifeBuoy aria-hidden="true" className="size-5" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-slate-900">
                    Yêu cầu trợ giúp công việc
                  </h4>
                  <p className="text-xs text-slate-600">
                    Chọn người hỗ trợ và mô tả nguyên nhân cần trợ giúp
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng yêu cầu trợ giúp"
                onClick={() => setShowHelpModal(false)}
                className="cursor-pointer rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-primary"
               data-erp-modal-close>
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="mt-5 space-y-4">
              {/* Select Helper */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Chọn người trợ giúp
                </label>
                <select
                  aria-label="Chọn người trợ giúp"
                  className="w-full cursor-pointer rounded-md border border-outline-variant bg-white px-3.5 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-primary"
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
                <p className="mt-1 text-[11px] text-slate-600">
                  Bạn có thể chỉ định cụ thể một người hoặc để cả đội ngũ cùng nhận được thông báo.
                </p>
              </div>

              {/* Help Reason */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Nguyên nhân cần trợ giúp <span className="text-rose-500">*</span>
                </label>
                <textarea
                  aria-label="Nguyên nhân cần trợ giúp"
                  autoFocus
                  className="w-full rounded-md border border-outline-variant bg-white p-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-primary"
                  rows={3}
                  maxLength={2000}
                  value={helpReason}
                  disabled={busy}
                  onChange={(e) => setHelpReason(e.target.value)}
                  placeholder="Mô tả cụ thể nguyên nhân, vướng mắc kỹ thuật hoặc khó khăn đang gặp..."
                />
                <p className="mt-1 text-right text-[11px] text-slate-600">
                  {helpReason.length}/2000 ký tự
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-5 flex items-center justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="cursor-pointer rounded-md border border-outline-variant bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-primary"
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

import React from "react";
import { PauseCircle } from "lucide-react";
import { toast } from "../../../../pages/Toast";
import { getApiErrorMessage } from "../../../../utils/errorMessage";
import { apiFetch } from "../../lib/api";
import type { Batch, BatchEnrollment, Student } from "../../types";
import { ErpModal } from "../Erp/ErpUI";

type EnrollmentOption = { batch: Batch; enrollment: BatchEnrollment };

export function StudentSuspensionModal({ student, batches, onClose, onSuccess }: {
  student: Student;
  batches: Batch[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [options, setOptions] = React.useState<EnrollmentOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const [batchId, setBatchId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [expectedReturnAt, setExpectedReturnAt] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void Promise.all(batches.map(async (batch) => {
      try {
        const response = await apiFetch<{ success?: boolean; data?: BatchEnrollment[] }>(`/batches/${batch.id}/enrollments`);
        const enrollment = (Array.isArray(response?.data) ? response.data : []).find((item) => item.studentId === student.id && item.status === "Đang học");
        return enrollment ? { batch, enrollment } : null;
      } catch {
        return null;
      }
    })).then((loaded) => {
      if (!active) return;
      const eligible = loaded.filter((item): item is EnrollmentOption => item !== null);
      setOptions(eligible);
      if (eligible.length === 1) setBatchId(eligible[0].batch.id);
      if (!eligible.length) setLoadError("Không tìm thấy lớp có đăng ký đang học để bảo lưu.");
    }).catch(() => {
      if (active) setLoadError("Không thể tải đăng ký lớp của học viên.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [batches, student.id]);

  const save = async () => {
    if (!batchId) { toast.error("Hãy chọn lớp cần bảo lưu."); return; }
    if (!reason.trim()) { toast.error("Hãy nhập lý do bảo lưu."); return; }
    setSaving(true);
    try {
      await apiFetch(`/batches/${batchId}/learners/${student.id}/enrollment-status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Bảo lưu", reason: reason.trim(), expectedReturnAt: expectedReturnAt || null }),
      });
      toast.success(`Đã bảo lưu ${student.fullName}.`);
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể bảo lưu học viên."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ErpModal title="Bảo lưu học viên" onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <PauseCircle className="mt-0.5 size-5 shrink-0 text-amber-700" />
          <div><p className="text-sm font-semibold text-slate-800">{student.fullName}</p><p className="mt-1 text-xs text-slate-600">Chọn lớp cần bảo lưu. Học viên sẽ được gỡ khỏi danh sách lớp và giữ nguyên lịch sử học.</p></div>
        </div>

        {loading ? <p className="py-5 text-center text-sm text-slate-500">Đang tải đăng ký lớp...</p> : loadError ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{loadError}</p> : <>
          <label className="block text-xs font-semibold text-slate-700">Lớp cần bảo lưu <span className="text-rose-500">*</span>
            <select value={batchId} onChange={(event) => setBatchId(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100">
              <option value="">Chọn lớp</option>
              {options.map(({ batch }) => <option key={batch.id} value={batch.id}>{batch.code} · {batch.courseTitle}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-700">Lý do bảo lưu <span className="text-rose-500">*</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={1000} placeholder="Nhập lý do bảo lưu" className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
          </label>
          <label className="block text-xs font-semibold text-slate-700">Ngày dự kiến quay lại <span className="font-normal text-slate-400">(không bắt buộc)</span>
            <input type="date" value={expectedReturnAt} onChange={(event) => setExpectedReturnAt(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
          </label>
        </>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={onClose} disabled={saving} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Hủy</button>
          <button type="button" onClick={() => void save()} disabled={loading || saving || !!loadError || !options.length} className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Đang lưu..." : "Xác nhận bảo lưu"}</button>
        </div>
      </div>
    </ErpModal>
  );
}

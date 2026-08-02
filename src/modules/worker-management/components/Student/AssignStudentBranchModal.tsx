import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { apiFetch } from "../../lib/api";
import type { Student } from "../../types";
import type { BranchOption } from "../../../../context/BranchContext";
import { toast } from "../../../../pages/Toast";

interface Props {
  student: Student | null;
  branches: BranchOption[];
  onClose: () => void;
  onSuccess: () => void;
}

export function AssignStudentBranchModal({
  student,
  branches,
  onClose,
  onSuccess,
}: Props) {
  const [branchId, setBranchId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    setBranchId(branches[0]?._id || "");
  }, [student, branches]);
  if (!student) return null;
  const assign = async () => {
    if (!branchId) return;
    setSubmitting(true);
    try {
      await apiFetch(`/students/${student.id}/assign-branch`, {
        method: "PATCH",
        body: JSON.stringify({ branchId }),
      });
      toast.success("Đã gán chi nhánh thành công.");
      window.dispatchEvent(new Event("student-mutation"));
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể gán chi nhánh.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Gán chi nhánh
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {student.fullName} · {student.phone}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="mt-5 block text-xs font-bold text-slate-700">
          Chi nhánh hoạt động
        </label>
        <select
          value={branchId}
          onChange={(event) => setBranchId(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          {branches.map((branch) => (
            <option key={branch._id} value={branch._id}>
              {branch.name} ({branch.code})
            </option>
          ))}
        </select>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
          >
            Hủy
          </button>
          <button
            onClick={assign}
            disabled={!branchId || submitting}
            className="flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Gán
            chi nhánh
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { apiFetch } from "../../lib/api";
import type { Student } from "../../types";
import type { BranchOption } from "../../../../context/BranchContext";
import { toast } from "../../../../pages/Toast";
import { RoadmapPicker } from "../ui/RoadmapPicker";

interface Props { student: Student | null; branches: BranchOption[]; onClose: () => void; onSuccess: () => void; }

export function AssignStudentBranchModal({ student, branches, onClose, onSuccess }: Props) {
  const [branchId, setBranchId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { setBranchId(branches[0]?._id || ""); }, [student, branches]);
  if (!student) return null;
  const assign = async () => {
    if (!branchId) return;
    setSubmitting(true);
    try {
      await apiFetch(`/students/${student.id}/assign-branch`, { method: "PATCH", body: JSON.stringify({ branchId }) });
      toast.success("Đã gán chi nhánh thành công.");
      window.dispatchEvent(new Event("student-mutation"));
      onSuccess();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể gán chi nhánh."); }
    finally { setSubmitting(false); }
  };
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
    <div className="w-full max-w-md rounded-2xl border border-sky-100 bg-white p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-sky-100 pb-4"><div className="border-l-4 border-brand-primary pl-3"><h3 className="text-base font-medium text-slate-900">Gán chi nhánh</h3><p className="mt-1 text-xs text-slate-500">{student.fullName} · {student.phone}</p></div><button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600" aria-label="Đóng"><X className="h-4 w-4" /></button></div>
      <label className="mt-5 mb-2 block text-xs font-normal text-slate-700">Chi nhánh hoạt động</label>
      <RoadmapPicker value={branchId} onChange={setBranchId} placeholder="Chọn chi nhánh" options={branches.map((branch) => ({ value: branch._id, label: `${branch.name} (${branch.code})` }))} />
      <div className="mt-5 flex justify-end border-t border-sky-100 pt-4"><button onClick={assign} disabled={!branchId || submitting} className="flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-xs font-medium text-white hover:bg-brand-primary/90 disabled:opacity-50">{submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Gán chi nhánh</button></div>
    </div>
  </div>;
}

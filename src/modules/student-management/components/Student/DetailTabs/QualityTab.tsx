import React from "react";
import { BookOpenCheck, ClipboardCheck, Loader2 } from "lucide-react";
import { getStudentQuality } from "../../../api/studentQuality.api";
import type { Student, StudentQualityRow } from "../../../types";

const warningLabel: Record<StudentQualityRow["warningLevel"], string> = {
  risk: "Cần can thiệp",
  watch: "Cần theo dõi",
  good: "Ổn định",
  unrated: "Chưa đánh giá",
};

export function QualityTab({ student }: { student: Student }) {
  const [rows, setRows] = React.useState<StudentQualityRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    void getStudentQuality({ search: student.phone, limit: 100 })
      .then((response) => {
        if (active) setRows(response.items.filter((row) => row.studentId === student.id));
      })
      .catch(() => {
        if (active) setRows([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [student.id, student.phone]);

  if (loading) return <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Đang tải chất lượng học tập...</div>;
  if (rows.length === 0) return <div className="border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400">Chưa có dữ liệu chất lượng theo lớp.</div>;

  return <div className="space-y-3">
    {rows.map((row) => <div key={row.id} className="border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-slate-800">{row.batchCode} · {row.courseTitle}</p><p className="mt-1 text-xs text-slate-400">{warningLabel[row.warningLevel]}</p></div><div className="grid grid-cols-2 gap-2 text-xs"><Metric icon={ClipboardCheck} label="Chuyên cần" value={`${row.attendance.attended}/${row.attendance.total}${row.attendance.rate === null ? "" : ` · ${row.attendance.rate}%`}`} /><Metric icon={BookOpenCheck} label="Bài tập" value={`${row.assignments.completed}/${row.assignments.total}${row.assignments.rate === null ? "" : ` · ${row.assignments.rate}%`}`} /></div></div>{row.attitudeNote || row.teacherAssessment ? <div className="mt-4 grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-2"><p className="text-sm text-slate-600"><span className="font-bold text-slate-700">Thái độ: </span>{row.attitudeNote || "Chưa ghi nhận"}</p><p className="text-sm text-slate-600"><span className="font-bold text-slate-700">Đánh giá: </span>{row.teacherAssessment || "Chưa ghi nhận"}</p></div> : null}</div>)}
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof ClipboardCheck; label: string; value: string }) {
  return <div className="border border-slate-100 bg-slate-50 px-3 py-2"><div className="flex items-center gap-1 text-slate-400"><Icon className="h-3.5 w-3.5" /><span>{label}</span></div><p className="mt-1 font-bold text-slate-700">{value}</p></div>;
}

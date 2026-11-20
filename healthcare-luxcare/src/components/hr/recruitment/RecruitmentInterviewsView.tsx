import React, { useCallback, useEffect, useState } from "react";
import { Eye, Pencil, Plus } from "lucide-react";
import { recruitmentApi } from "../../../services/recruitmentService";
import { authService } from "../../../services/authService";
import type { RecruitmentApplicant, RecruitmentInterview, RecruitmentJob } from "../../../types/recruitment";
import type { UserProfile } from "../../../types";
import { useAuth } from "../../../context/AuthContext";
import { useBranch } from "../../../context/BranchContext";
import { toast } from "../../../pages/Toast";
import {
  fieldClass,
  labelClass,
  primaryButton,
  RecruitmentDialog,
  secondaryButton,
  ViewState,
} from "./RecruitmentForms";
import { Pagination } from "../../common/Pagination";
import { emptyPagination } from "../../../types/pagination";

export default function RecruitmentInterviewsView({ canManage }: { canManage: boolean }) {
  const { userProfile } = useAuth();
  const { activeBranchId } = useBranch();
  const [items, setItems] = useState<RecruitmentInterview[]>([]);
  const [applicants, setApplicants] = useState<RecruitmentApplicant[]>([]);
  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(emptyPagination);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<RecruitmentInterview | null>(null);
  const [editing, setEditing] = useState<RecruitmentInterview | null>(null);
  const openInterview = async (item: RecruitmentInterview, mode: "view" | "edit") => {
    try {
      const detail = await recruitmentApi.getInterview(item._id);
      mode === "view" ? setViewing(detail) : setEditing(detail);
    } catch (e: any) { toast.error(e.message || "Không thể tải chi tiết lịch phỏng vấn."); }
  };
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [i, a, j, u] = await Promise.all([
        recruitmentApi.listInterviewsPage({ page, limit: 20 }),
        recruitmentApi.listApplicants({ limit: 100 }),
        recruitmentApi.listJobs({ limit: 100 }),
        authService.getUsersByCompany(userProfile?.companyCode || "", activeBranchId || undefined),
      ]);
      setItems(i.data);
      setPagination(i.pagination);
      setApplicants(a);
      setJobs(j);
      setUsers(u);
    } catch (e: any) {
      toast.error(e.message || "Không thể tải lịch phỏng vấn.", { title: "Tải dữ liệu thất bại" });
    } finally {
      setLoading(false);
    }
  }, [userProfile?.companyCode, activeBranchId, page]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="p-4 sm:p-5">
      {canManage && <div className="mb-4 flex justify-end">
        <button className={primaryButton} onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" />
          Lên lịch phỏng vấn
        </button>
      </div>}
      <ViewState
        loading={loading}
        error={error}
        empty={!loading && !items.length ? "Chưa có lịch phỏng vấn trong chi nhánh này." : undefined}
      />
      {items.length > 0 && (
        <><div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
          {items.map((item) => (
            <div key={item._id} className="grid items-center gap-2 p-4 sm:grid-cols-[180px_1fr_1fr_120px_auto]">
              <div>
                <div className="font-semibold">{new Date(item.scheduledStart).toLocaleDateString("vi-VN")}</div>
                <div className="text-xs text-slate-500">
                  {new Date(item.scheduledStart).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} -{" "}
                  {new Date(item.scheduledEnd).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <div>
                <div className="font-semibold">
                  {applicants.find((a) => a._id === item.applicantId)?.fullName || "Ứng viên"}
                </div>
                <div className="text-xs text-slate-500">{jobs.find((j) => j._id === item.jobId)?.title}</div>
              </div>
              <div className="text-sm">
                {item.format === "online" ? item.meetingLink || "Trực tuyến" : item.location || "Tại văn phòng"}
              </div>
              <div className="text-sm font-semibold capitalize">{item.status}</div>
              <div className="flex justify-end gap-1">
                <button type="button" className={secondaryButton} onClick={() => void openInterview(item, "view")} aria-label="Xem chi tiết lịch phỏng vấn" title="Xem chi tiết"><Eye className="h-4 w-4" /></button>
                {canManage && <button type="button" className={secondaryButton} onClick={() => void openInterview(item, "edit")} aria-label="Chỉnh sửa lịch phỏng vấn" title="Chỉnh sửa"><Pencil className="h-4 w-4" /></button>}
              </div>
            </div>
          ))}
        </div><Pagination currentPage={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} className="mt-4" /></>
      )}
      {canManage && adding && (
        <InterviewForm
          applicants={applicants}
          jobs={jobs}
          users={users}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await load();
          }}
        />
      )}
      {viewing && <InterviewDetail interview={viewing} applicants={applicants} jobs={jobs} users={users} canManage={canManage} onClose={() => setViewing(null)} onEdit={() => { setEditing(viewing); setViewing(null); }} />}
      {canManage && editing && <InterviewForm interview={editing} applicants={applicants} jobs={jobs} users={users} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}    </div>
  );
}

const formatDateTime = (value: string) => new Date(value).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
function InterviewDetail({ interview, applicants, jobs, users, canManage, onClose, onEdit }: { interview: RecruitmentInterview; applicants: RecruitmentApplicant[]; jobs: RecruitmentJob[]; users: UserProfile[]; canManage: boolean; onClose: () => void; onEdit: () => void }) {
  const applicant = applicants.find((a) => a._id === interview.applicantId)?.fullName || "—";
  const job = jobs.find((j) => j._id === interview.jobId)?.title || "—";
  const interviewers = interview.interviewerIds.map((id) => users.find((u) => u.uid === id)?.displayName).filter(Boolean).join(", ") || "—";
  return <RecruitmentDialog title="Chi tiết buổi phỏng vấn" onClose={onClose}><div className="grid gap-4 sm:grid-cols-2"><Detail label="Ứng viên" value={applicant}/><Detail label="Vị trí" value={job}/><Detail label="Bắt đầu" value={formatDateTime(interview.scheduledStart)}/><Detail label="Kết thúc" value={formatDateTime(interview.scheduledEnd)}/><Detail label="Hình thức" value={interview.format === "online" ? "Trực tuyến" : interview.format === "phone" ? "Điện thoại" : "Tại văn phòng"}/><Detail label={interview.format === "online" ? "Link họp" : "Địa điểm"} value={interview.format === "online" ? interview.meetingLink || "—" : interview.location || "—"}/><Detail label="Người phỏng vấn" value={interviewers}/><Detail label="Trạng thái" value={interview.status}/><Detail label="Kết quả" value={interview.result || "—"}/><Detail label="Ghi chú" value={interview.notes || "—"}/></div><div className="mt-6 flex justify-end gap-2"><button className={secondaryButton} onClick={onClose}>Đóng</button>{canManage && <button className={primaryButton} onClick={onEdit}><Pencil className="h-4 w-4"/>Chỉnh sửa</button>}</div></RecruitmentDialog>;
}
function Detail({label,value}:{label:string;value:string}) { return <div><div className="text-xs font-semibold uppercase text-slate-500">{label}</div><div className="mt-1 whitespace-pre-wrap text-sm">{value}</div></div>; }
function InterviewForm({
  interview,
  applicants,
  jobs,
  users,
  onClose,
  onSaved,
}: {
  interview?: RecruitmentInterview;
  applicants: RecruitmentApplicant[];
  jobs: RecruitmentJob[];
  users: UserProfile[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    applicantId: interview?.applicantId || "",
    jobId: interview?.jobId || "",
    scheduledStart: interview ? new Date(interview.scheduledStart).toISOString().slice(0, 16) : "",
    scheduledEnd: interview ? new Date(interview.scheduledEnd).toISOString().slice(0, 16) : "",
    format: interview?.format || "onsite",
    location: interview?.location || "",
    meetingLink: interview?.meetingLink || "",
    interviewerIds: interview?.interviewerIds || [] as string[],
    status: interview?.status || "scheduled",
    result: interview?.result || "",
    notes: interview?.notes || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const chooseApplicant = (id: string) => {
    const applicant = applicants.find((a) => a._id === id);
    setForm({ ...form, applicantId: id, jobId: applicant?.jobId || "" });
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (interview) await recruitmentApi.updateInterview(interview._id, { ...form, version: interview.version } as any);
      else await recruitmentApi.createInterview(form as any);
      await onSaved();
    } catch (err: any) {
      toast.error(err.message || "Không thể lưu lịch phỏng vấn.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <RecruitmentDialog title={interview ? "Chỉnh sửa lịch phỏng vấn" : "Lên lịch phỏng vấn"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Ứng viên
          <select
            required
            className={fieldClass}
            value={form.applicantId}
            onChange={(e) => chooseApplicant(e.target.value)}
          >
            <option value="">Chọn ứng viên</option>
            {applicants.map((a) => (
              <option key={a._id} value={a._id}>
                {a.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Vị trí
          <input disabled className={fieldClass} value={jobs.find((j) => j._id === form.jobId)?.title || ""} />
        </label>
        <label className={labelClass}>
          Bắt đầu
          <input
            required
            type="datetime-local"
            className={fieldClass}
            value={form.scheduledStart}
            onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })}
          />
        </label>
        <label className={labelClass}>
          Kết thúc
          <input
            required
            type="datetime-local"
            className={fieldClass}
            value={form.scheduledEnd}
            onChange={(e) => setForm({ ...form, scheduledEnd: e.target.value })}
          />
        </label>
        <label className={labelClass}>
          Hình thức
          <select
            className={fieldClass}
            value={form.format}
            onChange={(e) => setForm({ ...form, format: e.target.value as "online" | "onsite" | "phone" })}
          >
            <option value="onsite">Tại văn phòng</option>
            <option value="online">Trực tuyến</option>
            <option value="phone">Điện thoại</option>
          </select>
        </label>
        <label className={labelClass}>
          {form.format === "online" ? "Link họp" : "Địa điểm"}
          <input
            className={fieldClass}
            value={form.format === "online" ? form.meetingLink : form.location}
            onChange={(e) =>
              setForm({ ...form, [form.format === "online" ? "meetingLink" : "location"]: e.target.value })
            }
          />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Người phỏng vấn
          <select
            multiple
            className={`${fieldClass} min-h-24`}
            value={form.interviewerIds}
            onChange={(e) =>
              setForm({ ...form, interviewerIds: Array.from(e.target.selectedOptions, (option) => option.value) })
            }
          >
            {users.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.displayName}
              </option>
            ))}
          </select>
        </label>
        {interview && <label className={labelClass}>Trạng thái<select className={fieldClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as RecruitmentInterview["status"] })}><option value="scheduled">Đã lên lịch</option><option value="completed">Đã hoàn thành</option><option value="cancelled">Đã hủy</option></select></label>}
        {interview && <label className={labelClass}>Kết quả<input className={fieldClass} value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}/></label>}        <label className={`${labelClass} sm:col-span-2`}>
          Ghi chú
          <textarea
            className={fieldClass}
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className={secondaryButton} onClick={onClose}>
            Hủy
          </button>
          <button className={primaryButton} disabled={saving}>
            {saving ? "Đang lưu..." : interview ? "Lưu thay đổi" : "Tạo lịch"}
          </button>
        </div>
      </form>
    </RecruitmentDialog>
  );
}

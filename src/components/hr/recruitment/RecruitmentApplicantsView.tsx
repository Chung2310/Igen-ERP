import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Columns3, List, Pencil, Plus } from "lucide-react";
import { recruitmentApi } from "../../../services/recruitmentService";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import type {
  RecruitmentApplicant,
  RecruitmentJob,
  RecruitmentPipeline,
} from "../../../types/recruitment";
import ApplicantDetailPanel from "./ApplicantDetailPanel";
import {
  fieldClass,
  labelClass,
  primaryButton,
  RecruitmentDialog,
  RecruitmentFileInput,
  secondaryButton,
  ViewState,
} from "./RecruitmentForms";
import {
  RECRUITMENT_FILE_ACCEPT,
  validateRecruitmentFile,
} from "./recruitmentFile";
import { applicantOutcomeLabels } from "./recruitmentLabels";
import { DateInput24 } from "../../common/TimeInput24";
import { StyledSelect } from "../../common/StyledSelect";

export default function RecruitmentApplicantsView({ canManage }: { canManage: boolean }) {
  const [applicants, setApplicants] = useState<RecruitmentApplicant[]>([]);
  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [pipeline, setPipeline] = useState<RecruitmentPipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"list" | "kanban">("list");
  const [adding, setAdding] = useState(false);
  const [editingApplicant, setEditingApplicant] = useState<RecruitmentApplicant | null>(null);
  const [selected, setSelected] = useState<RecruitmentApplicant | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [a, j, p] = await Promise.all([
        recruitmentApi.listApplicants(),
        recruitmentApi.listJobs(),
        recruitmentApi.getPipeline(),
      ]);
      setApplicants(a);
      setJobs(j);
      setPipeline(p);
    } catch (e: any) {
      setError(getApiErrorMessage(e, "Không thể tải danh sách ứng viên."));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const move = async (applicant: RecruitmentApplicant, stageId: string) => {
    try {
      await recruitmentApi.transitionApplicant(
        applicant._id,
        applicant.version,
        stageId,
      );
      await load();
    } catch (e: any) {
      setError(
        e.status === 409
          ? "Ứng viên đã được cập nhật ở nơi khác. Dữ liệu đã tải lại."
          : e.message,
      );
      await load();
    }
  };
  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex items-center gap-2 rounded-2xl bg-white p-3 shadow-[0_2px_16px_rgba(33,84,123,0.07)]">
        <div className="inline-flex rounded-xl bg-[#F0F5FA] p-1">
          <button
            title="Danh sách"
            className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${mode === "list" ? "bg-white text-[#087BDF] shadow-sm" : "text-[#7C90AB] hover:text-[#087BDF]"}`}
            onClick={() => setMode("list")}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            title="Kanban"
            className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${mode === "kanban" ? "bg-white text-[#087BDF] shadow-sm" : "text-[#7C90AB] hover:text-[#087BDF]"}`}
            onClick={() => setMode("kanban")}
          >
            <Columns3 className="h-4 w-4" />
          </button>
        </div>
        {canManage && (
          <button
            className={`${primaryButton} ml-auto`}
            onClick={() => setAdding(true)}
          >
            <Plus className="h-4 w-4" />
            Thêm ứng viên
          </button>
        )}
      </div>
      <ViewState
        loading={loading}
        error={error}
        empty={
          !loading && !applicants.length
            ? "Chưa có ứng viên trong chi nhánh này."
            : undefined
        }
      />
      {!loading && applicants.length > 0 && mode === "list" && (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_2px_16px_rgba(33,84,123,0.07)]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#EAF6FE] text-xs font-medium text-[#087BDF]">
              <tr>
                <th className="px-4 py-3">Ứng viên</th>
                <th className="px-4 py-3">Vị trí</th>
                <th className="px-4 py-3">Nguồn</th>
                <th className="px-4 py-3">Giai đoạn</th>
                <th className="px-4 py-3">Kết quả</th>
                {canManage && <th className="px-4 py-3 text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF3F9] text-[#15396C]">
              {applicants.map((a) => (
                <tr key={a._id} className="hover:bg-[#F8FCFF]">
                  <td className="px-4 py-3">
                    <button
                      className="font-medium text-[#087BDF] hover:underline"
                      onClick={() => setSelected(a)}
                    >
                      {a.fullName}
                    </button>
                    <div className="text-xs text-slate-500">
                      {a.email || a.phone}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {jobs.find((j) => j._id === a.jobId)?.title || "-"}
                  </td>
                  <td className="px-4 py-3">{a.source || "-"}</td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <StyledSelect ariaLabel={`Giai đoạn ${a.fullName}`} className="w-44" value={a.stageId} onChange={(value) => void move(a, value)} options={pipeline?.stages.filter((s) => s.isActive).map((s) => ({ value: s.id, label: s.name })) || []} />
                    ) : (
                      pipeline?.stages.find((stage) => stage.id === a.stageId)?.name || "-"
                    )}
                  </td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${a.outcome === "hired" ? "bg-[#DCF7E8] text-[#078252]" : a.outcome === "rejected" ? "bg-[#FFE8EC] text-[#C83D58]" : a.outcome === "withdrawn" ? "bg-[#EAF0F7] text-[#536B8F]" : "bg-[#E8F4FF] text-[#087BDF]"}`}>{applicantOutcomeLabels[a.outcome]}</span></td>
                  {canManage && <td className="px-4 py-3 text-right"><button type="button" className={secondaryButton} title={`Sửa ứng viên ${a.fullName}`} aria-label={`Sửa ứng viên ${a.fullName}`} onClick={() => setEditingApplicant(a)}><Pencil className="h-4 w-4" /></button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && mode === "kanban" && (
        <div className="grid min-w-[900px] grid-flow-col auto-cols-[280px] gap-3 overflow-x-auto pb-3">
          {pipeline?.stages
            .filter((s) => s.isActive)
            .map((stage) => (
              <section
                key={stage.id}
                className="min-h-[360px] rounded-2xl bg-[#F0F7FC] p-2"
              >
                <h3 className="flex h-10 items-center justify-between px-2 text-sm font-medium text-[#15396C]">
                  <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />{stage.name}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[#087BDF]">
                    {applicants.filter((a) => a.stageId === stage.id).length}
                  </span>
                </h3>
                <div className="grid gap-2 px-2">
                  {applicants
                    .filter((a) => a.stageId === stage.id)
                    .map((a) => (
                      <button
                        key={a._id}
                        onClick={() => setSelected(a)}
                        className="rounded-xl bg-white p-3 text-left shadow-[0_2px_10px_rgba(33,84,123,0.07)] transition-colors hover:bg-[#F9FCFF]"
                      >
                        <div className="font-medium text-[#15396C]">
                          {a.fullName}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {jobs.find((j) => j._id === a.jobId)?.title}
                        </div>
                      </button>
                    ))}
                </div>
              </section>
            ))}
        </div>
      )}
      {canManage && (adding || editingApplicant) && (
        <ApplicantForm
          jobs={editingApplicant ? jobs : jobs.filter((j) => j.status === "open")}
          applicant={editingApplicant}
          onClose={() => { setAdding(false); setEditingApplicant(null); }}
          onSaved={async () => {
            setAdding(false);
            setEditingApplicant(null);
            await load();
          }}
        />
      )}
      {selected && (
        <ApplicantDetailPanel
          applicant={selected}
          jobs={jobs}
          canManage={canManage}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function ApplicantForm({
  jobs,
  applicant,
  onClose,
  onSaved,
}: {
  jobs: RecruitmentJob[];
  applicant: RecruitmentApplicant | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<any>(applicant ? { ...applicant, birthDate: applicant.birthDate?.slice(0, 10) || "", availableDate: applicant.availableDate?.slice(0, 10) || "", skills: applicant.skills?.join(", ") || "", expectedSalary: applicant.expectedSalary ?? "", cvUrl: applicant.cvUrl || "", cvPublicId: applicant.cvPublicId || "" } : { jobId: jobs[0]?._id || "", fullName: "", email: "", phone: "", birthDate: "", address: "", experience: "", education: "", skills: "", expectedSalary: "", availableDate: "", source: "", notes: "", cvUrl: "", cvPublicId: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [temporaryPublicId, setTemporaryPublicId] = useState("");
  const [saved, setSaved] = useState(false);
  const fields = useMemo(
    () =>
      [
        ["fullName", "Họ tên"],
        ["email", "Email"],
        ["phone", "Điện thoại"],
        ["birthDate", "Ngày sinh"],
        ["address", "Địa chỉ"],
        ["source", "Nguồn ứng viên"],
        ["expectedSalary", "Lương mong muốn"],
        ["availableDate", "Ngày có thể nhận việc"],
      ] as const,
    [],
  );
  const submit = async (e: React.FormEvent, confirmDuplicate = false) => {
    e.preventDefault();
    if (!form.jobId) { setError("Vui lòng chọn tin tuyển dụng."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        jobId: form.jobId,
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        birthDate: form.birthDate || null,
        address: form.address,
        experience: form.experience,
        education: form.education,
        skills: String(form.skills || "").split(",").map((skill) => skill.trim()).filter(Boolean),
        expectedSalary: form.expectedSalary ? Number(form.expectedSalary) : null,
        availableDate: form.availableDate || null,
        source: form.source,
        notes: form.notes,
        recruiterId: form.recruiterId ?? null,
        cvUrl: form.cvUrl || "",
        cvPublicId: form.cvPublicId || "",
      };
      if (applicant) await recruitmentApi.updateApplicant(applicant._id, { ...payload, version: applicant.version });
      else {
        const result = await recruitmentApi.createApplicant({ ...payload, confirmDuplicate });
        if (result.duplicateWarning) {
          if (confirm("Đã có hồ sơ trùng email hoặc điện thoại trong chi nhánh. Vẫn tạo hồ sơ mới?")) return submit(e, true);
          return;
        }
      }
      setSaved(true);
      await onSaved();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Không thể cập nhật ứng viên."));
    } finally {
      setSaving(false);
    }
  };
  const chooseFile = async (next?: File) => {
    if (!next) return;
    const message = validateRecruitmentFile(next); setError(message); if (message) return;
    setFile(next); setUploading(true);
    try { const uploaded = await recruitmentApi.uploadPublicFile(next); setForm((old: any) => ({ ...old, cvUrl: uploaded.url, cvPublicId: uploaded.publicId })); setTemporaryPublicId(uploaded.publicId); }
    catch (e: any) { setError(getApiErrorMessage(e, "Không thể lưu ứng viên.")); }
    finally { setUploading(false); }
  };
  const close = () => { if (!saved && temporaryPublicId) void recruitmentApi.deleteTemporaryPublicFile(temporaryPublicId).catch(() => undefined); onClose(); };
  return (
    <RecruitmentDialog title={applicant ? "Sửa ứng viên" : "Thêm ứng viên"} onClose={close}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
        <div className={`${labelClass} sm:col-span-2`}>
          Tin tuyển dụng
          <StyledSelect ariaLabel="Tin tuyển dụng" placeholder="Chọn vị trí" value={form.jobId} onChange={(value) => setForm({ ...form, jobId: value })} options={jobs.map((j) => ({ value: j._id, label: `${j.code} - ${j.title}` }))} />
        </div>
        {fields.map(([key, label]) => key === "birthDate" || key === "availableDate" ? (
          <div key={key} className={labelClass}>
            {label}
            <DateInput24 ariaLabel={label} value={form[key]} onChange={(value) => setForm({ ...form, [key]: value })} />
          </div>
        ) : (
          <label key={key} className={labelClass}>
            {label}
            <input
              required={key === "fullName"}
              type={key === "expectedSalary" ? "number" : key === "email" ? "email" : "text"}
              className={fieldClass}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
        <label className={`${labelClass} sm:col-span-2`}>
          Kỹ năng (phân cách bằng dấu phẩy)
          <input
            className={fieldClass}
            value={form.skills}
            onChange={(e) => setForm({ ...form, skills: e.target.value })}
          />
        </label>
        {["experience", "education", "notes"].map((key) => (
          <label key={key} className={`${labelClass} sm:col-span-2`}>
            {key === "experience"
              ? "Kinh nghiệm"
              : key === "education"
                ? "Học vấn"
                : "Ghi chú"}
            <textarea
              rows={3}
              className={fieldClass}
              value={(form as any)[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
        <div className={`${labelClass} sm:col-span-2`}>
          CV
          <RecruitmentFileInput ariaLabel="CV" accept={RECRUITMENT_FILE_ACCEPT} fileName={file?.name} uploading={uploading} onChange={(next) => void chooseFile(next)} />
        </div>
        <label className={`${labelClass} sm:col-span-2`}>Link CV<input aria-label="Link CV" type="url" className={fieldClass} value={form.cvUrl || ""} onChange={(e) => setForm({ ...form, cvUrl: e.target.value, cvPublicId: "" })} /></label>
        <div className="flex justify-end gap-2 border-t border-[#E7F0F8] pt-4 sm:col-span-2">
          <button type="button" className={secondaryButton} onClick={close}>
            Hủy
          </button>
          <button className={primaryButton} disabled={saving || uploading}>
            {saving ? "Đang lưu..." : applicant ? "Lưu thay đổi" : "Thêm ứng viên"}
          </button>
        </div>
      </form>
    </RecruitmentDialog>
  );
}

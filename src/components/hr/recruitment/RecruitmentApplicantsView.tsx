import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Columns3, List, Pencil, Plus } from "lucide-react";
import { recruitmentApi } from "../../../services/recruitmentService";
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
  secondaryButton,
  ViewState,
} from "./RecruitmentForms";
import {
  RECRUITMENT_FILE_ACCEPT,
  validateRecruitmentFile,
} from "./recruitmentFile";
import { applicantOutcomeLabels } from "./recruitmentLabels";

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
      setError(e.message);
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
    <div className="p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
          <button
            title="Danh sách"
            className={`grid h-8 w-8 place-items-center rounded ${mode === "list" ? "bg-slate-900 text-white" : "text-slate-500"}`}
            onClick={() => setMode("list")}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            title="Kanban"
            className={`grid h-8 w-8 place-items-center rounded ${mode === "kanban" ? "bg-slate-900 text-white" : "text-slate-500"}`}
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
        <div className="overflow-x-auto border-y border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Ứng viên</th>
                <th className="px-4 py-3">Vị trí</th>
                <th className="px-4 py-3">Nguồn</th>
                <th className="px-4 py-3">Giai đoạn</th>
                <th className="px-4 py-3">Kết quả</th>
                {canManage && <th className="px-4 py-3 text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applicants.map((a) => (
                <tr key={a._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button
                      className="font-semibold text-cyan-800 hover:underline"
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
                      <select
                        className={`${fieldClass} w-44`}
                        value={a.stageId}
                        onChange={(e) => move(a, e.target.value)}
                      >
                        {pipeline?.stages
                          .filter((s) => s.isActive)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                    ) : (
                      pipeline?.stages.find((stage) => stage.id === a.stageId)?.name || "-"
                    )}
                  </td>
                  <td className="px-4 py-3">{applicantOutcomeLabels[a.outcome]}</td>
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
                className="min-h-[360px] border-t-4 bg-slate-100"
                style={{ borderColor: stage.color }}
              >
                <h3 className="flex h-11 items-center justify-between px-3 text-sm font-bold">
                  {stage.name}
                  <span className="text-xs text-slate-500">
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
                        className="rounded-md border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-cyan-400"
                      >
                        <div className="font-semibold text-slate-900">
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
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, skills: String(form.skills || "").split(",").map((s) => s.trim()).filter(Boolean), expectedSalary: form.expectedSalary ? Number(form.expectedSalary) : null, birthDate: form.birthDate || null, availableDate: form.availableDate || null };
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
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  const chooseFile = async (next?: File) => {
    if (!next) return;
    const message = validateRecruitmentFile(next); setError(message); if (message) return;
    setFile(next); setUploading(true);
    try { const uploaded = await recruitmentApi.uploadPublicFile(next); setForm((old: any) => ({ ...old, cvUrl: uploaded.url, cvPublicId: uploaded.publicId })); setTemporaryPublicId(uploaded.publicId); }
    catch (e: any) { setError(e.message); }
    finally { setUploading(false); }
  };
  const close = () => { if (!saved && temporaryPublicId) void recruitmentApi.deleteTemporaryPublicFile(temporaryPublicId).catch(() => undefined); onClose(); };
  return (
    <RecruitmentDialog title={applicant ? "Sửa ứng viên" : "Thêm ứng viên"} onClose={close}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
        <label className={`${labelClass} sm:col-span-2`}>
          Tin tuyển dụng
          <select
            required
            className={fieldClass}
            value={form.jobId}
            onChange={(e) => setForm({ ...form, jobId: e.target.value })}
          >
            <option value="">Chọn vị trí</option>
            {jobs.map((j) => (
              <option key={j._id} value={j._id}>
                {j.code} - {j.title}
              </option>
            ))}
          </select>
        </label>
        {fields.map(([key, label]) => (
          <label key={key} className={labelClass}>
            {label}
            <input
              required={key === "fullName"}
              type={
                key.includes("Date") || key === "birthDate"
                  ? "date"
                  : key === "expectedSalary"
                    ? "number"
                    : key === "email"
                      ? "email"
                      : "text"
              }
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
        <label className={`${labelClass} sm:col-span-2`}>
          CV
          <input
            aria-label="CV"
            type="file"
            accept={RECRUITMENT_FILE_ACCEPT}
            className={fieldClass}
            onChange={(e) => void chooseFile(e.target.files?.[0])}
          />
          <span className="font-normal text-slate-500">
            {uploading ? "Đang tải lên..." : file?.name || "Chưa có tệp"}
          </span>
        </label>
        <label className={`${labelClass} sm:col-span-2`}>Link CV<input aria-label="Link CV" type="url" className={fieldClass} value={form.cvUrl || ""} onChange={(e) => setForm({ ...form, cvUrl: e.target.value, cvPublicId: "" })} /></label>
        <div className="flex justify-end gap-2 sm:col-span-2">
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

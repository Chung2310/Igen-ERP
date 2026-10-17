import React, { useCallback, useEffect, useState } from "react";
import { Archive, Pencil, Plus, Search } from "lucide-react";
import { recruitmentApi } from "../../../services/recruitmentService";
import { toast } from "../../../pages/Toast";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import type {
  RecruitmentJob,
  RecruitmentJobStatus,
} from "../../../types/recruitment";
import {
  fieldClass,
  labelClass,
  primaryButton,
  RecruitmentDialog,
  RecruitmentErrorDialog,
  RecruitmentFileInput,
  secondaryButton,
  ViewState,
} from "./RecruitmentForms";
import {
  RECRUITMENT_FILE_ACCEPT,
  validateRecruitmentFile,
} from "./recruitmentFile";
import { jobStatusLabels } from "./recruitmentLabels";
import { ConfirmDialog } from "../../common/ConfirmDialog";
import { DateInput24 } from "../../common/TimeInput24";
import { StyledSelect } from "../../common/StyledSelect";

const emptyJob = {
  code: "",
  title: "",
  department: "",
  headcount: 1,
  description: "",
  requirements: "",
  benefits: "",
  employmentType: "full_time",
  workplaceType: "onsite" as const,
  location: "",
  applicationDeadline: "",
  showSalary: false,
  status: "draft" as const,
};
const statusLabel: Record<RecruitmentJobStatus, string> = jobStatusLabels;
const statusTone: Record<RecruitmentJobStatus, string> = {
  draft: "!bg-[#EAF0F7] !text-[#536B8F]",
  open: "!bg-[#DCF7E8] !text-[#078252]",
  paused: "!bg-[#FFF0D8] !text-[#A66300]",
  closed: "!bg-[#E8F4FF] !text-[#087BDF]",
};

function missingOpenRequirements(job: RecruitmentJob): string[] {
  const missing: string[] = [];
  if (!job.title?.trim()) missing.push("Tên vị trí");
  if (!job.description?.trim()) missing.push("Mô tả công việc");
  if (!job.requirements?.trim()) missing.push("Yêu cầu ứng viên");
  if (!Number.isFinite(Number(job.headcount)) || Number(job.headcount) <= 0) missing.push("Số lượng tuyển phải lớn hơn 0");
  if (!job.workplaceType?.trim()) missing.push("Hình thức nơi làm việc");
  if (!job.location?.trim()) missing.push("Địa điểm làm việc");
  const deadline = job.applicationDeadline ? new Date(job.applicationDeadline) : null;
  if (!deadline || Number.isNaN(deadline.getTime())) missing.push("Hạn nộp hồ sơ");
  else if (deadline <= new Date()) missing.push("Hạn nộp cần là ngày sau hôm nay");
  return missing;
}

export default function RecruitmentJobsView({ canManage }: { canManage: boolean }) {
  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<RecruitmentJob | null | undefined>();
  const [changingStatusJobId, setChangingStatusJobId] = useState<string | null>(null);
  const [pendingDeleteJob, setPendingDeleteJob] = useState<RecruitmentJob | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<{ title: string; message: string; details?: string[] } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setJobs(await recruitmentApi.listJobs({ search, status }));
    } catch (e: any) {
      setError(getApiErrorMessage(e, "Không thể tải danh sách vị trí tuyển dụng."));
    } finally {
      setLoading(false);
    }
  }, [search, status]);
  useEffect(() => {
    void load();
  }, [load]);
  const changeStatus = async (
    job: RecruitmentJob,
    next: RecruitmentJobStatus,
  ) => {
    if (next === job.status) return;
    setChangingStatusJobId(job._id);
    try {
      await recruitmentApi.changeJobStatus(job._id, job.version, next);
      await load();
      toast.success(`Đã chuyển tin ${job.code} sang ${statusLabel[next]}.`);
    } catch (e: any) {
      const details = e.status !== 409 && next === "open" ? missingOpenRequirements(job) : [];
      const message =
        e.status === 409
          ? "Không thể cập nhật trạng thái vì tin tuyển dụng đã được thay đổi ở nơi khác. Danh sách đã được tải lại."
          : details.length ? "Tin tuyển dụng chưa đủ điều kiện để mở. Vui lòng bổ sung:" : getApiErrorMessage(e, "Không thể cập nhật trạng thái tin tuyển dụng. Vui lòng thử lại.");
      await load();
      setActionError({ title: next === "open" ? "Không thể mở tin tuyển dụng" : "Không thể đổi trạng thái", message, details });
    } finally {
      setChangingStatusJobId(null);
    }
  };
  const confirmDelete = async () => {
    if (!pendingDeleteJob || deleting) return;
    const job = pendingDeleteJob;
    setDeleting(true);
    try {
      await recruitmentApi.deleteJob(job._id, job.version);
      setPendingDeleteJob(null);
      await load();
      toast.success(`Đã xóa tin tuyển dụng ${job.code}.`);
    } catch (e: any) {
      const isConflict = e.status === 409;
      const message = isConflict
        ? "Không thể xóa vì tin tuyển dụng đã được thay đổi ở nơi khác. Danh sách đã được tải lại."
        : getApiErrorMessage(e, "Không thể xóa tin tuyển dụng. Vui lòng thử lại.");
      if (isConflict) {
        setPendingDeleteJob(null);
        await load();
      }
      setActionError({ title: "Không thể xóa tin tuyển dụng", message });
    } finally {
      setDeleting(false);
    }
  };
  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_2px_16px_rgba(33,84,123,0.07)]">
        <div className="relative w-full min-w-0 sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#91A6BF]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm mã, vị trí, phòng ban"
            aria-label="Tìm tin tuyển dụng"
            className={`${fieldClass} pl-9`}
          />
        </div>
        <StyledSelect ariaLabel="Lọc trạng thái tin tuyển dụng" value={status} onChange={setStatus} className="sm:!w-48" options={[{ value: "", label: "Mọi trạng thái" }, ...Object.entries(statusLabel).map(([value, label]) => ({ value, label }))]} />
        {canManage && (
          <button
            className={`${primaryButton} ml-auto`}
            onClick={() => setEditing(null)}
          >
            <Plus className="h-4 w-4" />
            Tạo tin
          </button>
        )}
      </div>
      <ViewState
        loading={loading}
        error={error}
        empty={
          !loading && !jobs.length
            ? "Chưa có tin tuyển dụng trong chi nhánh này."
            : undefined
        }
      />
      {!loading && jobs.length > 0 && (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_2px_16px_rgba(33,84,123,0.07)]">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-[#EAF6FE] text-xs font-medium text-[#087BDF]">
              <tr>
                <th className="px-4 py-3">Vị trí</th>
                <th className="px-4 py-3">Phòng ban</th>
                <th className="px-4 py-3">Số lượng</th>
                <th className="px-4 py-3">Hạn nộp</th>
                <th className="px-4 py-3">Trạng thái</th>
                {canManage && <th className="px-4 py-3 text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF3F9] text-[#15396C]">
              {jobs.map((job) => (
                <tr key={job._id} className="hover:bg-[#F8FCFF]">
                  <td className="px-4 py-3">
                    {canManage ? (
                      <button
                        className="font-medium text-[#087BDF] hover:underline"
                        onClick={() => setEditing(job)}
                      >
                        {job.title || "Chưa đặt tên"}
                      </button>
                    ) : (
                      <div className="font-medium text-[#15396C]">{job.title || "Chưa đặt tên"}</div>
                    )}
                    <div className="text-xs text-slate-500">{job.code}</div>
                  </td>
                  <td className="px-4 py-3">{job.department || "-"}</td>
                  <td className="px-4 py-3">{job.headcount}</td>
                  <td className="px-4 py-3">
                    {job.applicationDeadline
                      ? new Date(job.applicationDeadline).toLocaleDateString(
                          "vi-VN",
                        )
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <StyledSelect ariaLabel={`Trạng thái ${job.code}`} className={`min-w-32 ${statusTone[job.status]}`} value={job.status} disabled={changingStatusJobId === job._id} onChange={(value) => void changeStatus(job, value as RecruitmentJobStatus)} options={Object.entries(statusLabel).map(([value, label]) => ({ value, label }))} />
                    ) : (
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusTone[job.status]}`}>{statusLabel[job.status]}</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="Xóa"
                          aria-label={`Xóa tin tuyển dụng ${job.code}`}
                          className={secondaryButton}
                          onClick={() => setPendingDeleteJob(job)}
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                        <button type="button" title={`Sửa tin tuyển dụng ${job.code}`} aria-label={`Sửa tin tuyển dụng ${job.code}`} className={secondaryButton} onClick={() => setEditing(job)}><Pencil className="h-4 w-4" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing !== undefined && (
        <JobDialog
          job={editing}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined);
            await load();
          }}
        />
      )}
      <ConfirmDialog
        appearance="erp"
        isOpen={pendingDeleteJob !== null}
        title="Xóa tin tuyển dụng?"
        description={pendingDeleteJob ? `Bạn có chắc muốn xóa tin ${pendingDeleteJob.code} - ${pendingDeleteJob.title || "Chưa đặt tên"}?` : ""}
        cancelLabel="Hủy"
        confirmLabel="Xóa tin"
        tone="danger"
        isSubmitting={deleting}
        onClose={() => {
          if (!deleting) setPendingDeleteJob(null);
        }}
        onConfirm={confirmDelete}
      />
      {actionError && <RecruitmentErrorDialog title={actionError.title} message={actionError.message} details={actionError.details} onClose={() => setActionError(null)} />}
    </div>
  );
}

function JobDialog({
  job,
  onClose,
  onSaved,
}: {
  job: RecruitmentJob | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<any>(
    job
      ? {
          ...job,
          applicationDeadline: job.applicationDeadline?.slice(0, 10) || "",
        }
      : emptyJob,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [temporaryPublicId, setTemporaryPublicId] = useState("");
  const [saved, setSaved] = useState(false);
  const [submitError, setSubmitError] = useState<{ message: string; details: string[] } | null>(null);
  const set = (key: string, value: any) =>
    setForm((old: any) => ({ ...old, [key]: value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        code: form.code,
        title: form.title,
        department: form.department,
        headcount: Number(form.headcount),
        description: form.description,
        requirements: form.requirements,
        benefits: form.benefits,
        salaryMin: form.salaryMin,
        salaryMax: form.salaryMax,
        showSalary: form.showSalary,
        employmentType: form.employmentType,
        workplaceType: form.workplaceType,
        location: form.location,
        applicationDeadline: form.applicationDeadline || null,
        status: form.status,
        jdFileUrl: form.jdFileUrl,
        jdFilePublicId: form.jdFilePublicId,
      };
      job ? await recruitmentApi.updateJob(job._id, { ...payload, version: job.version }) : await recruitmentApi.createJob(payload);
      setSaved(true);
      await onSaved();
    } catch (err: any) {
      const details = form.status === "open" ? missingOpenRequirements(form as RecruitmentJob) : [];
      setSubmitError({ message: details.length ? "Tin tuyển dụng chưa đủ điều kiện để mở. Vui lòng bổ sung:" : getApiErrorMessage(err, "Không thể lưu tin tuyển dụng."), details });
    } finally {
      setSaving(false);
    }
  };
  const chooseFile = async (next?: File) => {
    if (!next) return;
    const message = validateRecruitmentFile(next);
    setError(message);
    if (message) return;
    setFile(next); setUploading(true);
    try { const uploaded = await recruitmentApi.uploadPublicFile(next); setForm((old: any) => ({ ...old, jdFileUrl: uploaded.url, jdFilePublicId: uploaded.publicId })); setTemporaryPublicId(uploaded.publicId); }
    catch (e: any) { setError(getApiErrorMessage(e, "Không thể lưu vị trí tuyển dụng.")); }
    finally { setUploading(false); }
  };
  const close = () => { if (!saved && temporaryPublicId) void recruitmentApi.deleteTemporaryPublicFile(temporaryPublicId).catch(() => undefined); onClose(); };
  return (
    <RecruitmentDialog
      title={job ? "Cập nhật tin tuyển dụng" : "Tạo tin tuyển dụng"}
      onClose={close}
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
        <label className={labelClass}>
          Mã tin
          <input
            required
            className={fieldClass}
            value={form.code}
            disabled={Boolean(job)}
            onChange={(e) => set("code", e.target.value)}
          />
        </label>
        <label className={labelClass}>
          Tên vị trí
          <input
            required
            className={fieldClass}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </label>
        <label className={labelClass}>
          Phòng ban
          <input
            className={fieldClass}
            value={form.department}
            onChange={(e) => set("department", e.target.value)}
          />
        </label>
        <label className={labelClass}>
          Số lượng
          <input
            required
            min="1"
            type="number"
            className={fieldClass}
            value={form.headcount}
            onChange={(e) => set("headcount", e.target.value)}
          />
        </label>
        <div className={labelClass}>
          Hình thức nơi làm việc
          <StyledSelect ariaLabel="Hình thức nơi làm việc" value={form.workplaceType} onChange={(value) => set("workplaceType", value)} options={[{ value: "onsite", label: "Tại văn phòng" }, { value: "hybrid", label: "Kết hợp" }, { value: "remote", label: "Từ xa" }]} />
        </div>
        <label className={labelClass}>
          Địa điểm
          <input
            className={fieldClass}
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
          />
        </label>
        <div className={labelClass}>
          Hạn ứng tuyển
          <DateInput24
            ariaLabel="Hạn ứng tuyển"
            value={form.applicationDeadline}
            onChange={(value) => set("applicationDeadline", value)}
          />
        </div>
        <label className={`${labelClass} sm:col-span-2`}>
          Mô tả
          <textarea
            rows={4}
            className={fieldClass}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Yêu cầu
          <textarea
            rows={4}
            className={fieldClass}
            value={form.requirements}
            onChange={(e) => set("requirements", e.target.value)}
          />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Quyền lợi
          <textarea
            rows={3}
            className={fieldClass}
            value={form.benefits}
            onChange={(e) => set("benefits", e.target.value)}
          />
        </label>
        <div className={`${labelClass} sm:col-span-2`}>
          Tệp mô tả công việc
          <RecruitmentFileInput ariaLabel="File JD" accept={RECRUITMENT_FILE_ACCEPT} fileName={file?.name} uploading={uploading} onChange={(next) => void chooseFile(next)} />
        </div>
        <label className={`${labelClass} sm:col-span-2`}>Link JD<input aria-label="Link JD" type="url" className={fieldClass} value={form.jdFileUrl || ""} onChange={(e) => setForm((old: any) => ({ ...old, jdFileUrl: e.target.value, jdFilePublicId: "" }))} /></label>
        <div className="flex justify-end gap-2 border-t border-[#E7F0F8] pt-4 sm:col-span-2">
          <button type="button" className={secondaryButton} onClick={close}>
            Hủy
          </button>
          <button className={primaryButton} disabled={saving || uploading}>
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
      {submitError && <RecruitmentErrorDialog title="Không thể lưu tin tuyển dụng" message={submitError.message} details={submitError.details} onClose={() => setSubmitError(null)} />}
    </RecruitmentDialog>
  );
}

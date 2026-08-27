import React, { useCallback, useEffect, useState } from "react";
import { Archive, Pencil, Plus } from "lucide-react";
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
  secondaryButton,
  ViewState,
} from "./RecruitmentForms";
import {
  RECRUITMENT_FILE_ACCEPT,
  validateRecruitmentFile,
} from "./recruitmentFile";
import { jobStatusLabels } from "./recruitmentLabels";
import { ConfirmDialog } from "../../common/ConfirmDialog";

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
      const message =
        e.status === 409
          ? "Không thể cập nhật trạng thái vì tin tuyển dụng đã được thay đổi ở nơi khác. Danh sách đã được tải lại."
          : getApiErrorMessage(e, "Không thể cập nhật trạng thái tin tuyển dụng. Vui lòng thử lại.");
      await load();
      toast.error(message);
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
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };
  return (
    <div className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm mã, vị trí, phòng ban"
          className={`${fieldClass} max-w-sm`}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={`${fieldClass} w-40`}
        >
          <option value="">Mọi trạng thái</option>
          {Object.entries(statusLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
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
        <div className="overflow-x-auto border-y border-slate-200 bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Vị trí</th>
                <th className="px-4 py-3">Phòng ban</th>
                <th className="px-4 py-3">Số lượng</th>
                <th className="px-4 py-3">Hạn nộp</th>
                <th className="px-4 py-3">Trạng thái</th>
                {canManage && <th className="px-4 py-3 text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <tr key={job._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {canManage ? (
                      <button
                        className="font-semibold text-cyan-800 hover:underline"
                        onClick={() => setEditing(job)}
                      >
                        {job.title || "Chưa đặt tên"}
                      </button>
                    ) : (
                      <div className="font-semibold text-slate-900">{job.title || "Chưa đặt tên"}</div>
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
                      <select
                        aria-label={`Trạng thái ${job.code}`}
                        className={`${fieldClass} min-w-32 py-2`}
                        value={job.status}
                        disabled={changingStatusJobId === job._id}
                        onChange={(event) => void changeStatus(job, event.target.value as RecruitmentJobStatus)}
                      >
                        {Object.entries(statusLabel).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    ) : (
                      statusLabel[job.status]
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
      setError(getApiErrorMessage(err, "Không thể cập nhật vị trí tuyển dụng."));
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
        <label className={labelClass}>
          Hình thức nơi làm việc
          <select
            className={fieldClass}
            value={form.workplaceType}
            onChange={(e) => set("workplaceType", e.target.value)}
          >
            <option value="onsite">Tại văn phòng</option>
            <option value="hybrid">Kết hợp</option>
            <option value="remote">Từ xa</option>
          </select>
        </label>
        <label className={labelClass}>
          Địa điểm
          <input
            className={fieldClass}
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
          />
        </label>
        <label className={labelClass}>
          Hạn ứng tuyển
          <input
            type="date"
            className={fieldClass}
            value={form.applicationDeadline}
            onChange={(e) => set("applicationDeadline", e.target.value)}
          />
        </label>
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
        <label className={`${labelClass} sm:col-span-2`}>
          File JD
          <input
            aria-label="File JD"
            type="file"
            accept={RECRUITMENT_FILE_ACCEPT}
            className={fieldClass}
            onChange={(e) => chooseFile(e.target.files?.[0])}
          />
          <span className="font-normal text-slate-500">
            {uploading ? "Đang tải lên..." : file?.name || "Chưa có tệp"}
          </span>
        </label>
        <label className={`${labelClass} sm:col-span-2`}>Link JD<input aria-label="Link JD" type="url" className={fieldClass} value={form.jdFileUrl || ""} onChange={(e) => setForm((old: any) => ({ ...old, jdFileUrl: e.target.value, jdFilePublicId: "" }))} /></label>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className={secondaryButton} onClick={close}>
            Hủy
          </button>
          <button className={primaryButton} disabled={saving || uploading}>
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </RecruitmentDialog>
  );
}

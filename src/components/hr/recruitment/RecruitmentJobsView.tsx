import React, { useCallback, useEffect, useState } from "react";
import { Archive, CirclePause, Download, Plus, RefreshCw } from "lucide-react";
import { recruitmentApi } from "../../../services/recruitmentService";
import type {
  RecruitmentAttachment,
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

export default function RecruitmentJobsView() {
  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<RecruitmentJob | null | undefined>();
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setJobs(await recruitmentApi.listJobs({ search, status }));
    } catch (e: any) {
      setError(e.message);
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
    try {
      await recruitmentApi.changeJobStatus(job._id, job.version, next);
      await load();
    } catch (e: any) {
      setError(
        e.status === 409
          ? "Dữ liệu đã thay đổi. Danh sách đã được tải lại."
          : e.message,
      );
      await load();
    }
  };
  const remove = async (job: RecruitmentJob) => {
    if (!confirm(`Xóa tin ${job.code}?`)) return;
    await recruitmentApi.deleteJob(job._id, job.version);
    await load();
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
        <button
          className={`${primaryButton} ml-auto`}
          onClick={() => setEditing(null)}
        >
          <Plus className="h-4 w-4" />
          Tạo tin
        </button>
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
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <tr key={job._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button
                      className="font-semibold text-cyan-800 hover:underline"
                      onClick={() => setEditing(job)}
                    >
                      {job.title || "Chưa đặt tên"}
                    </button>
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
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold">
                      {statusLabel[job.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {job.status !== "open" && (
                        <button
                          title="Mở tuyển"
                          className={secondaryButton}
                          onClick={() => changeStatus(job, "open")}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                      {job.status === "open" && (
                        <button
                          title="Tạm dừng"
                          className={secondaryButton}
                          onClick={() => changeStatus(job, "paused")}
                        >
                          <CirclePause className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        title="Xóa"
                        className={secondaryButton}
                        onClick={() => remove(job)}
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
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
  const [attachment, setAttachment] = useState<RecruitmentAttachment | null>(
    null,
  );
  const [savedJob, setSavedJob] = useState<RecruitmentJob | null>(null);
  useEffect(() => {
    if (!job) return;
    recruitmentApi
      .getJobAttachment(job._id)
      .then(setAttachment)
      .catch((e) => setError(e.message));
  }, [job]);
  const set = (key: string, value: any) =>
    setForm((old: any) => ({ ...old, [key]: value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    let owner = savedJob;
    try {
      if (!owner) {
        const payload = {
          ...form,
          headcount: Number(form.headcount),
          applicationDeadline: form.applicationDeadline || null,
        };
        owner = job
          ? await recruitmentApi.updateJob(job._id, {
              ...payload,
              version: job.version,
            })
          : await recruitmentApi.createJob(payload);
        setSavedJob(owner);
      }
      if (file) {
        try {
          setAttachment(
            attachment
              ? await recruitmentApi.uploadJobAttachment(
                  owner._id,
                  file,
                  attachment.version,
                )
              : await recruitmentApi.uploadJobAttachment(owner._id, file),
          );
          setFile(null);
        } catch (uploadError: any) {
          setError(
            `Tin tuyển dụng đã được lưu nhưng tải File JD thất bại: ${uploadError.message}. Hãy thử lại.`,
          );
          return;
        }
      }
      await onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  const chooseFile = (next?: File) => {
    if (!next) return;
    const message = validateRecruitmentFile(next);
    setError(message);
    if (!message) setFile(next);
  };
  const download = async () => {
    if (!attachment) return;
    try {
      const result = await recruitmentApi.downloadAttachment(attachment._id);
      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setError(e.message);
    }
  };
  const removeAttachment = async () => {
    if (!attachment || !confirm(`Xóa ${attachment.originalName}?`)) return;
    try {
      await recruitmentApi.deleteAttachment(attachment._id);
      setAttachment(null);
    } catch (e: any) {
      setError(e.message);
    }
  };
  return (
    <RecruitmentDialog
      title={job ? "Cập nhật tin tuyển dụng" : "Tạo tin tuyển dụng"}
      onClose={onClose}
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
        <label className={labelClass}>
          Trạng thái
          <select
            className={fieldClass}
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {Object.entries(statusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
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
            {file?.name || attachment?.originalName || "Chưa có tệp"}
          </span>
        </label>
        {attachment && (
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="button"
              className={secondaryButton}
              onClick={download}
            >
              <Download className="h-4 w-4" />
              Tải xuống
            </button>
            <button
              type="button"
              className={secondaryButton}
              onClick={removeAttachment}
            >
              Xóa
            </button>
          </div>
        )}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className={secondaryButton} onClick={onClose}>
            Hủy
          </button>
          <button className={primaryButton} disabled={saving}>
            {saving ? "Đang lưu..." : savedJob ? "Thử tải lại" : "Lưu"}
          </button>
        </div>
      </form>
    </RecruitmentDialog>
  );
}

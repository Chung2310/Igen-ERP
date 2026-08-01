import React, { useEffect, useState } from "react";
import { Download, Upload } from "lucide-react";
import { recruitmentApi } from "../../../services/recruitmentService";
import type {
  RecruitmentApplicant,
  RecruitmentAttachment,
  RecruitmentHistory,
  RecruitmentJob,
} from "../../../types/recruitment";
import {
  primaryButton,
  RecruitmentDialog,
  secondaryButton,
  ViewState,
} from "./RecruitmentForms";
import {
  RECRUITMENT_FILE_ACCEPT,
  validateRecruitmentFile,
} from "./recruitmentFile";

export default function ApplicantDetailPanel({
  applicant,
  jobs,
  onClose,
}: {
  applicant: RecruitmentApplicant;
  jobs: RecruitmentJob[];
  onClose: () => void;
}) {
  const [history, setHistory] = useState<RecruitmentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attachment, setAttachment] = useState<RecruitmentAttachment | null>(
    null,
  );
  const load = () =>
    Promise.all([
      recruitmentApi.applicantHistory(applicant._id),
      recruitmentApi.getApplicantAttachment(applicant._id),
    ])
      .then(([nextHistory, nextAttachment]) => {
        setHistory(nextHistory);
        setAttachment(nextAttachment);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  useEffect(() => {
    void load();
  }, [applicant._id]);
  const upload = async (file?: File) => {
    if (!file) return;
    const message = validateRecruitmentFile(file);
    if (message) {
      setError(message);
      return;
    }
    try {
      await recruitmentApi.uploadApplicantAttachment(
        applicant._id,
        file,
        attachment?.version,
      );
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };
  const download = async (file: RecruitmentAttachment) => {
    try {
      const result = await recruitmentApi.downloadAttachment(file._id);
      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setError(e.message);
    }
  };
  const remove = async (file: RecruitmentAttachment) => {
    if (!confirm(`Xóa ${file.originalName}?`)) return;
    try {
      await recruitmentApi.deleteAttachment(file._id);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };
  return (
    <RecruitmentDialog title={applicant.fullName} onClose={onClose}>
      <div className="grid gap-5 md:grid-cols-2">
        <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-slate-500">Vị trí</dt>
          <dd>{jobs.find((j) => j._id === applicant.jobId)?.title || "-"}</dd>
          <dt className="text-slate-500">Email</dt>
          <dd>{applicant.email || "-"}</dd>
          <dt className="text-slate-500">Điện thoại</dt>
          <dd>{applicant.phone || "-"}</dd>
          <dt className="text-slate-500">Nguồn</dt>
          <dd>{applicant.source || "-"}</dd>
          <dt className="text-slate-500">Kỹ năng</dt>
          <dd>{applicant.skills?.join(", ") || "-"}</dd>
          <dt className="text-slate-500">Kinh nghiệm</dt>
          <dd className="whitespace-pre-wrap">{applicant.experience || "-"}</dd>
        </dl>
        <div>
          <h4 className="mb-2 text-sm font-bold text-slate-800">
            Lịch sử quy trình
          </h4>
          <ViewState
            loading={loading}
            error={error}
            empty={
              !loading && !history.length
                ? "Chưa có lịch sử chuyển bước."
                : undefined
            }
          />
          {history.length > 0 && (
            <ol className="border-l border-slate-300 pl-4">
              {history.map((item) => (
                <li key={item._id} className="mb-4 text-sm">
                  <div className="font-semibold">
                    {item.fromStageName ? `${item.fromStageName} → ` : ""}
                    {item.toStageName}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleString("vi-VN")}
                  </div>
                  {item.note && (
                    <p className="mt-1 text-slate-600">{item.note}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      <div className="mt-5 border-t border-slate-200 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-800">CV và hồ sơ</h4>
          <label className={`${primaryButton} cursor-pointer`}>
            <Upload className="h-4 w-4" />
            Tải tệp lên
            <input
              aria-label="CV"
              type="file"
              accept={RECRUITMENT_FILE_ACCEPT}
              className="hidden"
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </label>
        </div>
        {!attachment ? (
          <p className="text-sm text-slate-500">Chưa có tệp đính kèm.</p>
        ) : (
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {[attachment].map((file) => (
              <div
                key={file._id}
                className="flex items-center gap-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">
                  {file.originalName}
                </span>
                <span className="text-xs text-slate-500">
                  {Math.ceil(file.size / 1024)} KB
                </span>
                <button
                  type="button"
                  className={secondaryButton}
                  title="Tải xuống"
                  onClick={() => download(file)}
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => remove(file)}
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </RecruitmentDialog>
  );
}

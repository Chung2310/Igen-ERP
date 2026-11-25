import { useState } from "react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import type { GymList, GymRecord } from "../../../shared/gym/types";
import type { GymApi } from "./api";
import {
  dateLabel,
  Feedback,
  Field,
  GymEmptyState,
  messageOf,
  primary,
  secondary,
  useGymQuery,
} from "./ui";

export default function ProgressReports({
  api,
  customerId,
  canWrite,
}: {
  api: GymApi;
  customerId: string;
  canWrite: boolean;
}) {
  const [periodStart, setStart] = useState("");
  const [periodEnd, setEnd] = useState("");
  const [draft, setDraft] = useState<GymRecord>();
  const [summary, setSummary] = useState("");
  const [deleting, setDeleting] = useState<GymRecord>();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = () => setRevision((value) => value + 1);
  const query = useGymQuery<GymList>(
    api,
    `/progress-reports?customerId=${customerId}&limit=100`,
    revision,
  );
  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
      refresh();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  const useReport = (report: GymRecord) => {
    setDraft(report);
    setSummary(report.summary || "");
    setStart(String(report.periodStart || "").slice(0, 10));
    setEnd(String(report.periodEnd || "").slice(0, 10));
  };

  const metrics = draft?.metrics || {};

  return (
    <section className="space-y-4 rounded-md border border-outline-variant bg-surface-container-lowest p-4">
      <div>
        <h3 className="font-semibold text-on-surface">Báo cáo tiến độ</h3>
        <p className="text-xs text-on-surface-variant">
          Tổng hợp tự động từ buổi tập, khối lượng tạ và số đo InBody trong khoảng ngày đã chọn.
        </p>
      </div>

      {canWrite && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Từ ngày" type="date" value={periodStart} onChange={setStart} />
            <Field label="Đến ngày" type="date" value={periodEnd} onChange={setEnd} />
          </div>
          <button
            type="button"
            className={primary}
            disabled={!periodStart || !periodEnd || busy}
            onClick={() =>
              act(async () => {
                const report = await api.request<GymRecord>(
                  "/progress-reports/generate",
                  "POST",
                  { customerId, periodStart, periodEnd },
                );
                useReport(report);
              })
            }
          >
            {busy ? "Đang tổng hợp..." : "Tạo báo cáo tự động"}
          </button>
        </div>
      )}

      {draft && (
        <section className="space-y-3 border-t border-outline-variant pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-semibold text-on-surface">
                Báo cáo giai đoạn {dateLabel(draft.periodStart)} – {dateLabel(draft.periodEnd)}
              </h4>
              <HrStatusBadge tone={draft.status === "PUBLISHED" ? "success" : "warning"}>
                {draft.status === "PUBLISHED" ? "Đã công bố" : "Bản nháp"}
              </HrStatusBadge>
            </div>
            <button
              type="button"
              className={secondary}
              onClick={() => setDraft(undefined)}
            >
              Đóng xem chi tiết
            </button>
          </div>

          {Object.keys(metrics).length > 0 && (
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Tỷ lệ tham gia", val: metrics.attendanceRate != null ? `${metrics.attendanceRate}%` : "—" },
                { label: "Tổng volume", val: metrics.totalVolume ? `${Math.round(metrics.totalVolume).toLocaleString("vi-VN")} kg` : "—" },
                { label: "RPE trung bình", val: metrics.averageRpe != null ? String(metrics.averageRpe) : "—" },
                { label: "Δ Cân nặng", val: metrics.weightDelta != null ? `${metrics.weightDelta > 0 ? "+" : ""}${metrics.weightDelta} kg` : "—" },
                { label: "Δ % Mỡ", val: metrics.bodyFatDelta != null ? `${metrics.bodyFatDelta > 0 ? "+" : ""}${metrics.bodyFatDelta}%` : "—" },
                { label: "Δ Cơ xương", val: metrics.muscleDelta != null ? `${metrics.muscleDelta > 0 ? "+" : ""}${metrics.muscleDelta} kg` : "—" },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-md border border-outline-variant bg-surface-container-low/50 p-2 text-center tabular-nums"
                >
                  <dt className="text-[11px] text-on-surface-variant">{m.label}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-on-surface">{m.val}</dd>
                </div>
              ))}
            </dl>
          )}

          {(draft.warnings || []).map((warning: string, index: number) => (
            <p
              key={index}
              className="rounded-md border border-tertiary/30 bg-tertiary-container/30 p-2 text-xs text-on-surface"
            >
              {warning}
            </p>
          ))}

          <Field
            label="Nội dung báo cáo"
            multiline
            value={summary}
            disabled={!canWrite}
            onChange={setSummary}
          />

          {canWrite && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={secondary}
                disabled={busy || !summary.trim()}
                onClick={() =>
                  act(async () => {
                    const updated = await api.save(
                      "progress-reports",
                      { customerId, periodStart, periodEnd, summary: summary.trim() },
                      draft,
                    );
                    useReport(updated);
                  })
                }
              >
                Lưu chỉnh sửa
              </button>
              <button
                type="button"
                className={primary}
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    const published = await api.request<GymRecord>(
                      `/progress-reports/${draft._id}/${
                        draft.status === "PUBLISHED" ? "unpublish" : "publish"
                      }`,
                      "PATCH",
                      { revision: draft.revision },
                    );
                    useReport(published);
                  })
                }
              >
                {draft.status === "PUBLISHED" ? "Thu hồi về nháp" : "Công bố báo cáo"}
              </button>
            </div>
          )}
        </section>
      )}

      <div className="space-y-2 border-t border-outline-variant pt-3">
        <h4 className="font-semibold text-on-surface">
          Các báo cáo đã tạo ({query.data?.data.length || 0})
        </h4>
        <Feedback loading={query.loading} error={query.error || error} />
        {query.data?.data.map((report) => (
          <article
            key={report._id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-outline-variant p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-on-surface">
                {dateLabel(report.periodStart)} – {dateLabel(report.periodEnd)}
              </p>
              <p className="line-clamp-2 text-xs text-on-surface-variant">
                {report.summary}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <HrStatusBadge tone={report.status === "PUBLISHED" ? "success" : "warning"}>
                {report.status === "PUBLISHED" ? "Đã công bố" : "Bản nháp"}
              </HrStatusBadge>
              <button
                type="button"
                className={secondary}
                onClick={() => useReport(report)}
              >
                Xem &amp; sửa
              </button>
              {canWrite && report.status === "DRAFT" && (
                <button
                  type="button"
                  className={secondary}
                  onClick={() => setDeleting(report)}
                >
                  Xóa
                </button>
              )}
            </div>
          </article>
        ))}
        {!query.loading && !query.error && !query.data?.data.length && (
          <GymEmptyState kind="task" title="Chưa có báo cáo." />
        )}
      </div>

      <ConfirmDialog
        native
        appearance="erp"
        isOpen={Boolean(deleting)}
        title="Xóa báo cáo?"
        description="Báo cáo nháp đã xóa không thể khôi phục."
        confirmLabel="Xóa báo cáo"
        isSubmitting={busy}
        error={error}
        onClose={() => setDeleting(undefined)}
        onConfirm={() =>
          act(async () => {
            if (deleting) await api.remove("progress-reports", deleting);
            if (draft?._id === deleting?._id) setDraft(undefined);
            setDeleting(undefined);
          })
        }
      />
    </section>
  );
}

import { ProtectedBlogMedia } from "../../components/blog/ProtectedBlogMedia";
import { browserTransport } from "../../services/serviceTransport";
import { getSuperAdminDeviceId } from "../../services/superAdminRequest";
import { useEffect, useState } from "react";
import { createBlogModerationService } from "../../services/blogModerationService";
import {
  BLOG_REPORT_REASONS,
  BLOG_REPORT_STATUSES,
  type BlogReportPage,
  type BlogReportStatus,
} from "../../../shared/blog-moderation";
import { errorDetails } from "../../../shared/error-details";
const api = createBlogModerationService(browserTransport, getSuperAdminDeviceId);
const labels: Record<BlogReportStatus, string> = {
  pending: "Chờ xử lý",
  reviewed: "Đang xem xét",
  resolved: "Đã xử lý",
  dismissed: "Không vi phạm",
};
export default function BlogReportsPage() {
  const [status, setStatus] = useState<BlogReportStatus>("pending");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<BlogReportPage>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    api
      .reports(status, page)
      .then((result) => {
        if (alive) {
          setData(result);
          setError("");
        }
      })
      .catch((failure) => {
        if (alive) setError(errorDetails(failure).message);
      });
    return () => {
      alive = false;
    };
  }, [status, page, revision]);
  async function update(id: string, next: BlogReportStatus, removePost = false) {
    if (busy || (removePost && !window.confirm("Gỡ bài viết khỏi Blog cho tất cả người dùng?"))) return;
    setBusy(true);
    setError("");
    try {
      await api.moderate(id, next, notes[id] ?? data?.items.find(item => item.id === id)?.notes ?? "", removePost);
      setData(undefined);
      setRevision((value) => value + 1);
    } catch (failure) {
      setError(errorDetails(failure).message);
    } finally {
      setBusy(false);
    }
  }
  const action = "rounded-lg border border-slate-600 px-3 py-2 text-sm disabled:opacity-50";
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-bold">Báo cáo Blog</h2>
      <p className="text-sm text-slate-400">
        Báo cáo toàn nền tảng. Kiểm tra thường xuyên và xử lý kịp thời; chỉ gỡ nội dung sau khi xác nhận vi phạm.
      </p>
      <div className="flex gap-3">
        <select
          aria-label="Trạng thái báo cáo"
          disabled={busy}
          className="rounded-lg bg-slate-800 p-2"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as BlogReportStatus);
            setPage(1);
            setData(undefined);
          }}
        >
          {BLOG_REPORT_STATUSES.map((key) => (
            <option value={key} key={key}>
              {labels[key]}
            </option>
          ))}
        </select>
        <button
          className={action}
          disabled={busy}
          onClick={() => {
            setData(undefined);
            setRevision((value) => value + 1);
          }}
        >
          Tải lại
        </button>
      </div>
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Đang tải báo cáo…</p>}
      {data && !data.items.length && <p>Không có báo cáo ở trạng thái này.</p>}
      {data?.items.map((row) => (
        <article key={row.id} className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
          <div className="flex flex-wrap justify-between gap-2">
            <h3 className="font-semibold">{row.title || "Bài viết không có tiêu đề"}</h3>
            <span className="text-sm text-slate-400">{new Date(row.createdAt).toLocaleString("vi-VN")}</span>
          </div>
          <p className="text-sm text-slate-400">
            Tác giả: {row.authorName} · Bài: {row.postId} · Người báo cáo: {row.reporterId}
          </p>
          <p className="whitespace-pre-wrap break-words text-sm">{row.post?.content || row.snippet}</p>
          {row.post?.attachments.map((file, index) => (
            <div key={index} className="space-y-2">
              <p className="text-sm">{file.name || "Tệp đính kèm"}</p>
              {file.type?.startsWith("image/") ||
              file.type?.startsWith("video/") ||
              file.type?.startsWith("audio/") ||
              file.type === "application/pdf" ||
              /\.(png|jpe?g|gif|webp|mp4|webm|mp3|wav|pdf)$/i.test(file.name || "") ? (
                <ProtectedBlogMedia
                  src={file.url}
                  alt={file.name || "Tệp trong bài bị báo cáo"}
                  kind={
                    file.type?.startsWith("video/") || /\.(mp4|webm)$/i.test(file.name || "")
                      ? "video"
                      : file.type?.startsWith("audio/") || /\.(mp3|wav)$/i.test(file.name || "")
                        ? "audio"
                        : file.type === "application/pdf" || /\.pdf$/i.test(file.name || "")
                          ? "document"
                          : "image"
                  }
                  className="h-80 max-w-full rounded-lg"
                />
              ) : (
                <p className="text-sm text-slate-400">
                  Loại tệp này cần kiểm tra bằng công cụ nội bộ trước khi kết luận báo cáo.
                </p>
              )}
            </div>
          ))}
          <p className="font-medium">{BLOG_REPORT_REASONS[row.reason]}</p>
          <p className="whitespace-pre-wrap break-words">{row.details}</p>
          {row.postRemoved && <p className="text-amber-300">Bài viết đã bị gỡ.</p>}
          <label className="block text-sm">
            Ghi chú xử lý
            <textarea
              aria-label={`Ghi chú ${row.id}`}
              className="mt-2 block w-full rounded-lg bg-slate-800 p-3"
              maxLength={2000}
              value={notes[row.id] ?? row.notes}
              disabled={busy}
              onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} className={action} onClick={() => void update(row.id, "reviewed")}>
              Đang xem xét
            </button>
            <button disabled={busy} className={action} onClick={() => void update(row.id, "dismissed")}>
              Không vi phạm
            </button>
            <button disabled={busy} className={action} onClick={() => void update(row.id, "resolved")}>
              Đã xử lý
            </button>
            <button
              disabled={busy || row.postRemoved}
              className={action + " text-red-300"}
              onClick={() => void update(row.id, "resolved", true)}
            >
              Gỡ bài vi phạm
            </button>
          </div>
        </article>
      ))}
      {data && (
        <div className="flex items-center gap-3">
          <button
            disabled={busy || page <= 1}
            className={action}
            onClick={() => {
              setData(undefined);
              setPage((value) => value - 1);
            }}
          >
            Trước
          </button>
          <span>
            Trang {page} · {data.total} báo cáo
          </span>
          <button
            disabled={busy || page * data.limit >= data.total}
            className={action}
            onClick={() => {
              setData(undefined);
              setPage((value) => value + 1);
            }}
          >
            Sau
          </button>
        </div>
      )}
    </section>
  );
}

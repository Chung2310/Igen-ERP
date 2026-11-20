import { useEffect, useState } from "react";
import { Modal } from "../common/Modal";
import { blogModerationService as api } from "../../services/blogModerationService";
import { BLOG_REPORT_REASONS, type BlogBlockedAuthor, type BlogReportReason } from "../../../shared/blog-moderation";
import { errorDetails } from "../../../shared/error-details";
export interface BlogSafetyTarget {
  id: string;
  authorName: string;
}
export function BlogSafetyPanel({
  mode,
  post,
  onClose,
  onBlocked,
  onUnblocked,
}: {
  mode: "report" | "block" | "blocks";
  post?: BlogSafetyTarget;
  onClose: () => void;
  onBlocked: (authorId: string) => void;
  onUnblocked: (authorId: string) => void;
}) {
  const [reason, setReason] = useState<BlogReportReason>("inappropriate");
  const [details, setDetails] = useState("");
  const [rows, setRows] = useState<BlogBlockedAuthor[]>([]);
  const [busy, setBusy] = useState(mode === "blocks");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (mode !== "blocks") return;
    let alive = true;
    api
      .blocks()
      .then((items) => {
        if (alive) setRows(items);
      })
      .catch((failure) => {
        if (alive) setError(errorDetails(failure).message);
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [mode]);
  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (failure) {
      setError(errorDetails(failure).message);
    } finally {
      setBusy(false);
    }
  }
  const close = () => {
    if (!busy) onClose();
  };
  const action = "rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50";
  return (
    <Modal
      isOpen
      onClose={close}
      title={mode === "blocks" ? "Người đã chặn" : mode === "block" ? "Chặn tác giả" : "Báo cáo bài viết"}
    >
      <div role="dialog" aria-modal="true" aria-label="An toàn Blog" className="space-y-4 text-slate-800">
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {mode === "blocks" ? (
          <>
            {busy && <p role="status">Đang xử lý…</p>}
            {!busy && !rows.length && !error && <p>Chưa chặn người dùng nào.</p>}
            {rows.map((row) => (
              <div key={row.authorId} className="flex items-center justify-between gap-3 border-b py-3">
                <span>{row.authorName}</span>
                <button
                  disabled={busy}
                  className={action + " bg-emerald-50 text-emerald-800"}
                  onClick={() =>
                    void run(async () => {
                      await api.unblock(row.authorId);
                      setRows((items) => items.filter((item) => item.authorId !== row.authorId));
                      onUnblocked(row.authorId);
                    })
                  }
                >
                  Bỏ chặn
                </button>
              </div>
            ))}
          </>
        ) : sent ? (
          <p role="status">Đã gửi báo cáo. Quản trị viên sẽ kiểm tra nội dung này.</p>
        ) : (
          <>
            <p className="text-sm">
              {mode === "block"
                ? `Ẩn tất cả bài viết của ${post?.authorName}. Chặn cũng áp dụng trong chat. Bạn có thể bỏ chặn sau.`
                : `Báo cáo bài viết của ${post?.authorName}.`}
            </p>
            {mode === "report" && (
              <>
                <label className="block text-sm font-medium">
                  Lý do
                  <select
                    className="mt-2 block w-full rounded-xl border p-3"
                    value={reason}
                    disabled={busy}
                    onChange={(event) => setReason(event.target.value as BlogReportReason)}
                  >
                    {Object.entries(BLOG_REPORT_REASONS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Chi tiết (không bắt buộc)
                  <textarea
                    className="mt-2 block w-full rounded-xl border p-3"
                    rows={3}
                    maxLength={2000}
                    value={details}
                    disabled={busy}
                    onChange={(event) => setDetails(event.target.value)}
                    placeholder="Mô tả vấn đề cần xem xét"
                  />
                </label>
              </>
            )}
            <button
              disabled={busy || !post}
              className={action + (mode === "block" ? " bg-red-600 text-white" : " bg-emerald-700 text-white")}
              onClick={() =>
                void run(async () => {
                  if (!post) return;
                  if (mode === "block") {
                    const result = await api.blockAuthor(post.id);
                    onBlocked(result.authorId);
                    onClose();
                  } else {
                    await api.report(post.id, reason, details);
                    setSent(true);
                  }
                })
              }
            >
              {busy ? "Đang xử lý…" : mode === "block" ? "Xác nhận chặn" : "Gửi báo cáo"}
            </button>
          </>
        )}
        <button className={action + " text-slate-500"} disabled={busy} onClick={close}>
          Đóng
        </button>
      </div>
    </Modal>
  );
}

import { errorDetails } from "../../../shared/error-details";
import { useEffect, useState } from "react";
interface Report {
  _id: string;
  reason: string;
  status: string;
  createdAt: string;
  details?: string;
  messageSnippet?: string;
  reporterId?: { displayName?: string };
  reportedUserId?: { displayName?: string };
  messageId?: { content?: string; isDeleted?: boolean; attachments?: Array<{ name?: string; url: string }> };
}
async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/v1/chat/reports${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Không thể xử lý báo cáo.");
  return result;
}
export function ChatReportsPanel({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const result = await request("?status=pending&limit=50");
      setRows(result.data || []);
    } catch (error: unknown) {
      setError(errorDetails(error).message || "Không thể xử lý báo cáo.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    request("?status=pending&limit=50")
      .then((result) => {
        if (active) setRows(result.data || []);
      })
      .catch((error: unknown) => {
        if (active) setError(errorDetails(error).message || "Không thể tải báo cáo.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function resolve(row: Report, status: string, removeMessage = false) {
    if (
      removeMessage &&
      !window.confirm("Thu hồi tin nhắn được báo cáo khỏi cuộc trò chuyện? Hồ sơ báo cáo vẫn được giữ.")
    )
      return;
    setBusy(true);
    setError("");
    try {
      await request(`/${row._id}`, "PATCH", {
        status,
        removeMessage,
        adminNotes: removeMessage ? "Đã kiểm tra và thu hồi nội dung vi phạm." : "Đã kiểm tra báo cáo.",
      });
      await load();
    } catch (error: unknown) {
      setError(errorDetails(error).message || "Không thể xử lý báo cáo.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Báo cáo chat"
    >
      <section className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-5 space-y-4">
        <div className="flex justify-between gap-3">
          <h2 className="text-lg font-semibold">Báo cáo chat cần xử lý</h2>
          <button type="button" onClick={onClose}>
            Đóng
          </button>
        </div>
        <p className="text-sm text-slate-600">
          Kiểm tra báo cáo kịp thời. Tin nhắn và tệp được cung cấp để xác minh nội dung bị phản ánh.
        </p>
        {error && (
          <p role="alert" className="text-amber-800">
            {error}
          </p>
        )}
        <button type="button" disabled={busy} onClick={() => void load()} className="underline">
          {busy ? "Đang tải…" : "Tải lại"}
        </button>
        {!busy && !rows.length && <p>Không có báo cáo đang chờ.</p>}
        {rows.map((row) => (
          <article key={row._id} className="space-y-2 rounded-lg border p-3">
            <p className="font-semibold">
              {row.reportedUserId?.displayName || "Người dùng"} — {row.reason}
            </p>
            <p className="text-xs text-slate-500">
              Từ {row.reporterId?.displayName || "Người dùng"} · {new Date(row.createdAt).toLocaleString("vi-VN")}
            </p>
            <p className="whitespace-pre-wrap text-sm">
              {row.messageId?.content || row.messageSnippet || "Không có nội dung văn bản"}
            </p>
            {row.details && <p className="text-sm">Chi tiết: {row.details}</p>}
            {row.messageId?.attachments?.map((file, i) =>
              /^https?:\/\//i.test(file.url) || /^\/(?!\/)/.test(file.url) ? (
                <a key={i} href={file.url} target="_blank" rel="noopener noreferrer" className="block underline">
                  Xem tệp: {file.name || "Đính kèm"}
                </a>
              ) : null,
            )}
            <div className="flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                disabled={busy}
                onClick={() => void resolve(row, "resolved")}
                className="rounded-lg border p-2"
              >
                Đã xử lý
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void resolve(row, "dismissed")}
                className="rounded-lg border p-2"
              >
                Không có vi phạm
              </button>
              {row.messageId && !row.messageId.isDeleted && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void resolve(row, "resolved", true)}
                  className="rounded-lg border p-2 text-red-700"
                >
                  Thu hồi tin nhắn vi phạm
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

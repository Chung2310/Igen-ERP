import React from "react";
import { workerNotificationsApi } from "../api/workerNotifications.api";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import { toast } from "../../../pages/Toast";

type NotificationItem = { _id?: string; title?: string; content?: string; subject?: string; message?: string };
export function WorkerNotificationsPage({ canManage = true }: { canManage?: boolean }) {
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const load = React.useCallback(async () => { setLoading(true); try { setItems((await workerNotificationsApi.list()) as NotificationItem[]); } catch (e) { toast.error(getApiErrorMessage(e, "Không thể tải thông báo")); } finally { setLoading(false); } }, []);
  React.useEffect(() => { void load(); }, [load]);
  const send = async (event: React.FormEvent) => { event.preventDefault(); if (!title.trim() || !content.trim()) return; setSending(true); try { await workerNotificationsApi.create({ title: title.trim(), content: content.trim() }); setTitle(""); setContent(""); await load(); } catch (e) { toast.error(getApiErrorMessage(e, "Không thể gửi thông báo")); } finally { setSending(false); } };
  return (
    <div className="space-y-4">
      <h1 className="border-l-[3px] border-[#00ADFC] pl-3 text-xl font-medium text-slate-900">Thông báo lao động</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        {canManage && (
          <section className="rounded-2xl border border-[#DCE7F4] bg-white p-4 sm:p-5">
            <h2 className="text-base font-medium text-slate-900">Soạn thông báo</h2>
            <form onSubmit={(event) => void send(event)} className="mt-4 space-y-4">
              <label className="block space-y-1.5 text-sm text-slate-600">Tiêu đề
                <input aria-label="Tiêu đề" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nhập tiêu đề" className="h-10 w-full rounded-xl border border-[#DCE7F4] bg-white px-3 text-sm text-slate-800" />
              </label>
              <label className="block space-y-1.5 text-sm text-slate-600">Nội dung
                <textarea aria-label="Nội dung" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Nhập nội dung thông báo" rows={5} className="w-full resize-y rounded-xl border border-[#DCE7F4] bg-white p-3 text-sm text-slate-800" />
              </label>
              <button type="submit" disabled={sending} className="rounded-xl bg-[#00ADFC] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0097dc] disabled:opacity-50">{sending ? "Đang gửi..." : "Gửi thông báo"}</button>
            </form>
          </section>
        )}
        <section className="rounded-2xl border border-[#DCE7F4] bg-white p-4 sm:p-5">
          <h2 className="text-base font-medium text-slate-900">Lịch sử thông báo</h2>
          <div className="mt-4 divide-y divide-[#E7EFF7]">
            {loading ? <p className="py-4 text-sm text-slate-500">Đang tải...</p> : items.length ? items.map((item) => (
              <article key={item._id || item.title} className="py-3 first:pt-0">
                <h3 className="text-sm font-medium text-slate-800">{item.title || item.subject || "Thông báo"}</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500">{item.content || item.message}</p>
              </article>
            )) : <p className="py-4 text-sm text-slate-500">Chưa có thông báo.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

import React from "react";
import { workerNotificationsApi } from "../api/workerNotifications.api";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import { toast } from "../../../pages/Toast";
import { HrEmptyIllustration } from "../../../components/hr/HrEmptyIllustration";

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
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        {canManage && (
          <div className="pt-2 sm:pt-3">
            <form onSubmit={(event) => void send(event)} className="space-y-4">
              <label className="block space-y-1.5 text-base font-medium text-on-surface">Tiêu đề
                <input aria-label="Tiêu đề" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nhập tiêu đề" className="h-10 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-on-surface-variant placeholder:opacity-50 focus:border-primary focus:outline-2 focus:outline-primary" />
              </label>
              <label className="block space-y-1.5 text-base font-medium text-on-surface">Nội dung
                <textarea aria-label="Nội dung" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Nhập nội dung thông báo" rows={5} className="w-full resize-y rounded-md border border-outline-variant bg-surface-container-lowest p-3 text-sm text-on-surface placeholder:text-on-surface-variant placeholder:opacity-50 focus:border-primary focus:outline-2 focus:outline-primary" />
              </label>
              <button type="submit" disabled={sending} className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50">{sending ? "Đang gửi..." : "Gửi thông báo"}</button>
            </form>
          </div>
        )}
        <section className="flex flex-col rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-xs sm:p-5">
          <h2 className="text-balance text-base font-semibold text-on-surface">Lịch sử thông báo</h2>
          <div className="mt-4 flex flex-1 flex-col divide-y divide-outline-variant">
            {loading ? <p className="py-4 text-sm text-on-surface-variant">Đang tải...</p> : items.length ? items.map((item) => (
              <article key={item._id || item.title} className="py-3 first:pt-0">
                <h3 className="text-balance text-sm font-semibold text-on-surface">{item.title || item.subject || "Thông báo"}</h3>
                <p className="mt-1 whitespace-pre-wrap text-pretty text-sm text-on-surface-variant">{item.content || item.message}</p>
              </article>
            )) : <div className="flex min-h-40 flex-1 flex-col items-center justify-center py-4 text-center"><HrEmptyIllustration kind="notification" /><p className="mt-1 text-pretty text-sm text-on-surface-variant">Chưa có thông báo.</p></div>}
          </div>
        </section>
      </div>
    </div>
  );
}

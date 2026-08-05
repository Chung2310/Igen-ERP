import React from "react";
import { workerNotificationsApi } from "../api/workerNotifications.api";

type NotificationItem = { _id?: string; title?: string; content?: string; subject?: string; message?: string };
export function WorkerNotificationsPage({ canManage = true }: { canManage?: boolean }) {
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState("");
  const load = React.useCallback(async () => { setLoading(true); try { setItems((await workerNotificationsApi.list()) as NotificationItem[]); } catch (e) { setError(e instanceof Error ? e.message : "Không thể tải thông báo"); } finally { setLoading(false); } }, []);
  React.useEffect(() => { void load(); }, [load]);
  const send = async (event: React.FormEvent) => { event.preventDefault(); if (!title.trim() || !content.trim()) return; setSending(true); setError(""); try { await workerNotificationsApi.create({ title: title.trim(), content: content.trim() }); setTitle(""); setContent(""); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Không thể gửi thông báo"); } finally { setSending(false); } };
  return <section className="rounded-2xl border border-slate-200 bg-white p-5"><h1 className="text-lg font-black text-slate-800">Thông báo lao động</h1>{error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}{canManage && <form onSubmit={(event) => void send(event)} className="mt-4 grid gap-2"><input aria-label="Tiêu đề" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tiêu đề" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><textarea aria-label="Nội dung" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Nội dung" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><button type="submit" disabled={sending} className="w-fit rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white">{sending ? "Đang gửi..." : "Gửi thông báo"}</button></form>}<div className="mt-5 grid gap-2">{loading ? <p className="text-sm text-slate-400">Đang tải...</p> : items.length ? items.map((item) => <article key={item._id || item.title} className="rounded-xl bg-slate-50 p-3"><h2 className="font-bold text-slate-700">{item.title || item.subject || "Thông báo"}</h2><p className="text-sm text-slate-500">{item.content || item.message}</p></article>) : <p className="text-sm text-slate-400">Chưa có thông báo.</p>}</div></section>;
}

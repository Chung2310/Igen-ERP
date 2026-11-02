import { useEffect, useRef, useState, type FormEvent } from "react";
import { StyledSelect } from "../../components/common/StyledSelect";
import { apiFetch } from "../shared/lib/apiFetch";
import type { RepairTicket } from "../../services/repairService";

type CareEvent = { _id: string; ticketId: string; type: "message" | "status"; channel?: string; direction?: string; body?: string; fromStatus?: string; toStatus?: string; actorName?: string; createdAt: string };
type CareData = { careCase: { status: string }; events: CareEvent[] };
type History = { tickets: Array<{ _id: string; ticketCode: string; status: string }>; events: CareEvent[] };
const field = "min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary";
const button = "min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";
const labels: Record<string, string> = { open: "Đang xử lý", waiting: "Chờ phản hồi", resolved: "Đã xử lý", phone: "Điện thoại", email: "Email", zalo: "Zalo", in_person: "Tại cửa hàng", internal: "Nội bộ", incoming: "Khách gửi", outgoing: "Nhân viên phản hồi", note: "Ghi chú" };

export default function RepairCarePanel({ ticket }: { ticket: RepairTicket }) {
  const [data, setData] = useState<CareData | null>(null); const [history, setHistory] = useState<History | null>(null);
  const [channel, setChannel] = useState("phone"); const [direction, setDirection] = useState("incoming"); const [body, setBody] = useState("");
  const [status, setStatus] = useState("open"); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  async function load() {
    setLoading(true);
    try {
      const [care, customerHistory] = await Promise.all([
        apiFetch<{ data: CareData }>(`/repair/tickets/${ticket._id}/care`),
        apiFetch<{ data: History }>(`/repair/care/customers/${ticket.customerId}`),
      ]);
      setData(care.data); setHistory(customerHistory.data); setStatus(care.data.careCase.status); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được hội thoại."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [ticket._id, ticket.customerId]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !body.trim()) return;
    const fingerprint = JSON.stringify({ ticketId: ticket._id, channel, direction, body: body.trim() });
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true); setError(""); setMessage("");
    try { await apiFetch(`/repair/tickets/${ticket._id}/care/messages`, { method: "POST", body: JSON.stringify({ channel, direction, body: body.trim(), idempotencyKey: attempt.current.key }) }); attempt.current = null; setBody(""); setMessage("Đã ghi nhận tương tác."); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không ghi được tương tác."); }
    finally { setBusy(false); }
  }
  async function saveStatus() {
    setBusy(true); setError(""); setMessage("");
    try { await apiFetch(`/repair/tickets/${ticket._id}/care/status`, { method: "POST", body: JSON.stringify({ status, idempotencyKey: crypto.randomUUID() }) }); setMessage("Đã cập nhật trạng thái CSKH."); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không cập nhật được trạng thái."); }
    finally { setBusy(false); }
  }
  return <section className="mt-4 space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-on-surface" aria-label="Chăm sóc khách hàng">
    <div><h3 className="text-balance text-base font-semibold">Chăm sóc khách hàng</h3><p className="text-pretty text-sm text-on-surface-variant">Ghi lại trao đổi theo phiếu sửa và lịch sử của khách. Mục này không tự gửi tin.</p></div>
    {loading && <p role="status" className="text-sm text-on-surface-variant">Đang tải hội thoại...</p>}
    {error && <p role="alert" className="text-sm text-error">{error}</p>}{message && <p role="status" className="text-sm">{message}</p>}
    <div className="flex flex-wrap items-end gap-2"><label className="min-w-40 text-sm">Trạng thái<StyledSelect appearance="erp" ariaLabel="Trạng thái" value={status} onChange={setStatus} options={[{ value: "open", label: "Đang xử lý" }, { value: "waiting", label: "Chờ phản hồi" }, { value: "resolved", label: "Đã xử lý" }]} className={field} /></label><button type="button" className={button} disabled={busy || status === data?.careCase.status} title={status === data?.careCase.status ? "Trạng thái chưa thay đổi" : undefined} onClick={() => void saveStatus()}>Lưu trạng thái</button></div>
    <form className="space-y-3" onSubmit={(event) => void submit(event)}><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Kênh<StyledSelect appearance="erp" ariaLabel="Kênh" value={channel} onChange={setChannel} options={[{ value: "phone", label: "Điện thoại" }, { value: "email", label: "Email" }, { value: "zalo", label: "Zalo (ghi nhận)" }, { value: "in_person", label: "Tại cửa hàng" }, { value: "internal", label: "Nội bộ" }]} className={field} /></label><label className="text-sm">Loại tương tác<StyledSelect appearance="erp" ariaLabel="Loại tương tác" value={direction} onChange={setDirection} options={[{ value: "incoming", label: "Khách gửi" }, { value: "outgoing", label: "Nhân viên phản hồi" }, { value: "note", label: "Ghi chú" }]} className={field} /></label></div><label className="block text-sm">Nội dung<textarea className={`${field} min-h-24 py-2`} maxLength={5000} required value={body} onChange={(event) => setBody(event.target.value)} /></label><button className={button} disabled={busy || !body.trim()}>Ghi tương tác</button></form>
    <div><h4 className="text-balance text-sm font-semibold">Lịch sử phiếu này</h4>{data?.events.length ? <ol className="mt-2 space-y-2">{data.events.map((item) => <li key={item._id} className="rounded-lg border border-outline-variant p-3 text-sm"><p className="text-on-surface-variant">{new Date(item.createdAt).toLocaleString("vi-VN")} · {item.actorName || "Nhân viên"} · {item.type === "status" ? `${labels[item.fromStatus || ""] || item.fromStatus} → ${labels[item.toStatus || ""] || item.toStatus}` : `${labels[item.channel || ""] || item.channel} / ${labels[item.direction || ""] || item.direction}`}</p>{item.body && <p className="mt-1 whitespace-pre-wrap text-pretty">{item.body}</p>}</li>)}</ol> : <p className="mt-2 text-sm text-on-surface-variant">Chưa có tương tác. Ghi lại cuộc trao đổi đầu tiên ở trên.</p>}</div>
    {!!history?.tickets.length && <details className="text-sm"><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-primary">Lịch sử khách hàng ({history.tickets.length} phiếu)</summary><ul className="mt-2 space-y-1">{history.tickets.map((item) => <li key={item._id}>{item.ticketCode} · {item.status} · {history.events.filter((entry) => entry.ticketId === item._id).length} tương tác</li>)}</ul></details>}
  </section>;
}

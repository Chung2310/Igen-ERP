import React, { useEffect, useState } from "react";
import { authService } from "../../services/authService";
import { repairExtras, repairService, type RepairNotification, type RepairPart, type RepairRatingCriteria, type RepairTicket } from "../../services/repairService";

const money = (value: number) => Number(value || 0).toLocaleString("vi-VN");
const date = (value?: string) => (value ? new Date(value).toLocaleString("vi-VN") : "—");
const BILLING_LABEL: Record<string, string> = { customer: "Khách trả", warranty_shop: "Bảo hành cửa hàng", warranty_supplier: "Bảo hành NCC" };
const NOTIFY_LABEL: Record<string, string> = { received: "Tiếp nhận", done: "Sửa xong" };
const NOTIFY_STATUS: Record<string, string> = { sent: "Đã gửi", failed: "Lỗi", skipped: "Bỏ qua" };
const CRITERIA: Array<{ key: keyof RepairRatingCriteria; label: string }> = [{ key: "skill", label: "Tay nghề" }, { key: "attitude", label: "Thái độ" }, { key: "speed", label: "Tốc độ" }];

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="mt-4 rounded-lg border p-3 text-sm"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><b>{title}</b>{action}</div><div className="mt-2">{children}</div></div>;
}

/** Phân công kỹ thuật viên: chọn trong tài khoản cùng công ty. */
function TechnicianPicker({ ticket, onChanged }: { ticket: RepairTicket; onChanged: () => void }) {
  const [people, setPeople] = useState<Array<{ uid: string; displayName?: string; email?: string }>>([]);
  const [value, setValue] = useState(ticket.technicianId || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void authService.getColleagues().then((items) => setPeople(items as any)).catch(() => setPeople([])); }, []);
  const save = async () => {
    setBusy(true); setError("");
    try { await repairExtras.assignTechnician(ticket._id, value); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể phân công kỹ thuật viên."); }
    finally { setBusy(false); }
  };
  return <Section title="Kỹ thuật viên phụ trách">
    <div className="flex flex-wrap items-center gap-2">
      <select value={value} onChange={(e) => setValue(e.target.value)} className="rounded border px-3 py-2 text-sm">
        <option value="">— Chưa phân công —</option>
        {people.map((person) => <option key={person.uid} value={person.uid}>{person.displayName || person.email}</option>)}
      </select>
      <button type="button" disabled={busy || !value || value === ticket.technicianId} onClick={() => void save()} className="min-h-11 rounded bg-cyan-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Lưu phân công</button>
      {ticket.technicianName && <span className="text-xs text-slate-500">Đang phụ trách: <b>{ticket.technicianName}</b> · {date(ticket.assignedAt)}</span>}
    </div>
    {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
  </Section>;
}

function PartsSection({ ticket }: { ticket: RepairTicket }) {
  const [parts, setParts] = useState<RepairPart[]>([]);
  useEffect(() => { void repairService.parts(ticket._id).then((items) => setParts(items as RepairPart[])).catch(() => setParts([])); }, [ticket._id]);
  if (!parts.length) return <Section title="Linh kiện đã xuất"><p className="text-xs text-slate-500">Chưa xuất linh kiện nào cho phiếu này.</p></Section>;
  return <Section title="Linh kiện đã xuất">
    <div className="overflow-x-auto"><table className="w-full text-xs">
      <thead><tr className="text-left text-slate-500"><th className="py-1">Linh kiện</th><th>SL</th><th>Diện chi phí</th><th className="text-right">Khách trả</th><th>Trạng thái</th></tr></thead>
      <tbody>{parts.map((part) => <tr key={part._id} className="border-t">
        <td className="py-1"><b>{part.productName}</b><div className="text-slate-400">{part.sku}</div></td>
        <td>{part.quantity}</td>
        <td><span className={`rounded px-2 py-0.5 ${part.chargeable ? "bg-slate-100" : "bg-emerald-50 text-emerald-700"}`}>{BILLING_LABEL[part.billing] || part.billing}</span></td>
        <td className="text-right">{part.chargeable ? money(part.lineTotal) : "0"}</td>
        <td>{part.status === "issued" ? "Đã xuất" : part.status === "returned" ? "Đã hoàn" : "Đã huỷ"}</td>
      </tr>)}</tbody>
    </table></div>
  </Section>;
}

function NotificationsSection({ ticket }: { ticket: RepairTicket }) {
  const [rows, setRows] = useState<RepairNotification[]>([]);
  const [busy, setBusy] = useState("");
  const load = () => repairExtras.notifications(ticket._id).then(setRows).catch(() => setRows([]));
  useEffect(() => { void load(); }, [ticket._id]);
  const resend = async (event: "received" | "done") => {
    setBusy(event);
    try { const result = await repairExtras.resendNotification(ticket._id, event); if (result.status !== "sent") window.alert(`Không gửi được: ${result.reason || result.status}`); await load(); }
    catch (e) { window.alert(e instanceof Error ? e.message : "Không gửi lại được thông báo."); }
    finally { setBusy(""); }
  };
  return <Section title="Thông báo đã gửi khách" action={<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
    <button type="button" disabled={busy === "received"} onClick={() => void resend("received")} className="min-h-11 w-full rounded border px-2 py-1 text-xs sm:w-auto">Gửi lại tin tiếp nhận</button>
    <button type="button" disabled={busy === "done" || !["done", "delivered"].includes(ticket.status)} onClick={() => void resend("done")} className="min-h-11 w-full rounded border px-2 py-1 text-xs disabled:opacity-50 sm:w-auto">Gửi lại tin sửa xong</button>
  </div>}>
    {rows.length ? rows.map((row) => <p key={row._id} className="text-xs text-slate-600">{date(row.sentAt)} · {NOTIFY_LABEL[row.event] || row.event} · {row.channel || "—"} → {row.recipient || "—"} · <b>{NOTIFY_STATUS[row.status]}</b>{row.reason ? ` (${row.reason})` : ""}</p>)
      : <p className="text-xs text-slate-500">Chưa gửi thông báo nào.</p>}
  </Section>;
}

/** Chấm điểm tại quầy khi khách nhận máy. Mỗi phiếu chỉ nhận một đánh giá. */
function RatingSection({ ticket }: { ticket: RepairTicket }) {
  const [rating, setRating] = useState(5);
  const [criteria, setCriteria] = useState<RepairRatingCriteria>({});
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  if (!["done", "delivered"].includes(ticket.status)) return null;
  const submit = async () => {
    setState("busy"); setError("");
    try { await repairExtras.rate(ticket._id, { rating, comment, criteria }); setState("done"); }
    catch (e) { setError(e instanceof Error ? e.message : "Không lưu được đánh giá."); setState("idle"); }
  };
  return <Section title="Chấm điểm kỹ thuật (tại quầy)">
    {state === "done" ? <p className="text-xs text-emerald-700">Đã ghi nhận đánh giá. Cảm ơn quý khách.</p> : <>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs">Điểm tổng
          <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="rounded border px-2 py-1">{[5, 4, 3, 2, 1].map((score) => <option key={score} value={score}>{score} sao</option>)}</select>
        </label>
        {CRITERIA.map((item) => <label key={item.key} className="flex items-center gap-2 text-xs">{item.label}
          <select value={criteria[item.key] ?? ""} onChange={(e) => setCriteria({ ...criteria, [item.key]: e.target.value ? Number(e.target.value) : undefined })} className="rounded border px-2 py-1">
            <option value="">—</option>{[5, 4, 3, 2, 1].map((score) => <option key={score} value={score}>{score}</option>)}
          </select>
        </label>)}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Nhận xét của khách (tuỳ chọn)" className="mt-2 min-h-16 w-full resize-y rounded-lg border px-3 py-2 text-sm" />
      <button type="button" disabled={state === "busy"} onClick={() => void submit()} className="mt-2 rounded bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Lưu đánh giá</button>
      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
    </>}
  </Section>;
}

export default function RepairTicketExtras({ ticket, onChanged }: { ticket: RepairTicket; onChanged: () => void }) {
  return <>
    <TechnicianPicker ticket={ticket} onChanged={onChanged} />
    <PartsSection ticket={ticket} />
    <RatingSection ticket={ticket} />
    <NotificationsSection ticket={ticket} />
  </>;
}

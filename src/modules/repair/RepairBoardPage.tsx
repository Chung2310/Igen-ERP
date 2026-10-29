import React, { useEffect, useRef, useState } from "react";
import { authService } from "../../services/authService";
import { repairService, type RepairStatus, type RepairTicket } from "../../services/repairService";
import RepairTicketExtras from "./RepairTicketExtras";
import GeneralRepairIntakeDialog, { RepairIntakeAction } from './GeneralRepairIntakeDialog';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { cn } from '../student-management/lib/utils';
import RepairBoardView from './RepairBoardView';
import { repairSubjectLabel } from './repairPresentation';

const nextStatus: Partial<Record<RepairStatus, RepairStatus>> = { received: "diagnosing", diagnosing: "quoted", approved: "repairing", repairing: "done", waiting_parts: "repairing", waiting_supplier: "repairing", done: "delivered" };
const repairStatusLabels: Record<RepairStatus, string> = { received: "Tiếp nhận", diagnosing: "Kiểm tra", quoted: "Báo giá", approved: "Đã duyệt", repairing: "Đang thực hiện", waiting_parts: "Chờ vật tư", waiting_supplier: "Chờ nhà cung cấp", done: "Hoàn tất", delivered: "Đã giao", cancelled: "Đã hủy", returned: "Đã trả" };
const money = (value: number) => Number(value || 0).toLocaleString("vi-VN");
const date = (value?: string) => value ? new Date(value).toLocaleString("vi-VN") : "—";
const repairStatusLabel = (status?: string) => status && status in repairStatusLabels ? repairStatusLabels[status as RepairStatus] : "Chưa tiếp nhận";
const COST_BEARER_LABEL: Record<string, string> = { customer: "Dịch vụ (khách trả phí)", shop: "Bảo hành doanh nghiệp", supplier: "Bảo hành nhà cung cấp" };
const COST_BEARER_BADGE_CLASS: Record<string, string> = { customer: "bg-amber-50 text-amber-700", shop: "bg-emerald-50 text-emerald-700", supplier: "bg-sky-50 text-sky-700" };
const costBearerLabel = (costBearer?: string) => (costBearer && COST_BEARER_LABEL[costBearer]) || "Sửa chữa (khách trả phí)";
const costBearerBadgeClass = (costBearer?: string) => (costBearer && COST_BEARER_BADGE_CLASS[costBearer]) || COST_BEARER_BADGE_CLASS.customer;

function TicketCard({ ticket, busy, onSelect, onAdvance }: { ticket: RepairTicket; busy: boolean; onSelect: () => void; onAdvance: () => void }) {
  return <article className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-3.5 shadow-xs hover:border-primary">
    <button type="button" onClick={onSelect} aria-label={`Xem phiếu ${ticket.ticketCode}`} className="block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-primary">
      <span className="flex flex-wrap items-center justify-between gap-1.5"><span className={cn("rounded-md border border-current/10 px-2 py-1 text-xs font-semibold", costBearerBadgeClass(ticket.coverage.costBearer))}>{costBearerLabel(ticket.coverage.costBearer)}</span>{ticket.coverage.customer.covered && <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">Còn bảo hành</span>}</span>
      <span className="mt-3 flex items-center justify-between gap-2"><span className="text-xs font-semibold text-primary">{ticket.ticketCode}</span>{ticket.device.serialNumber && <span title={ticket.device.serialNumber} className="max-w-32 truncate font-mono text-xs text-on-surface-variant">{ticket.device.serialNumber}</span>}</span>
      {['approved', 'repairing', 'waiting_parts', 'waiting_supplier'].includes(ticket.status) && <span className="mt-1 inline-block rounded-md bg-surface-container px-2 py-0.5 text-xs text-on-surface-variant">{repairStatusLabel(ticket.status)}</span>}
      <span className="mt-2 block text-xs text-on-surface-variant">{repairSubjectLabel(ticket)}</span>
      <span className="mt-1 block truncate text-sm font-semibold" title={ticket.device.name}>{ticket.device.name}</span>
      {ticket.symptom && <span className="mt-1 block truncate text-xs text-on-surface-variant" title={ticket.symptom}>Yêu cầu: {ticket.symptom}</span>}
      <span className="mt-3 flex items-center justify-between gap-2 border-t border-outline-variant pt-2 text-xs"><span className="min-w-0 flex-1 truncate font-medium" title={ticket.customerName}>{ticket.customerName}</span><span className="max-w-32 truncate text-right text-on-surface-variant" title={ticket.technicianName || "Chưa phân công kỹ thuật viên"}>{ticket.technicianName ? `KT: ${ticket.technicianName}` : "Chưa phân công"}</span></span>
      <span className="mt-2 flex items-center justify-between gap-2 border-t border-outline-variant pt-2 text-xs tabular-nums"><span className="text-on-surface-variant">Tổng: <strong className="font-semibold text-on-surface">{money(ticket.totalAmount)} ₫</strong></span><span className={ticket.dueAmount > 0 ? "font-semibold text-error" : "font-medium text-primary"}>{ticket.dueAmount > 0 ? `Nợ: ${money(ticket.dueAmount)} ₫` : "Đã thanh toán"}</span></span>
    </button>
    {(nextStatus[ticket.status] || ticket.status === "quoted") && <button type="button" disabled={busy} onClick={onAdvance} className="mt-3 min-h-11 w-full rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-50">{ticket.status === "quoted" ? "Duyệt báo giá" : ticket.status === "done" ? ticket.dueAmount > 0 ? "Thu tiền để bàn giao" : "Bàn giao" : "Chuyển bước tiếp"}</button>}
  </article>;
}

function ReceiveTechnicianModal({ ticket, onClose, onSubmit }: { ticket: RepairTicket; onClose: () => void; onSubmit: (technicianId: string) => Promise<void> }) {
  const [people, setPeople] = useState<Array<{ uid: string; displayName?: string; email?: string }>>([]);
  const [technicianId, setTechnicianId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void authService.getColleagues().then((items) => setPeople(items)).catch((e) => setError(e instanceof Error ? e.message : "Không thể tải danh sách kỹ thuật viên.")); }, []);
  const submit = async () => { if (!technicianId) return; setBusy(true); setError(""); try { await onSubmit(technicianId); } catch (e) { setError(e instanceof Error ? e.message : "Không thể cập nhật phiếu."); } finally { setBusy(false); } };
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/40 p-4">
    <div role="dialog" aria-modal="true" aria-labelledby="receive-technician-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
      <h2 id="receive-technician-title" className="text-lg font-bold">Chọn kỹ thuật viên tiếp nhận</h2>
      <p className="mt-1 text-sm text-slate-500">{ticket.ticketCode} sẽ được chuyển sang Kiểm tra.</p>
      <label className="mt-4 flex flex-col gap-1 text-sm font-medium text-slate-700">Kỹ thuật viên tiếp nhận
        <select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} className="rounded-lg border px-3 py-2 font-normal">
          <option value="">— Chọn kỹ thuật viên —</option>
          {people.map((person) => <option key={person.uid} value={person.uid}>{person.displayName || person.email || person.uid}</option>)}
        </select>
      </label>
      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={busy} className="rounded-lg border px-4 py-2">Hủy</button><button type="button" onClick={() => void submit()} disabled={busy || !technicianId} className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Chuyển bước tiếp</button></div>
    </div>
  </div>;
}
export type RepairCreatePrefill = { ticketType?: "service" | "warranty"; intakeSource?: "external" | "company_sale"; productId?: string; serialNumber?: string; productName: string; customerId?: string; customerName?: string; customerPhone?: string; coverage: RepairTicket["coverage"] };

function TicketModal({ ticket, onClose, onChanged, onDetailsChanged }: { ticket: RepairTicket; onClose: () => void; onChanged: () => void; onDetailsChanged?: () => void }) { const [quote, setQuote] = useState(String(ticket.quotedAmount ?? ticket.totalAmount ?? 0)); const [quoteNote, setQuoteNote] = useState(""); const [quoteSaved, setQuoteSaved] = useState(false); const [payment, setPayment] = useState(""); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const quoteSavePending = useRef(false); const run = async (action: () => Promise<unknown>) => { setBusy(true); try { await action(); onChanged(); onClose(); } catch (e) { window.alert(e instanceof Error ? e.message : "Không thể cập nhật phiếu."); } finally { setBusy(false); } }; const saveQuote = async () => { if (quoteSavePending.current || busy || !quoteNote.trim()) return; quoteSavePending.current = true; setBusy(true); setQuoteSaved(false); try { await repairService.quote(ticket._id, Number(quote), quoteNote.trim()); onChanged(); setQuoteSaved(true); } catch (e) { window.alert(e instanceof Error ? e.message : "Không thể cập nhật phiếu."); } finally { quoteSavePending.current = false; setBusy(false); } }; return <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/40 p-3 sm:p-4"><div role="dialog" aria-modal="true" aria-labelledby="repair-ticket-title" className="my-3 max-h-[calc(100vh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:my-6 sm:max-h-[calc(100vh-3rem)] sm:p-5"><div className="flex justify-between gap-3"><div><h2 id="repair-ticket-title" className="text-xl font-bold">{ticket.ticketCode}</h2><span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-semibold ${costBearerBadgeClass(ticket.coverage.costBearer)}`}>{costBearerLabel(ticket.coverage.costBearer)}</span><p className="mt-1 text-xs text-on-surface-variant">{repairSubjectLabel(ticket)}</p><p className="text-sm text-slate-500">{ticket.device.name}{ticket.device.serialNumber ? ` · ${ticket.device.serialNumber}` : ""}</p></div><button onClick={onClose} className="min-h-11 rounded px-3 py-2">Đóng</button></div><div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="rounded-lg bg-slate-50 p-3 text-sm"><b>Khách hàng</b><p>{ticket.customerName} · {ticket.customerPhone}</p><p>Mã: {ticket.customerId}</p><p>Tiếp nhận: {date(ticket.receivedAt)}</p></div><div className="rounded-lg bg-slate-50 p-3 text-sm"><b>Bảo hành</b><p>Khách: {ticket.coverage.customer.covered ? `Còn ${ticket.coverage.customer.daysLeft || 0} ngày` : "Hết hạn"}</p><p>NCC: {ticket.coverage.supplier.covered ? `Còn ${ticket.coverage.supplier.daysLeft || 0} ngày` : "Hết hạn"}</p><p>Bên chịu phí: <span className={`rounded px-2 py-0.5 text-xs font-semibold ${costBearerBadgeClass(ticket.coverage.costBearer)}`}>{costBearerLabel(ticket.coverage.costBearer)}</span></p></div></div><div className="mt-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-sm"><b>Mô tả lỗi / yêu cầu</b><p className="mt-1">{ticket.symptom}</p>{ticket.diagnosis && <><b className="mt-3 block">Chẩn đoán</b><p>{ticket.diagnosis}</p></>}</div><div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-4"><div>Nhân công<br /><b>{money(ticket.laborFee)}</b></div><div>Vật tư<br /><b>{money(ticket.partRevenue ?? 0)}</b></div><div>Tổng<br /><b>{money(ticket.totalAmount)}</b></div><div>Còn nợ<br /><b className="text-rose-600">{money(ticket.dueAmount)}</b></div></div>{ticket.status === "diagnosing" && <div className="mt-4 space-y-2"><label className="flex flex-col gap-1 text-sm"><span>Số tiền báo giá</span><input type="number" min="0" value={quote} onChange={(e) => setQuote(e.target.value)} className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2" /></label><label className="flex flex-col gap-1 text-sm"><span>Ghi chú báo giá</span><textarea required value={quoteNote} onChange={(e) => setQuoteNote(e.target.value)} className="min-h-20 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2" /></label>{quoteSaved && <p role="status" className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">Đã lưu báo giá</p>}<button disabled={busy || quoteSaved || !quoteNote.trim()} onClick={() => void saveQuote()} className="min-h-11 w-full rounded bg-cyan-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">{quoteSavePending.current ? "Đang lưu..." : "Lưu báo giá"}</button></div>}{ticket.status === "done" && ticket.dueAmount > 0 && <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input type="number" min="1" max={ticket.dueAmount} value={payment} onChange={(e) => setPayment(e.target.value)} placeholder="Số tiền thu" className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 sm:w-auto" /><button disabled={busy} onClick={() => void run(() => repairService.pay(ticket._id, Number(payment)))} className="min-h-11 w-full rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white sm:w-auto">Ghi nhận thanh toán</button></div>}<div className="mt-5 flex flex-col gap-2 border-t border-outline-variant pt-4 sm:flex-row sm:flex-wrap">{ticket.status === "done" && <button disabled={busy} onClick={() => void run(() => repairService.deliver(ticket._id))} className="min-h-11 w-full rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white sm:w-auto">Bàn giao</button>}{["received", "diagnosing", "quoted", "approved", "repairing"].includes(ticket.status) && <><input placeholder="Lý do hủy" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 sm:w-auto" /><button disabled={busy || !reason.trim()} onClick={() => void run(() => repairService.cancel(ticket._id, reason))} className="min-h-11 w-full rounded border border-rose-300 px-3 py-2 text-sm text-rose-700 sm:w-auto">Hủy phiếu</button></>}</div><RepairTicketExtras ticket={ticket} onChanged={onDetailsChanged || onChanged} /><div className="mt-5 border-t border-outline-variant pt-4"><h3 className="font-semibold">Lịch sử xử lý</h3>{ticket.statusHistory?.map((entry, index) => <p key={index} className="mt-1 text-xs text-slate-500">{date(entry.at)} · {repairStatusLabel(entry.from)} → {repairStatusLabel(entry.to)} · {entry.byName}{entry.note ? ` · ${entry.note}` : ""}</p>)}</div></div></div>; }

export default function RepairBoardPage({ createPrefill, onCreatePrefillConsumed }: { createPrefill?: RepairCreatePrefill | null; onCreatePrefillConsumed?: () => void } = {}) {
  const { userProfile } = useAuth(); const { activeBranchId } = useBranch();
  if (!userProfile?.companyCode || !activeBranchId) return <p role="status">Chọn doanh nghiệp và chi nhánh để xem phiếu tiếp nhận.</p>;
  return <RepairBoardWorkspace key={`${userProfile.companyCode}:${activeBranchId}`} createPrefill={createPrefill} onCreatePrefillConsumed={onCreatePrefillConsumed} />;
}

function RepairBoardWorkspace({ createPrefill, onCreatePrefillConsumed }: { createPrefill?: RepairCreatePrefill | null; onCreatePrefillConsumed?: () => void }) {
  const [board, setBoard] = useState<Partial<Record<RepairStatus, RepairTicket[]>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<RepairTicket | null>(null);
  const [receivingTicket, setReceivingTicket] = useState<RepairTicket | null>(null);
  const [closedPrefill, setClosedPrefill] = useState<RepairCreatePrefill | null>(null);
  const createOpen = Boolean(createPrefill && createPrefill !== closedPrefill);
  const loadBoard = async (refreshDetails = false) => {
    setLoading(true); setError("");
    try {
      const data = await repairService.board();
      setBoard(data);
      if (refreshDetails) setSelected((current) => current ? Object.values(data).flat().find((item) => item._id === current._id) || current : null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải phiếu sửa chữa."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadBoard(); }, []);
  const moveForward = async (ticket: RepairTicket, technicianId?: string) => {
    setBusyId(ticket._id);
    try {
      const to = nextStatus[ticket.status];
      if (ticket.status === "quoted") await repairService.approveQuote(ticket._id);
      else if (to) await repairService.transition(ticket._id, to, technicianId ? { technicianId } : {});
      await loadBoard();
      setReceivingTicket(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể cập nhật phiếu"); throw e; }
    finally { setBusyId(null); }
  };
  const startMoveForward = (ticket: RepairTicket) => { if (ticket.status === "received") setReceivingTicket(ticket); else if (ticket.status === "diagnosing" || (ticket.status === "done" && ticket.dueAmount > 0)) setSelected(ticket); else void moveForward(ticket).catch(() => undefined); };
  return <>
    <RepairBoardView board={board} loading={loading} error={error} onRetry={() => void loadBoard()} intakeAction={<RepairIntakeAction label="Tạo phiếu tiếp nhận" className="border-orange-600 bg-orange-600 text-white hover:bg-orange-700" onCreated={() => void loadBoard()} />} renderTicket={ticket => <TicketCard ticket={ticket} busy={busyId === ticket._id} onSelect={() => setSelected(ticket)} onAdvance={() => startMoveForward(ticket)} />} onSelect={setSelected} />
    {receivingTicket && <ReceiveTechnicianModal ticket={receivingTicket} onClose={() => setReceivingTicket(null)} onSubmit={(technicianId) => moveForward(receivingTicket, technicianId)} />}
    {selected && <TicketModal ticket={{ ...selected, statusHistory: selected.statusHistory?.map((entry) => ({ ...entry, note: [entry.note, entry.technicianName ? `KT nhận: ${entry.technicianName}` : ""].filter(Boolean).join(" · ") || undefined })) }} onClose={() => setSelected(null)} onChanged={() => void loadBoard()} onDetailsChanged={() => void loadBoard(true)} />}
    {createOpen && createPrefill && <GeneralRepairIntakeDialog prefill={createPrefill} onClose={() => { setClosedPrefill(createPrefill); onCreatePrefillConsumed?.(); }} onCreated={() => { setClosedPrefill(createPrefill); onCreatePrefillConsumed?.(); void loadBoard(); }} />}
  </>;
}

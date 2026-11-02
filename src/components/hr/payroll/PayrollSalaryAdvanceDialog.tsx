import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Printer, X } from "lucide-react";
import { getApiErrorMessage } from "../../../utils/errorMessage";

export type SalaryAdvancePayload = {
  employeeId: string;
  kind: "advance";
  amount: number;
  reason: string;
  advanceDetails: { date: string; method: "transfer" | "cash"; note: string };
};

type Employee = { employeeId: string; employeeName: string };
type Record = SalaryAdvancePayload & { employeeName?: string };
type Props = {
  periodKey: string;
  employees: Employee[];
  record?: Record | null;
  onClose: () => void;
  onSubmit: (payload: SalaryAdvancePayload) => Promise<void>;
};

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);

export function PayrollSalaryAdvanceDialog({ periodKey, employees, record, onClose, onSubmit }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [employeeId, setEmployeeId] = useState(record?.employeeId || employees[0]?.employeeId || "");
  const [amount, setAmount] = useState(record ? String(record.amount) : "");
  const [date, setDate] = useState(record?.advanceDetails?.date || new Date().toLocaleDateString("sv-SE"));
  const [method, setMethod] = useState<"transfer" | "cash">(record?.advanceDetails?.method || "transfer");
  const [reason, setReason] = useState(record?.reason || "");
  const [note, setNote] = useState(record?.advanceDetails?.note || "");
  const [preview, setPreview] = useState(Boolean(record));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const employeeName = record?.employeeName || employees.find((employee) => employee.employeeId === employeeId)?.employeeName || employeeId;
  const numericAmount = Number(amount);
  const valid = Boolean(employeeId && Number.isSafeInteger(numericAmount) && numericAmount > 0 && date && reason.trim());

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    amountRef.current?.focus();
    return () => { if (dialog.open) dialog.close(); trigger?.focus(); };
  }, []);

  const payload = (): SalaryAdvancePayload => ({ employeeId, kind: "advance", amount: numericAmount, reason: reason.trim(), advanceDetails: { date, method, note: note.trim() } });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || busy || record) return;
    setBusy(true); setError("");
    try { await onSubmit(payload()); onClose(); }
    catch (cause) { setError(getApiErrorMessage(cause, "Không thể tạo phiếu tạm ứng. Vui lòng thử lại.")); }
    finally { setBusy(false); }
  };
  const print = () => {
    if (!valid) return;
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu tạm ứng lương</title><style>body{font:16px Arial,sans-serif;max-width:720px;margin:48px auto;padding:0 24px;color:#111}h1{text-align:center;font-size:24px;margin:36px 0 8px}p{line-height:1.6}.meta{text-align:center;color:#444}.row{display:flex;gap:16px;margin:16px 0}.row strong{min-width:180px}.signatures{display:flex;justify-content:space-between;text-align:center;margin-top:80px;font-weight:bold}</style></head><body><h1>PHIẾU TẠM ỨNG LƯƠNG</h1><p class="meta">Kỳ lương ${escapeHtml(periodKey)} · Ngày ${escapeHtml(date)}</p><div class="row"><strong>Người nhận</strong><span>${escapeHtml(employeeName)}</span></div><div class="row"><strong>Mã nhân viên</strong><span>${escapeHtml(employeeId)}</span></div><div class="row"><strong>Số tiền</strong><span>${money(numericAmount)} đ</span></div><div class="row"><strong>Hình thức chi</strong><span>${method === "cash" ? "Tiền mặt" : "Chuyển khoản"}</span></div><div class="row"><strong>Lý do</strong><span>${escapeHtml(reason.trim())}</span></div>${note.trim() ? `<div class="row"><strong>Ghi chú</strong><span>${escapeHtml(note.trim())}</span></div>` : ""}<div class="signatures"><span>Người nhận<br>(Ký, ghi rõ họ tên)</span><span>Kế toán<br>(Ký, ghi rõ họ tên)</span><span>Người duyệt<br>(Ký, ghi rõ họ tên)</span></div><script>window.addEventListener('load',()=>window.print())</script></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    window.open(url, "_blank");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const fieldClass = "mt-1 min-h-11 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60";
  return <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-0 text-on-surface shadow-xl backdrop:bg-inverse-surface/55">
    <div className="flex items-start justify-between gap-3 border-b border-outline-variant p-5"><div><h2 id={titleId} className="text-balance text-lg font-semibold">{record ? "Phiếu tạm ứng lương" : "Tạo phiếu tạm ứng lương"}</h2><p className="mt-1 text-sm text-on-surface-variant">Kỳ lương {periodKey}</p></div><button type="button" aria-label="Đóng" disabled={busy} onClick={onClose} className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary"><X className="size-4" aria-hidden="true" /></button></div>
    <form onSubmit={(event) => void save(event)} className="space-y-4 p-5">
      {!preview ? <>
        <label className="block text-sm font-medium">Nhân viên tạm ứng<select required disabled={busy} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className={fieldClass}>{employees.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.employeeName}</option>)}</select></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">Số tiền tạm ứng (đ)<input ref={amountRef} required type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} className={fieldClass} /></label><label className="block text-sm font-medium">Ngày chi<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} /></label></div>
        <label className="block text-sm font-medium">Hình thức chi<select value={method} onChange={(event) => setMethod(event.target.value as typeof method)} className={fieldClass}><option value="transfer">Chuyển khoản</option><option value="cash">Tiền mặt</option></select></label>
        <label className="block text-sm font-medium">Lý do tạm ứng<textarea required rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} className={`${fieldClass} py-2`} /></label>
        <label className="block text-sm font-medium">Ghi chú (tùy chọn)<input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} className={fieldClass} /></label>
        <p className="rounded-xl bg-surface-container-low p-3 text-pretty text-sm text-on-surface-variant">Phiếu sẽ vào hàng đợi duyệt. Sau khi duyệt và tính lại kỳ lương, số tiền tạm ứng sẽ được khấu trừ vào thực nhận.</p>
      </> : <div className="space-y-2 rounded-xl border border-outline-variant p-4 text-sm"><p><strong>Người nhận:</strong> {employeeName}</p><p><strong>Số tiền:</strong> <span className="tabular-nums">{money(numericAmount)} đ</span></p><p><strong>Ngày chi:</strong> {date}</p><p><strong>Hình thức:</strong> {method === "cash" ? "Tiền mặt" : "Chuyển khoản"}</p><p className="whitespace-pre-wrap"><strong>Lý do:</strong> {reason}</p>{note && <p className="whitespace-pre-wrap"><strong>Ghi chú:</strong> {note}</p>}</div>}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant pt-4"><button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-xl border border-outline px-4 text-sm text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">Đóng</button>{!record && <button type="button" disabled={!valid || busy} onClick={() => setPreview((value) => !value)} className="min-h-11 rounded-xl border border-outline px-4 text-sm text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{preview ? "Sửa thông tin" : "Xem mẫu in"}</button>}{preview && <button type="button" disabled={!valid} onClick={print} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-outline px-4 text-sm text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary"><Printer className="size-4" aria-hidden="true" /> In phiếu</button>}{!record && <button type="submit" disabled={!valid || busy} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{busy ? "Đang lưu..." : "Lưu phiếu"}</button>}</div>
    </form>
  </dialog>;
}

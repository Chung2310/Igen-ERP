import { useState } from "react";
import { X } from "lucide-react";
import { financeManagement } from "../api/financeManagement.api";
import { buttonClass, inputClass, money } from "./ManagementUI";

type ReceiptOption = { _id: string; receiptCode: string; supplierName: string; subtotal: number };

export default function PayableNoteForm({ receipts, onSaved, onClose }: {
  receipts: ReceiptOption[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [receiptId, setReceiptId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [openingPaid, setOpeningPaid] = useState("0");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const receipt = receipts.find(r => r._id === receiptId);
  const paid = Number(openingPaid);
  const validAmount = openingPaid !== "" && Number.isSafeInteger(paid) && paid >= 0 && Boolean(receipt && paid <= receipt.subtotal);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-container p-4" role="dialog" aria-modal="true" aria-labelledby="payable-note-title" onKeyDown={e => { if (e.key === "Escape" && !busy) onClose(); }}>
      <form className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-surface-container-lowest p-5 text-on-surface" onSubmit={async e => {
        e.preventDefault();
        if (busy || !receipt || !validAmount || !dueDate) return;
        setBusy(true); setError("");
        try {
          await financeManagement("/payables", { receiptId, dueDate, openingPaid: paid, note });
          onSaved();
          onClose();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Không tạo được phiếu ghi nợ. Vui lòng thử lại.");
        } finally { setBusy(false); }
      }}>
        <div className="flex items-center justify-between">
          <h2 id="payable-note-title" className="text-lg font-bold">Tạo phiếu ghi nợ</h2>
          <button type="button" aria-label="Đóng" disabled={busy} onClick={onClose}><X size={20} /></button>
        </div>
        <p className="text-sm text-on-surface-variant">Chọn phiếu nhập kho đã xác nhận để ghi nhận khoản phải trả nhà cung cấp.</p>
        <fieldset disabled={busy} className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span>Phiếu nhập kho</span>
            <select autoFocus required className={inputClass} value={receiptId} onChange={e => { setReceiptId(e.target.value); setOpeningPaid("0"); }}>
              <option value="">Chọn phiếu nhập kho</option>
              {receipts.map(r => <option key={r._id} value={r._id}>{r.receiptCode} · {r.supplierName} · {money(r.subtotal)}</option>)}
            </select>
          </label>
          {receipt && <div className="space-y-2 rounded-xl border border-outline-variant bg-surface-container-low p-3 text-sm">
            <div className="flex justify-between gap-3"><span>Nhà cung cấp</span><strong>{receipt.supplierName}</strong></div>
            <div className="flex justify-between gap-3"><span>Giá trị phiếu nhập</span><strong>{money(receipt.subtotal)}</strong></div>
            <div className="flex justify-between gap-3"><span>Số tiền ghi nợ</span><strong className="text-on-primary-container">{validAmount ? money(receipt.subtotal - paid) : "Kiểm tra số tiền đã trả"}</strong></div>
          </div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm"><span>Hạn trả</span><input required className={inputClass} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
            <label className="space-y-1 text-sm"><span>Đã thanh toán trước đó (VND)</span><input required className={inputClass} type="number" min={0} max={receipt?.subtotal} step={1} value={openingPaid} onChange={e => setOpeningPaid(e.target.value)} /></label>
          </div>
          <label className="block space-y-1 text-sm"><span>Ghi chú</span><textarea className={inputClass} maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label>
        </fieldset>
        <p className="text-xs text-on-surface-variant">Hạn trả và số đã thanh toán được lưu trên phiếu ghi nợ tại Tài chính. Số đã thanh toán trước đó không tạo thêm phiếu chi.</p>
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        <button disabled={busy || !receipt || !validAmount || !dueDate} className={buttonClass}>{busy ? "Đang lưu…" : "Lưu phiếu ghi nợ"}</button>
      </form>
    </div>
  );
}

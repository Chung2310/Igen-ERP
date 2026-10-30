import { useState } from "react";
import { toast } from "../../../pages/Toast";
import type { OutboundTicket } from "./printOutboundVoucher";

export function OutboundReversalControl({ ticket, onReverse }: { ticket: OutboundTicket; onReverse?: (id: string, reason: string) => Promise<{ _id: string }> }) {
  const [open, setOpen] = useState(false), [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false), [reversalId, setReversalId] = useState(ticket.reversalId || "");
  const internal = ticket.purpose === "nội bộ";
  if (reversalId) return <p className="text-sm text-emerald-800">Đã đảo toàn bộ phiếu. Chứng từ hoàn kho: <span className="font-mono">{reversalId}</span>. Có thể lập phiếu xuất mới nếu cần sửa nội dung.</p>;
  if (!onReverse || !["Hoàn thành", "Thành công"].includes(ticket.status || "") || ticket.refType || ticket.refId || ticket.purpose === "chuyển kho") return null;
  return <div className="space-y-2 text-sm">
    {!open ? <button type="button" className="rounded-lg border border-rose-300 px-3 py-2 text-rose-800" onClick={() => setOpen(true)}>{internal ? "Thu hồi toàn bộ hàng nội bộ" : "Đảo phiếu xuất"}</button> : <form onSubmit={async (event) => {
      event.preventDefault();
      if (busy || !reason.trim()) return;
      setBusy(true);
      try { const result = await onReverse(ticket.id, reason.trim()); setReversalId(result._id); toast.success("Đã hoàn hàng theo phiếu gốc và lưu chứng từ đảo."); }
      catch (error: any) { toast.error(error.message || "Không thể đảo phiếu."); }
      finally { setBusy(false); }
    }} className="space-y-2">
      <p>Hoàn toàn bộ hàng về kho gốc theo giá vốn xuất. Chỉ xác nhận khi hàng thực tế đã được trả lại. Phiếu gốc được giữ để đối chiếu; máy có nghiệp vụ tiếp theo sẽ bị từ chối.</p>
      {internal && <p>Người/phòng ban nhận: {ticket.customerName}. Chỉ thu hồi nguyên phiếu khi đã nhận đủ hàng và máy còn sử dụng được; máy hỏng hoặc thất lạc cần đối soát riêng.</p>}
      <label className="block">Lý do đảo phiếu<textarea required maxLength={2000} disabled={busy} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label>
      <div className="flex gap-2"><button type="submit" disabled={busy || !reason.trim()} className="rounded-lg bg-rose-700 px-3 py-2 text-white disabled:opacity-50">{busy ? "Đang hoàn kho…" : "Xác nhận đảo toàn bộ"}</button><button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2">Đóng</button></div>
    </form>}
  </div>;
}

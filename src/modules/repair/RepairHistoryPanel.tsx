import React, { useState } from "react";
import { repairExtras } from "../../services/repairService";

const money = (value: number) => Number(value || 0).toLocaleString("vi-VN");
const date = (value?: string) => (value ? new Date(value).toLocaleString("vi-VN") : "—");
const STATUS_LABEL: Record<string, string> = { received: "Tiếp nhận", diagnosing: "Kiểm tra", quoted: "Báo giá", approved: "Đã duyệt", repairing: "Đang sửa", waiting_parts: "Chờ linh kiện", waiting_supplier: "Chờ NCC", done: "Xong", delivered: "Đã giao", cancelled: "Đã huỷ", returned: "Trả máy" };

function TicketRow({ ticket }: { ticket: any }) {
  return <tr className="border-t align-top">
    <td className="py-2"><b className="text-cyan-700">{ticket.ticketCode}</b><div className="text-xs text-slate-500">{date(ticket.receivedAt)}</div></td>
    <td className="text-xs">{ticket.device?.name}<div className="text-slate-400">{ticket.device?.imei || ticket.device?.serialNumber || "—"}</div></td>
    <td className="text-xs">{ticket.symptom}</td>
    <td className="text-xs">{ticket.coverage?.costBearer === "customer" ? "Khách trả phí" : "Bảo hành"}</td>
    <td className="text-xs">{ticket.technicianName || "—"}</td>
    <td className="text-right text-xs">{money(ticket.totalAmount)}</td>
    <td className="text-xs">{STATUS_LABEL[ticket.status] || ticket.status}</td>
  </tr>;
}

function TicketTable({ tickets }: { tickets: any[] }) {
  if (!tickets?.length) return <p className="text-sm text-slate-500">Chưa có lần sửa chữa/bảo hành nào.</p>;
  return <div className="overflow-x-auto"><table className="w-full text-sm">
    <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Phiếu</th><th>Thiết bị</th><th>Lỗi</th><th>Diện</th><th>Kỹ thuật</th><th className="text-right">Tổng tiền</th><th>Trạng thái</th></tr></thead>
    <tbody>{tickets.map((ticket) => <TicketRow key={ticket._id} ticket={ticket} />)}</tbody>
  </table></div>;
}

export default function RepairHistoryPanel() {
  const [mode, setMode] = useState<"imei" | "phone">("imei");
  const [keyword, setKeyword] = useState("");
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!keyword.trim()) return;
    setBusy(true); setError(""); setResult(null);
    try { setResult(mode === "imei" ? await repairExtras.historyByImei(keyword.trim()) : await repairExtras.historyByPhone(keyword.trim())); }
    catch (e) { setError(e instanceof Error ? e.message : "Không tra cứu được lịch sử."); }
    finally { setBusy(false); }
  };

  const warranty = result?.warranty;
  return <div className="space-y-4">
    <div>
      <h1 className="text-2xl font-bold">Lịch sử sửa chữa & bảo hành</h1>
      <p className="text-sm text-slate-500">Tra theo IMEI/serial của máy hoặc theo số điện thoại khách hàng.</p>
    </div>

    <form onSubmit={search} className="flex flex-wrap items-center gap-2">
      <select value={mode} onChange={(e) => { setMode(e.target.value as "imei" | "phone"); setResult(null); }} className="rounded-lg border px-3 py-2 text-sm">
        <option value="imei">Theo IMEI / Serial</option>
        <option value="phone">Theo số điện thoại</option>
      </select>
      <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={mode === "imei" ? "Nhập hoặc quét IMEI/serial" : "Nhập số điện thoại khách"} className="min-w-64 flex-1 rounded-lg border px-3 py-2 text-sm" />
      <button disabled={busy} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Đang tra..." : "Tra cứu"}</button>
    </form>

    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

    {result?.kind === "device" && <div className="space-y-3">
      <div className="rounded-xl border p-4 text-sm">
        <b>Nguồn gốc máy · {result.imei}</b>
        {warranty?.found ? <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <div>Sản phẩm<br /><b>{warranty.product?.name || "—"}</b></div>
          <div>Bán ngày<br /><b>{warranty.sold?.at ? date(warranty.sold.at) : "—"}</b></div>
          <div>Khách mua<br /><b>{warranty.sold?.customerName || "—"}</b></div>
          <div>Bảo hành khách<br /><b>{warranty.customerWarranty?.covered ? `Còn ${warranty.customerWarranty.daysLeft || 0} ngày` : "Hết hạn"}</b></div>
          <div>Bảo hành NCC<br /><b>{warranty.supplierWarranty?.covered ? `Còn ${warranty.supplierWarranty.daysLeft || 0} ngày` : "Hết hạn"}</b></div>
          <div>Bên chịu phí<br /><b>{warranty.costBearer || "—"}</b></div>
        </div> : <p className="mt-2 text-slate-500">Máy không do cửa hàng bán ra — chỉ có lịch sử sửa chữa bên dưới.</p>}
      </div>
      <div className="rounded-xl border p-4"><b className="text-sm">Đã vào xưởng {result.ticketCount} lần</b><div className="mt-2"><TicketTable tickets={result.tickets} /></div></div>
    </div>}

    {result?.kind === "customer" && <div className="space-y-3">
      <div className="rounded-xl border p-4 text-sm"><b>{result.customerName || "Khách hàng"} · {result.phone}</b><p className="text-slate-500">{result.devices.length} thiết bị · {result.ticketCount} phiếu</p></div>
      {result.devices.map((device: any, index: number) => <div key={`${device.imei || device.deviceName}-${index}`} className="rounded-xl border p-4">
        <b className="text-sm">{device.deviceName} · {device.imei || "Không có IMEI"}</b>
        <p className="text-xs text-slate-500">{device.ticketCount} lần sửa · gần nhất {date(device.lastReceivedAt)}</p>
        <div className="mt-2"><TicketTable tickets={device.tickets} /></div>
      </div>)}
      {!result.devices.length && <p className="text-sm text-slate-500">Số điện thoại này chưa có phiếu sửa chữa nào.</p>}
    </div>}
  </div>;
}

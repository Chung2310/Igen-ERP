import React, { useEffect, useState } from "react";
import { repairExtras, type RepairRevenueRow, type RepairTechnicianRow } from "../../services/repairService";
import { toast } from "../../pages/Toast";

const money = (value?: number) => Number(value || 0).toLocaleString("vi-VN");
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${new Date().toISOString().slice(0, 7)}-01`;
const GROUP_LABEL: Record<string, string> = { branch: "Chi nhánh", technician: "Kỹ thuật viên", day: "Ngày" };

function Card({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3"><p className="text-xs text-slate-500">{label}</p><p className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</p></div>;
}

export default function RepairReportsPanel() {
  const [range, setRange] = useState({ from: monthStart(), to: today() });
  const [groupBy, setGroupBy] = useState<"branch" | "technician" | "day">("branch");
  const [revenue, setRevenue] = useState<{ items: RepairRevenueRow[]; total: RepairRevenueRow; refunds?: { amount: number; laborAmount: number; count: number; netRevenue: number } } | null>(null);
  const [technicians, setTechnicians] = useState<RepairTechnicianRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setBusy(true); setError('');
    try {
      const [revenueReport, technicianReport] = await Promise.all([
        repairExtras.revenueReport({ ...range, groupBy }),
        repairExtras.technicianReport(range),
      ]);
      setRevenue(revenueReport);
      setTechnicians(technicianReport);
    } catch (e) { const message = e instanceof Error ? e.message : "Không tải được báo cáo."; setError(message); toast.error(message); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [groupBy]);

  // Cột giá vốn/lãi chỉ có khi tài khoản được cấp repair:cost:read — server đã lược bỏ sẵn.
  const showCost = Boolean(revenue?.items?.some((row) => row.grossProfit !== undefined));

  return <div className="space-y-4">
    <div>
      <h1 className="text-balance text-xl font-semibold">Báo cáo sửa chữa & bảo hành</h1>
      <p className="mt-1 text-pretty text-sm text-on-surface-variant">Doanh thu và hiệu suất xử lý sản phẩm, thiết bị và hạng mục dịch vụ trong kỳ.</p>
    </div>

    <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="grid items-end gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="flex min-w-0 flex-col gap-2 text-xs">Từ ngày<input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="min-h-11 w-full min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary" /></label>
      <label className="flex min-w-0 flex-col gap-2 text-xs">Đến ngày<input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="min-h-11 w-full min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary" /></label>
      <label className="flex min-w-0 flex-col gap-2 text-xs">Nhóm theo<select value={groupBy} onChange={(e) => setGroupBy(e.target.value as typeof groupBy)} className="min-h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary">{Object.entries(GROUP_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{busy ? "Đang tải..." : "Xem báo cáo"}</button>
    </form>
    {busy && <p role="status" className="text-pretty text-sm text-on-surface-variant">Đang tải báo cáo sửa chữa và bảo hành…</p>}
    {error && <p role="alert" className="rounded-xl border border-error bg-error-container p-3 text-pretty text-sm text-on-error-container">{error} Bấm Xem báo cáo để thử lại.</p>}

    {revenue && <>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card label="Số phiếu" value={String(revenue.total.ticketCount)} />
        <Card label="Trong đó bảo hành" value={String(revenue.total.warrantyTicketCount)} />
        <Card label="Doanh thu tiền công" value={money(revenue.total.laborRevenue)} />
        <Card label="Doanh thu vật tư" value={money(revenue.total.partRevenue)} />
        <Card label="Tổng doanh thu" value={money(revenue.total.revenue)} />
        <Card label="Còn nợ" value={money(revenue.total.outstanding)} tone="text-rose-600" />
      </div>

      {revenue.refunds && <section aria-label="Hoàn tiền trong kỳ" className="space-y-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-on-surface"><div className="grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-on-surface-variant">Đã hoàn trong kỳ</p><p className="mt-1 font-semibold tabular-nums">{money(revenue.refunds.amount)} ₫</p></div><div><p className="text-xs text-on-surface-variant">Trong đó tiền công</p><p className="mt-1 font-semibold tabular-nums">{money(revenue.refunds.laborAmount)} ₫</p></div><div><p className="text-xs text-on-surface-variant">Doanh thu sau hoàn</p><p className="mt-1 font-semibold tabular-nums">{money(revenue.refunds.netRevenue)} ₫</p></div></div><p className="text-pretty text-xs text-on-surface-variant">Khoản hoàn tính theo ngày phiếu chi đã ghi sổ; doanh thu gốc giữ theo ngày hoàn tất dịch vụ. Không trừ lại khoản hoàn vào công nợ.</p></section>}
      <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest">
        <table className="w-full min-w-[960px] text-sm tabular-nums [&_th]:px-3 [&_th]:py-3 [&_th]:font-medium [&_td]:px-3 [&_td]:py-3">
          <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>
            <th className="px-3 py-2">{GROUP_LABEL[groupBy]}</th><th>Phiếu</th><th>Bảo hành</th>
            <th className="text-right">Tiền công</th><th className="text-right">Vật tư</th><th className="text-right">Doanh thu</th>
            <th className="text-right">Đã thu</th><th className="text-right">Còn nợ</th>
            {showCost && <><th className="text-right">Giá vốn vật tư</th><th className="text-right">Chi phí BH</th><th className="text-right">Lãi gộp</th></>}
          </tr></thead>
          <tbody>{revenue.items.map((row) => <tr key={row.key} className="border-t border-outline-variant">
            <td className="px-3 py-2">{row.technicianName || row.key || "—"}</td>
            <td>{row.ticketCount}</td><td>{row.warrantyTicketCount}</td>
            <td className="text-right">{money(row.laborRevenue)}</td>
            <td className="text-right">{money(row.partRevenue)}</td>
            <td className="text-right font-semibold">{money(row.revenue)}</td>
            <td className="text-right">{money(row.collected)}</td>
            <td className="text-right text-rose-600">{money(row.outstanding)}</td>
            {showCost && <><td className="text-right">{money(row.partCost)}</td><td className="text-right">{money(row.warrantyPartCost)}</td><td className="text-right font-semibold text-emerald-700">{money(row.grossProfit)}</td></>}
          </tr>)}</tbody>
        </table>
        {!revenue.items.length && <p className="p-4 text-sm text-slate-500">Chưa có phiếu nào hoàn tất trong kỳ đã chọn.</p>}
      </div>
    </>}

    <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest">
      <h2 className="border-b border-outline-variant px-3 py-3 text-balance font-semibold">Hiệu suất kỹ thuật viên</h2>
      <table className="w-full min-w-[960px] text-sm tabular-nums [&_th]:px-3 [&_th]:py-3 [&_th]:font-medium [&_td]:px-3 [&_td]:py-3">
        <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>
          <th className="px-3 py-2">Kỹ thuật viên</th><th>Phiếu</th><th>TG xử lý TB</th><th>Xử lý lại</th><th>Lượt chấm</th><th>Điểm TB</th><th>Tay nghề</th><th>Thái độ</th><th>Tốc độ</th><th className="text-right">Doanh thu</th>
        </tr></thead>
        <tbody>{technicians.map((row) => <tr key={row.technicianId} className="border-t border-outline-variant">
          <td className="px-3 py-2">{row.technicianName || row.technicianId}</td>
          <td>{row.ticketCount}</td>
          <td>{row.averageMinutes >= 60 ? `${Math.round(row.averageMinutes / 6) / 10} giờ` : `${row.averageMinutes} phút`}</td>
          <td>{row.reworkCount} ({row.reworkRate}%)</td>
          <td>{row.ratingCount}</td>
          <td className="font-semibold">{row.averageRating || "—"}</td>
          <td>{row.criteria.skill || "—"}</td><td>{row.criteria.attitude || "—"}</td><td>{row.criteria.speed || "—"}</td>
          <td className="text-right">{money(row.revenue)}</td>
        </tr>)}</tbody>
      </table>
      {!technicians.length && <p className="p-4 text-sm text-slate-500">Chưa có phiếu nào được phân công kỹ thuật viên trong kỳ.</p>}
    </div>
  </div>;
}

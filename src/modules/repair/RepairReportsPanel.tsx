import React, { useEffect, useState } from "react";
import { repairExtras, type RepairRevenueRow, type RepairTechnicianRow } from "../../services/repairService";

const money = (value?: number) => Number(value || 0).toLocaleString("vi-VN");
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${new Date().toISOString().slice(0, 7)}-01`;
const GROUP_LABEL: Record<string, string> = { branch: "Chi nhánh", technician: "Kỹ thuật viên", day: "Ngày" };

function Card({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div className="rounded-xl border p-3"><p className="text-xs text-slate-500">{label}</p><p className={`text-lg font-bold ${tone}`}>{value}</p></div>;
}

export default function RepairReportsPanel() {
  const [range, setRange] = useState({ from: monthStart(), to: today() });
  const [groupBy, setGroupBy] = useState<"branch" | "technician" | "day">("branch");
  const [revenue, setRevenue] = useState<{ items: RepairRevenueRow[]; total: RepairRevenueRow } | null>(null);
  const [technicians, setTechnicians] = useState<RepairTechnicianRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setBusy(true); setError("");
    try {
      const [revenueReport, technicianReport] = await Promise.all([
        repairExtras.revenueReport({ ...range, groupBy }),
        repairExtras.technicianReport(range),
      ]);
      setRevenue(revenueReport);
      setTechnicians(technicianReport);
    } catch (e) { setError(e instanceof Error ? e.message : "Không tải được báo cáo."); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [groupBy]);

  // Cột giá vốn/lãi chỉ có khi tài khoản được cấp repair:cost:read — server đã lược bỏ sẵn.
  const showCost = Boolean(revenue?.items?.some((row) => row.grossProfit !== undefined));

  return <div className="space-y-4">
    <div>
      <h1 className="text-2xl font-bold">Báo cáo sửa chữa & bảo hành</h1>
      <p className="text-sm text-slate-500">Doanh thu phân loại theo chi nhánh và hiệu suất kỹ thuật viên, tính trên phiếu đã sửa xong trong kỳ.</p>
    </div>

    <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">Từ ngày<input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" /></label>
      <label className="flex flex-col gap-1 text-xs">Đến ngày<input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" /></label>
      <label className="flex flex-col gap-1 text-xs">Nhóm theo<select value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)} className="rounded-lg border px-3 py-2 text-sm">{Object.entries(GROUP_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <button disabled={busy} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Đang tải..." : "Xem báo cáo"}</button>
    </form>

    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

    {revenue && <>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card label="Số phiếu" value={String(revenue.total.ticketCount)} />
        <Card label="Trong đó bảo hành" value={String(revenue.total.warrantyTicketCount)} />
        <Card label="Doanh thu công sửa" value={money(revenue.total.laborRevenue)} />
        <Card label="Doanh thu linh kiện" value={money(revenue.total.partRevenue)} />
        <Card label="Tổng doanh thu" value={money(revenue.total.revenue)} />
        <Card label="Còn nợ" value={money(revenue.total.outstanding)} tone="text-rose-600" />
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>
            <th className="px-3 py-2">{GROUP_LABEL[groupBy]}</th><th>Phiếu</th><th>Bảo hành</th>
            <th className="text-right">Công sửa</th><th className="text-right">Linh kiện</th><th className="text-right">Doanh thu</th>
            <th className="text-right">Đã thu</th><th className="text-right">Còn nợ</th>
            {showCost && <><th className="text-right">Giá vốn LK</th><th className="text-right">Chi phí BH</th><th className="text-right">Lãi gộp</th></>}
          </tr></thead>
          <tbody>{revenue.items.map((row) => <tr key={row.key} className="border-t">
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

    <div className="overflow-x-auto rounded-xl border">
      <h2 className="border-b px-3 py-2 font-semibold">Hiệu suất kỹ thuật viên</h2>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>
          <th className="px-3 py-2">Kỹ thuật viên</th><th>Phiếu</th><th>TG sửa TB</th><th>Sửa lại</th><th>Lượt chấm</th><th>Điểm TB</th><th>Tay nghề</th><th>Thái độ</th><th>Tốc độ</th><th className="text-right">Doanh thu</th>
        </tr></thead>
        <tbody>{technicians.map((row) => <tr key={row.technicianId} className="border-t">
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

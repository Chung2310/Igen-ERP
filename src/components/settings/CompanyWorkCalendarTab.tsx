import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "../../pages/Toast";
import { companyWorkCalendarService, type WorkCalendarDay, type WorkCalendarDayType } from "../../services/companyWorkCalendarService";

const TYPE_LABELS: Record<WorkCalendarDayType, string> = {
  holiday: "Ngày nghỉ lễ", substitute_holiday: "Ngày nghỉ bù", working_override: "Ngày làm bù",
};

export default function CompanyWorkCalendarTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [days, setDays] = useState<WorkCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reasonTarget, setReasonTarget] = useState<WorkCalendarDay | null>(null);
  const [reason, setReason] = useState("");
  const [form, setForm] = useState({ date: `${year}-01-01`, name: "", dayType: "holiday" as WorkCalendarDayType });

  const load = useCallback(async () => {
    setLoading(true);
    try { setDays(await companyWorkCalendarService.list(year)); }
    catch (error) { toast.error((error as Error).message); }
    finally { setLoading(false); }
  }, [year]);
  useEffect(() => { void load(); }, [load]);

  const sync = async () => {
    try { setDays(await companyWorkCalendarService.sync(year)); toast.success("Đã đồng bộ lịch nghỉ lễ."); }
    catch (error) { toast.error((error as Error).message); }
  };
  const toggle = async (day: WorkCalendarDay) => {
    if (day.isApplied) { setReason(""); setReasonTarget(day); return; }
    try { await companyWorkCalendarService.update(day._id, { isApplied: true }); await load(); }
    catch (error) { toast.error((error as Error).message); }
  };
  const disable = async () => {
    if (!reasonTarget || !reason.trim()) { toast.error("Vui lòng nhập lý do tắt áp dụng."); return; }
    try { await companyWorkCalendarService.update(reasonTarget._id, { isApplied: false, adminReason: reason.trim() }); setReasonTarget(null); await load(); }
    catch (error) { toast.error((error as Error).message); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try { if (editingId) await companyWorkCalendarService.update(editingId, form); else await companyWorkCalendarService.create(form); setFormOpen(false); setEditingId(null); setForm({ date: `${year}-01-01`, name: "", dayType: "holiday" }); await load(); toast.success(editingId ? "Đã cập nhật ngày." : "Đã thêm ngày vào lịch công ty."); }
    catch (error) { toast.error((error as Error).message); }
  };

  const openCreate = () => { setEditingId(null); setForm({ date: `${year}-01-01`, name: "", dayType: "holiday" }); setFormOpen(true); };
  const openEdit = (day: WorkCalendarDay) => { setEditingId(day._id); setForm({ date: day.date, name: day.name, dayType: day.dayType }); setFormOpen(true); };

  return <div className="space-y-4 text-left">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
      <div><h3 className="flex items-center gap-2 text-base font-bold text-gray-800"><CalendarDays className="h-5 w-5 text-indigo-500" />Lịch nghỉ lễ & ngày làm bù</h3><p className="mt-1 text-[10px] text-gray-500">Áp dụng cho toàn bộ công ty.</p></div>
      <div className="flex gap-2"><select aria-label="Năm lịch" value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-lg border px-3 py-2 text-xs"><option value={2026}>2026</option></select><button onClick={sync} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold"><RefreshCw className="h-3.5 w-3.5" />Đồng bộ</button><button onClick={openCreate} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5" />Thêm ngày</button></div>
    </div>
    {loading ? <p className="py-5 text-center text-xs text-gray-500">Đang tải lịch...</p> : <div className="overflow-x-auto rounded-xl border"><table className="w-full text-xs"><thead className="bg-gray-50 text-gray-500"><tr><th className="p-3">Ngày</th><th className="p-3">Tên</th><th className="p-3">Loại</th><th className="p-3">Nguồn</th><th className="p-3">Áp dụng</th><th className="p-3">Thao tác</th></tr></thead><tbody>{days.map((day) => <tr key={day._id} className={!day.isApplied ? "opacity-50" : ""}><td className="p-3">{day.date.split("-").reverse().join("/")}</td><td className="p-3 font-semibold">{day.name}</td><td className="p-3">{TYPE_LABELS[day.dayType]}</td><td className="p-3"><span className="rounded-full bg-gray-100 px-2 py-1">{day.source === "system" ? "Hệ thống" : "Admin"}</span></td><td className="p-3"><input aria-label={`Áp dụng ${day.name}`} type="checkbox" checked={day.isApplied} onChange={() => void toggle(day)} /></td><td className="p-3">{day.source === "admin" && <button aria-label={`Sửa ${day.name}`} onClick={() => openEdit(day)} className="font-semibold text-indigo-600">Sửa</button>}</td></tr>)}</tbody></table></div>}
    {formOpen && createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <form
          onSubmit={save}
          className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-left"
        >
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 font-sans">
              {editingId ? "Sửa ngày công ty" : "Thêm ngày công ty"}
            </h4>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Ngày</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Tên ngày</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: Tết Dương Lịch"
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Loại ngày</label>
              <select
                value={form.dayType}
                onChange={(e) => setForm({ ...form, dayType: e.target.value as WorkCalendarDayType })}
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer"
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button className="w-full rounded-xl bg-indigo-600 p-2.5 font-bold text-xs text-white hover:bg-indigo-700 transition active:scale-95 shadow-md shadow-indigo-600/10 mt-4 cursor-pointer">
            Lưu thay đổi
          </button>
        </form>
      </div>,
      document.body
    )}
    {reasonTarget && createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-left">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 font-sans">
              Tắt áp dụng {reasonTarget.name}
            </h4>
            <button
              type="button"
              onClick={() => setReasonTarget(null)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1.5 text-left pt-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
              Lý do tắt áp dụng *
            </label>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do chi tiết..."
              className="w-full rounded-xl border border-gray-200 p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-24"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-3">
            <button
              onClick={() => setReasonTarget(null)}
              className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={() => void disable()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-red-650/10 cursor-pointer"
            >
              Xác nhận
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
  </div>;
}

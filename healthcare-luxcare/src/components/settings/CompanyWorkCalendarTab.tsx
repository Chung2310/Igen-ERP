import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "../../pages/Toast";
import {
  companyWorkCalendarService,
  type WorkCalendarDay,
  type WorkCalendarDayType,
} from "../../services/companyWorkCalendarService";
import { ConfirmDialog } from "../common/ConfirmDialog";

const TYPE_LABELS: Record<WorkCalendarDayType, string> = {
  holiday: "Ngày nghỉ lễ",
  substitute_holiday: "Ngày nghỉ bù",
  working_override: "Ngày làm bù",
};

export default function CompanyWorkCalendarTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [days, setDays] = useState<WorkCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reasonTarget, setReasonTarget] = useState<WorkCalendarDay | null>(null);
  const [reason, setReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WorkCalendarDay | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ date: `${year}-01-01`, name: "", dayType: "holiday" as WorkCalendarDayType });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDays(await companyWorkCalendarService.list(year));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [year]);
  useEffect(() => {
    void load();
  }, [load]);

  const sync = async () => {
    try {
      setDays(await companyWorkCalendarService.sync(year));
      toast.success("Đã đồng bộ lịch nghỉ lễ.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };
  const toggle = async (day: WorkCalendarDay) => {
    if (day.isApplied) {
      setReason("");
      setReasonTarget(day);
      return;
    }
    try {
      await companyWorkCalendarService.update(day._id, { isApplied: true });
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };
  const disable = async () => {
    if (!reasonTarget || !reason.trim()) {
      toast.error("Vui lòng nhập lý do tắt áp dụng.");
      return;
    }
    try {
      await companyWorkCalendarService.update(reasonTarget._id, { isApplied: false, adminReason: reason.trim() });
      setReasonTarget(null);
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editingId) await companyWorkCalendarService.update(editingId, form);
      else await companyWorkCalendarService.create(form);
      setFormOpen(false);
      setEditingId(null);
      setForm({ date: `${year}-01-01`, name: "", dayType: "holiday" });
      await load();
      toast.success(editingId ? "Đã cập nhật ngày." : "Đã thêm ngày vào lịch công ty.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ date: `${year}-01-01`, name: "", dayType: "holiday" });
    setFormOpen(true);
  };
  const openEdit = (day: WorkCalendarDay) => {
    setEditingId(day._id);
    setForm({ date: day.date, name: day.name, dayType: day.dayType });
    setFormOpen(true);
  };
  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await companyWorkCalendarService.remove(deleteTarget._id);
      setDeleteTarget(null);
      await load();
      toast.success("Đã xóa ngày khỏi lịch công ty.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setDeleting(false);
    }
  };


  return (
    <div className="space-y-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <CalendarDays className="h-5 w-5 text-cyan-600" />
            Lịch nghỉ lễ & ngày làm bù
          </h3>
          <p className="mt-1 text-xs text-slate-500">Áp dụng cho toàn bộ công ty.</p>
        </div>
        <div className="flex gap-2">
          <select
            aria-label="Năm lịch"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
          >
            <option value={2026}>2026</option>
          </select>
          <button onClick={sync} className="flex items-center gap-1 rounded-xl border border-slate-200 hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 transition cursor-pointer">
            <RefreshCw className="h-3.5 w-3.5" />
            Đồng bộ
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1 rounded-xl bg-cyan-600 hover:bg-cyan-700 px-3.5 py-2 text-xs font-bold text-white transition shadow-xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm ngày
          </button>
        </div>
      </div>
      {loading ? (
        <p className="py-8 text-center text-xs text-slate-500 font-semibold">Đang tải lịch...</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 text-left font-bold uppercase text-[11px]">
              <tr>
                <th className="p-3">Ngày</th>
                <th className="p-3">Tên</th>
                <th className="p-3">Loại</th>
                <th className="p-3">Nguồn</th>
                <th className="p-3">Áp dụng</th>
                <th className="p-3">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day._id} className={!day.isApplied ? "opacity-50" : ""}>
                  <td className="p-3">{day.date.split("-").reverse().join("/")}</td>
                  <td className="p-3 font-semibold">{day.name}</td>
                  <td className="p-3">{TYPE_LABELS[day.dayType]}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-gray-100 px-2 py-1">
                      {day.source === "system" ? "Hệ thống" : "Admin"}
                    </span>
                  </td>
                  <td className="p-3">
                    <input
                      aria-label={`Áp dụng ${day.name}`}
                      type="checkbox"
                      checked={day.isApplied}
                      onChange={() => void toggle(day)}
                    />
                  </td>
                  <td className="p-3">
                    {day.source === "admin" && (
                      <button
                        aria-label={`Sửa ${day.name}`}
                        onClick={() => openEdit(day)}
                        className="font-semibold text-cyan-700 hover:text-cyan-900 cursor-pointer"
                      >
                        Sửa
                      </button>
                    )}
                    {day.source === "admin" && (
                      <button
                        aria-label={`Xóa ${day.name}`}
                        onClick={() => setDeleteTarget(day)}
                        className="ml-3 inline-flex items-center gap-1 font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Xóa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {formOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <form onSubmit={save} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h4 className="font-bold text-slate-800">{editingId ? "Sửa ngày công ty" : "Thêm ngày công ty"}</h4>
                <button type="button" onClick={() => setFormOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                aria-label="Ngày"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
              <input
                aria-label="Tên ngày"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
              <select
                aria-label="Loại ngày"
                value={form.dayType}
                onChange={(e) => setForm({ ...form, dayType: e.target.value as WorkCalendarDayType })}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-none focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-700 p-2.5 font-bold text-white transition shadow-xs cursor-pointer">Lưu</button>
            </form>
          </div>,
          document.body,
        )}
      {reasonTarget &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
              <h4 className="font-bold text-slate-800">Tắt áp dụng {reasonTarget.name}</h4>
              <textarea
                aria-label="Lý do tắt áp dụng"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setReasonTarget(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer">
                  Hủy
                </button>
                <button onClick={() => void disable()} className="rounded-xl bg-red-600 hover:bg-red-700 px-3 py-2 text-xs font-bold text-white transition shadow-xs cursor-pointer">
                  Xác nhận
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        isSubmitting={deleting}
        title="Xóa ngày khỏi lịch công ty"
        description={`Ngày “${deleteTarget?.name || ""}” sẽ bị xóa vĩnh viễn.`}
        confirmLabel="Xóa ngày"
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
      />
    </div>
  );
}

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, RefreshCw, X } from "lucide-react";
import { toast } from "../../pages/Toast";
import { companyWorkCalendarService, type WorkCalendarDay, type WorkCalendarDayType } from "../../services/companyWorkCalendarService";
import { DateInput24 } from "../common/TimeInput24";
import { StyledSelect } from "../common/StyledSelect";
import { HrPageTitle } from "../hr/HrPageTitle";
import { ConfirmDialog } from "../common/ConfirmDialog";

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
  const [deleteTarget, setDeleteTarget] = useState<WorkCalendarDay | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
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
    if (!form.date) { toast.error("Vui lòng chọn ngày."); return; }
    try { if (editingId) await companyWorkCalendarService.update(editingId, form); else await companyWorkCalendarService.create(form); setFormOpen(false); setEditingId(null); setForm({ date: `${year}-01-01`, name: "", dayType: "holiday" }); await load(); toast.success(editingId ? "Đã cập nhật ngày." : "Đã thêm ngày vào lịch công ty."); }
    catch (error) { toast.error((error as Error).message); }
  };

  const openCreate = () => { setEditingId(null); setForm({ date: `${year}-01-01`, name: "", dayType: "holiday" }); setFormOpen(true); };
  const openEdit = (day: WorkCalendarDay) => { setEditingId(day._id); setForm({ date: day.date, name: day.name, dayType: day.dayType }); setFormOpen(true); };
  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await companyWorkCalendarService.delete(deleteTarget._id);
      setDays((current) => current.filter((day) => day._id !== deleteTarget._id));
      setDeleteTarget(null);
      toast.success("Đã xóa ngày khỏi lịch công ty.");
    } catch (error) {
      setDeleteError((error as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return <div className="space-y-4 text-left text-on-surface">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant pb-3">
      <HrPageTitle level={3}>Lịch nghỉ lễ & ngày làm bù</HrPageTitle>
      <div className="flex items-center gap-2"><StyledSelect appearance="erp" ariaLabel="Năm lịch" value={String(year)} onChange={(value) => setYear(Number(value))} options={[{ value: "2026", label: "2026" }]} className="w-32" /><button type="button" onClick={sync} className="flex min-h-10 items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm font-medium text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary"><RefreshCw className="size-4" aria-hidden="true" />Đồng bộ</button><button type="button" onClick={openCreate} className="flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"><Plus className="size-4" aria-hidden="true" />Thêm ngày</button></div>
    </div>
    {loading ? <p className="py-5 text-center text-sm text-on-surface-variant">Đang tải lịch...</p> : <div className="overflow-x-auto rounded-xl"><table className="w-full text-sm"><thead className="bg-surface-container-low text-on-surface"><tr><th scope="col" className="p-3 text-left font-medium">Ngày</th><th scope="col" className="p-3 text-left font-medium">Tên</th><th scope="col" className="p-3 text-left font-medium">Loại</th><th scope="col" className="p-3 text-left font-medium">Nguồn</th><th scope="col" className="p-3 text-left font-medium">Áp dụng</th><th scope="col" className="p-3 text-left font-medium">Thao tác</th></tr></thead><tbody>{days.map((day) => <tr key={day._id} className={!day.isApplied ? "opacity-50" : ""}><td className="p-3">{day.date.split("-").reverse().join("/")}</td><td className="p-3 font-medium">{day.name}</td><td className="p-3">{TYPE_LABELS[day.dayType]}</td><td className="p-3"><span className="rounded-full bg-surface-container-low px-2 py-1">{day.source === "system" ? "Hệ thống" : "Admin"}</span></td><td className="p-3"><input aria-label={`Áp dụng ${day.name}`} type="checkbox" checked={day.isApplied} onChange={() => void toggle(day)} /></td><td className="p-3"><div className="flex items-center gap-3">{day.source === "admin" && <><button type="button" aria-label={`Sửa ${day.name}`} onClick={() => openEdit(day)} className="font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">Sửa</button><button type="button" aria-label={`Xóa ${day.name} ngày ${day.date.split("-").reverse().join("/")}`} onClick={() => { setDeleteError(""); setDeleteTarget(day); }} className="font-medium text-error hover:underline focus-visible:outline-2 focus-visible:outline-primary">Xóa</button></>}</div></td></tr>)}</tbody></table></div>}
    <ConfirmDialog
      appearance="erp"
      native
      isOpen={deleteTarget !== null}
      title="Xóa ngày khỏi lịch công ty?"
      description={deleteTarget ? `Xóa “${deleteTarget.name}” ngày ${deleteTarget.date.split("-").reverse().join("/")}? Ngày này sẽ không còn được dùng để tính ngày làm việc.` : ""}
      confirmLabel="Xóa ngày"
      tone="danger"
      isSubmitting={deleting}
      error={deleteError}
      onClose={() => { if (!deleting) setDeleteTarget(null); }}
      onConfirm={confirmDelete}
    />
    {formOpen && createPortal(
      <div role="dialog" aria-modal="true" aria-labelledby="work-calendar-form-title" className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/55 p-4">
        <form
          onSubmit={save}
          className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 text-left text-on-surface shadow-lg"
        >
          <div className="flex items-center justify-between gap-3 border-b border-outline-variant pb-3">
            <h4 id="work-calendar-form-title" className="border-l-4 border-primary pl-3 text-base font-normal normal-case">
              {editingId ? "Sửa ngày công ty" : "Thêm ngày công ty"}
            </h4>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              aria-label="Đóng"
             data-erp-modal-close>
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-normal normal-case">Ngày</label>
              <DateInput24 required ariaLabel="Ngày công ty" value={form.date} onChange={(date) => setForm({ ...form, date })} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="work-calendar-name" className="block text-sm font-normal normal-case">Tên ngày</label>
              <input
                id="work-calendar-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: Tết Dương Lịch"
                className="min-h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm font-normal text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-normal normal-case">Loại ngày</label>
              <StyledSelect appearance="erp" ariaLabel="Loại ngày" value={form.dayType} onChange={(dayType) => setForm({ ...form, dayType: dayType as WorkCalendarDayType })} options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
            </div>
          </div>
          <div className="mt-5 flex justify-end border-t border-outline-variant pt-4"><button type="submit" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-normal normal-case text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary">
            Lưu thay đổi
          </button></div>
        </form>
      </div>,
      document.body
    )}
    {reasonTarget && createPortal(
      <div role="dialog" aria-modal="true" aria-labelledby="work-calendar-reason-title" className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/55 p-4">
        <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 text-left text-on-surface shadow-lg">
          <div className="flex items-center justify-between gap-3 border-b border-outline-variant pb-3">
            <h4 id="work-calendar-reason-title" className="border-l-4 border-primary pl-3 text-base font-normal normal-case">
              Tắt áp dụng {reasonTarget.name}
            </h4>
            <button
              type="button"
              onClick={() => setReasonTarget(null)}
              aria-label="Đóng"
             data-erp-modal-close>
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-4 space-y-1.5">
            <label htmlFor="work-calendar-reason" className="block text-sm font-normal normal-case">
              Lý do tắt áp dụng *
            </label>
            <textarea
              id="work-calendar-reason"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do chi tiết..."
              className="min-h-24 w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-sm font-normal text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-outline-variant pt-4">
            <button
              type="button"
              onClick={() => setReasonTarget(null)}
              className="min-h-10 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 text-sm font-normal text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => void disable()}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-normal normal-case text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
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

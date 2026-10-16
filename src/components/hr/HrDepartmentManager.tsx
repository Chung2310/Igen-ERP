import { useState } from "react";
import { Building2, Check, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { toast } from "../../pages/Toast";
import { hrDepartmentService, type HrDepartment } from "../../services/hrDepartmentService";

type Props = {
  companyCode: string;
  departments: HrDepartment[];
  onClose: () => void;
  onChanged: (refreshUsers?: boolean) => Promise<void>;
};

export function HrDepartmentManager({ companyCode, departments, onClose, onChanged }: Props) {
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<HrDepartment | null>(null);
  const normalizeSearch = (value: string) => value.trim().toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  const filteredDepartments = departments.filter(department => normalizeSearch(department.name).includes(normalizeSearch(search)));

  const add = async () => {
    const name = newName.trim();
    if (!name) return toast.warning("Vui lòng nhập tên phòng ban.");
    setBusy(true);
    try {
      await hrDepartmentService.create(companyCode, name);
      setNewName("");
      await onChanged();
      toast.success("Đã thêm phòng ban.");
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(false); }
  };

  const rename = async (id: string) => {
    const name = editingName.trim();
    if (!name) return toast.warning("Vui lòng nhập tên phòng ban.");
    setBusy(true);
    try {
      await hrDepartmentService.rename(companyCode, id, name);
      setEditingId(null);
      await onChanged(true);
      toast.success("Đã đổi tên phòng ban.");
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await hrDepartmentService.remove(companyCode, pendingDelete.id);
      setPendingDelete(null);
      await onChanged();
      toast.success("Đã xóa phòng ban.");
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
        <div role="dialog" aria-modal="true" aria-label="Quản lý phòng ban" className="flex max-h-[min(680px,calc(100dvh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="h-5 w-1 rounded-full bg-[#00ADFC]" />
              <Building2 className="h-4 w-4 text-[#00ADFC]" />
              <h2 className="text-base font-medium text-slate-900">Quản lý phòng ban</h2>
            </div>
            <button type="button" aria-label="Đóng" onClick={onClose} disabled={busy} className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white transition-colors hover:bg-rose-600 disabled:opacity-50"><X className="h-4 w-4" /></button>
          </div>

          <div className="min-h-0 overflow-y-auto p-5">
            <label htmlFor="new-hr-department" className="mb-1.5 block text-sm font-normal text-slate-700">Tên phòng ban mới</label>
            <div className="flex gap-2">
              <input id="new-hr-department" value={newName} maxLength={100} onChange={event => setNewName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void add(); }} placeholder="Ví dụ: Phòng kinh doanh" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/15" />
              <button type="button" onClick={() => void add()} disabled={busy || !newName.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-[#00ADFC] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0098e0] disabled:opacity-50"><Plus className="h-4 w-4" /> Thêm</button>
            </div>

            <div className="mt-6 flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-medium text-slate-800">Danh sách phòng ban</h3>
              <span className="text-xs font-normal text-slate-500">{search.trim() ? `${filteredDepartments.length}/${departments.length}` : departments.length} phòng ban</span>
            </div>
            {departments.length > 0 && <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#008ACB]" aria-hidden="true" />
              <input
                type="search"
                aria-label="Tìm phòng ban"
                placeholder="Tìm phòng ban..."
                value={search}
                onChange={event => setSearch(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-normal text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/15"
              />
            </div>}
            <div className="mt-2 space-y-1.5">
              {departments.length === 0 && <p className="rounded-xl bg-[#00ADFC]/5 px-4 py-5 text-center text-sm font-normal text-slate-500">Chưa có phòng ban. Hãy thêm phòng ban đầu tiên.</p>}
              {departments.length > 0 && filteredDepartments.length === 0 && <p className="rounded-xl bg-[#00ADFC]/5 px-4 py-5 text-center text-sm font-normal text-slate-500">Không tìm thấy phòng ban phù hợp.</p>}
              {filteredDepartments.map(department => (
                <div key={department.id} className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 hover:border-[#00ADFC]/30 hover:bg-[#00ADFC]/[0.03]">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00ADFC]/10 text-[#008ACB]"><Building2 className="h-4 w-4" /></span>
                  {editingId === department.id ? (
                    <input aria-label={`Đổi tên ${department.name}`} value={editingName} maxLength={100} autoFocus onChange={event => setEditingName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void rename(department.id); if (event.key === "Escape") setEditingId(null); }} className="min-w-0 flex-1 rounded-lg border border-[#00ADFC] px-2 py-1.5 text-sm font-normal outline-none ring-2 ring-[#00ADFC]/15" />
                  ) : (
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-normal text-slate-800">{department.name}</p><p className="text-xs font-normal text-slate-500">{department.employeeCount} nhân sự</p></div>
                  )}
                  {editingId === department.id ? (
                    <>
                      <button type="button" aria-label="Lưu tên phòng ban" title="Lưu" onClick={() => void rename(department.id)} disabled={busy} className="rounded-lg p-1.5 text-[#008ACB] hover:bg-[#00ADFC]/10"><Check className="h-4 w-4" /></button>
                      <button type="button" aria-label="Hủy đổi tên" title="Hủy" onClick={() => setEditingId(null)} disabled={busy} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
                    </>
                  ) : (
                    <>
                      <button type="button" aria-label={`Sửa ${department.name}`} title="Đổi tên" onClick={() => { setEditingId(department.id); setEditingName(department.name); }} disabled={busy} className="rounded-lg p-1.5 text-[#008ACB] hover:bg-[#00ADFC]/10"><Pencil className="h-4 w-4" /></button>
                      <button type="button" aria-label={`Xóa ${department.name}`} title={department.employeeCount ? "Chuyển nhân sự trước khi xóa" : "Xóa phòng ban"} onClick={() => setPendingDelete(department)} disabled={busy || department.employeeCount > 0} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          {busy && <div className="flex items-center justify-center gap-2 border-t border-slate-100 py-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang cập nhật...</div>}
        </div>
      </div>
      <ConfirmDialog appearance="erp" isOpen={!!pendingDelete} isSubmitting={busy} title="Xóa phòng ban" description={`Bạn muốn xóa phòng ban “${pendingDelete?.name || ""}”?`} confirmLabel="Xóa phòng ban" onClose={() => setPendingDelete(null)} onConfirm={remove} />
    </>
  );
}

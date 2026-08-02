import React from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { canManageBusinessModule } from "../../utils/businessModulePermissionPolicy";
import { workerApi } from "./api/workers.api";
import type { Worker, WorkerInput, WorkerStatus } from "./types";

const EMPTY_FORM: WorkerInput = { fullName: "", phone: "", email: "", status: "active", note: "", branchId: "" };
const STATUS_LABELS: Record<WorkerStatus, string> = { active: "Đang làm việc", inactive: "Ngừng hoạt động", placed: "Đã bố trí" };

export default function WorkerManagementTab() {
  const { userProfile } = useAuth();
  const canManage = canManageBusinessModule(userProfile?.permissions || [], "worker");
  const [workers, setWorkers] = React.useState<Worker[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [editing, setEditing] = React.useState<Worker | null>(null);
  const [form, setForm] = React.useState<WorkerInput>(EMPTY_FORM);
  const [showForm, setShowForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true); setError("");
    try { setWorkers(await workerApi.list()); }
    catch (cause: any) { setError(cause?.message || "Không thể tải danh sách lao động."); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const openForm = (worker?: Worker) => {
    setEditing(worker || null);
    setForm(worker ? { fullName: worker.fullName, phone: worker.phone || "", email: worker.email || "", status: worker.status, note: worker.note || "", branchId: worker.branchId || "" } : EMPTY_FORM);
    setShowForm(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.fullName.trim()) return;
    setSaving(true); setError("");
    try {
      if (editing) await workerApi.update(editing._id, form); else await workerApi.create(form);
      setShowForm(false); setEditing(null); await load();
    } catch (cause: any) { setError(cause?.message || "Không thể lưu lao động."); }
    finally { setSaving(false); }
  };

  const remove = async (worker: Worker) => {
    setError("");
    try { await workerApi.delete(worker._id); setWorkers((current) => current.filter((item) => item._id !== worker._id)); }
    catch (cause: any) { setError(cause?.message || "Không thể xóa lao động."); }
  };

  return (
    <section className="space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Quản lý lao động</h1><p className="mt-1 text-sm text-slate-500">Hồ sơ lao động độc lập theo doanh nghiệp và chi nhánh.</p></div>
        {canManage && <button type="button" onClick={() => openForm()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Thêm lao động</button>}
      </header>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <p className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-500">Đang tải dữ liệu…</p> : workers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Chưa có lao động nào.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{["Họ tên", "Số điện thoại", "Email", "Trạng thái"].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}{canManage && <th className="px-4 py-3 text-right">Thao tác</th>}</tr></thead><tbody>{workers.map((worker) => <tr key={worker._id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium text-slate-900">{worker.fullName}</td><td className="px-4 py-3">{worker.phone || "—"}</td><td className="px-4 py-3">{worker.email || "—"}</td><td className="px-4 py-3">{STATUS_LABELS[worker.status]}</td>{canManage && <td className="px-4 py-3"><div className="flex justify-end gap-2"><button aria-label={`Sửa ${worker.fullName}`} onClick={() => openForm(worker)}><Pencil className="h-4 w-4" /></button><button aria-label={`Xóa ${worker.fullName}`} onClick={() => void remove(worker)} className="text-red-600"><Trash2 className="h-4 w-4" /></button></div></td>}</tr>)}</tbody></table></div>
      )}
      {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><form onSubmit={save} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl"><div className="flex justify-between"><h2 className="text-lg font-bold">{editing ? "Cập nhật lao động" : "Thêm lao động"}</h2><button type="button" aria-label="Đóng" onClick={() => setShowForm(false)}><X className="h-5 w-5" /></button></div><label className="block text-sm">Họ tên<input aria-label="Họ tên" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Số điện thoại<input aria-label="Số điện thoại" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="text-sm">Email<input aria-label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label></div><label className="block text-sm">Trạng thái<select aria-label="Trạng thái" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as WorkerStatus })} className="mt-1 w-full rounded-lg border px-3 py-2">{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block text-sm">Ghi chú<textarea aria-label="Ghi chú" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2">Hủy</button><button disabled={saving || !form.fullName.trim()} className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? "Đang lưu…" : "Lưu"}</button></div></form></div>}
    </section>
  );
}

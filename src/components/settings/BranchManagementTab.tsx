import React, { useEffect, useMemo, useState } from "react";
import { Building2, Edit3, LocateFixed, Plus, Power, Search, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { branchService, type BranchInput, type BranchRecord } from "../../services/branchService";
import { toast } from "../../pages/Toast";

type FormState = Required<Pick<BranchInput, "code" | "name">> & Pick<BranchInput, "address" | "phone"> & { latitude: string; longitude: string; allowedRadius: string; allowedPublicIps: string };
const emptyForm: FormState = { code: "", name: "", address: "", phone: "", latitude: "", longitude: "", allowedRadius: "100", allowedPublicIps: "" };

export default function BranchManagementTab() {
  const { userProfile } = useAuth();
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<BranchRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [locating, setLocating] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setBranches(await branchService.list()); }
    catch (error: any) { toast.error(error.message || "Không thể tải danh sách chi nhánh."); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (userProfile?.role === "admin") void load(); else setLoading(false); }, [userProfile?.role, userProfile?.companyCode]);

  const filtered = useMemo(() => branches.filter((branch) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || branch.code.toLowerCase().includes(needle) || branch.name.toLowerCase().includes(needle);
    const matchesStatus = status === "all" || (status === "active" ? branch.isActive : !branch.isActive);
    return matchesQuery && matchesStatus;
  }), [branches, query, status]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (branch: BranchRecord) => { const config = branch.locationConfig; setEditing(branch); setForm({ code: branch.code, name: branch.name, address: branch.address || "", phone: branch.phone || "", latitude: config?.latitude?.toString() || "", longitude: config?.longitude?.toString() || "", allowedRadius: config?.allowedRadius?.toString() || "100", allowedPublicIps: config?.allowedPublicIps?.join("\n") || "" }); setFormOpen(true); };
  const closeForm = () => { setEditing(null); setForm(emptyForm); setFormOpen(false); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const ips = form.allowedPublicIps.split(/[\n,]/).map((value) => value.trim()).filter(Boolean);
      const locationConfig = form.latitude && form.longitude && form.allowedRadius && ips.length ? { latitude: Number(form.latitude), longitude: Number(form.longitude), allowedRadius: Number(form.allowedRadius), allowedPublicIps: [...new Set(ips)] } : undefined;
      const payload = { code: form.code, name: form.name, address: form.address, phone: form.phone, locationConfig };
      const data = editing ? await branchService.update(editing._id, payload) : await branchService.create(payload);
      setBranches((current) => editing ? current.map((branch) => branch._id === data._id ? data : branch) : [data, ...current]);
      closeForm();
      window.dispatchEvent(new CustomEvent("branch-change", { detail: { branchId: data.isActive ? data._id : "" } }));
      toast.success(editing ? "Đã cập nhật chi nhánh." : "Đã tạo chi nhánh.");
    } catch (error: any) { toast.error(error.message || "Không thể lưu chi nhánh."); }
    finally { setSaving(false); }
  };
  const captureLocationAndIp = async () => {
    setLocating(true);
    const positionPromise = new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation?.getCurrentPosition(resolve, reject, { enableHighAccuracy: true }) ?? reject(new Error("Trình duyệt không hỗ trợ định vị.")));
    const [position, ipResult] = await Promise.allSettled([positionPromise, branchService.currentIp()]);
    setForm((current) => ({
      ...current,
      latitude: position.status === "fulfilled" ? String(position.value.coords.latitude) : current.latitude,
      longitude: position.status === "fulfilled" ? String(position.value.coords.longitude) : current.longitude,
      allowedPublicIps: ipResult.status === "fulfilled" ? [...new Set([...current.allowedPublicIps.split(/[\n,]/).map((item) => item.trim()).filter(Boolean), ipResult.value.ip])].join("\n") : current.allowedPublicIps,
    }));
    if (position.status === "rejected") toast.error("Không thể lấy vị trí hiện tại.");
    if (ipResult.status === "rejected") toast.error("Không thể lấy IP mạng hiện tại.");
    setLocating(false);
  };
  const toggle = async (branch: BranchRecord) => {
    try {
      const data = await branchService.update(branch._id, { isActive: !branch.isActive });
      setBranches((current) => current.map((item) => item._id === data._id ? data : item));
      window.dispatchEvent(new CustomEvent("branch-change", { detail: { branchId: data.isActive ? data._id : "" } }));
      toast.success(data.isActive ? "Đã bật lại chi nhánh." : "Đã vô hiệu hóa chi nhánh.");
    } catch (error: any) { toast.error(error.message || "Không thể cập nhật trạng thái chi nhánh."); }
  };

  if (userProfile?.role !== "admin") return null;
  return <section className="rounded-2xl border border-gray-200/80 bg-white/80 p-5 shadow-xs">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-100 p-2.5 text-cyan-700"><Building2 className="h-5 w-5" /></div><div><h2 className="text-lg font-black text-slate-800">Quản lý chi nhánh</h2><p className="text-xs text-slate-500">Quản lý các địa điểm thuộc công ty của bạn.</p></div></div>
      <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-cyan-700"><Plus className="h-4 w-4" />Thêm chi nhánh</button>
    </div>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input aria-label="Tìm kiếm chi nhánh" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo mã hoặc tên" className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-cyan-500" /></label><select aria-label="Lọc trạng thái" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="inactive">Đã vô hiệu hóa</option></select></div>
    {loading ? <p className="py-10 text-center text-sm text-slate-500">Đang tải chi nhánh...</p> : filtered.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">Chưa có chi nhánh phù hợp.</p> : <ul className="mt-5 space-y-3">{filtered.map((branch) => <li key={branch._id} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><span className="font-mono text-xs font-bold text-cyan-700">{branch.code}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${branch.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{branch.isActive ? "Đang hoạt động" : "Đã vô hiệu hóa"}</span></div><h3 className="mt-1 text-sm font-bold text-slate-800">{branch.name}</h3><p className="mt-1 text-xs text-slate-500">{branch.address || "Chưa có địa chỉ"}{branch.phone ? ` · ${branch.phone}` : ""}</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => openEdit(branch)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-gray-50"><Edit3 className="h-3.5 w-3.5" />Sửa</button><button type="button" aria-label={branch.isActive ? "Vô hiệu hóa" : "Bật lại"} onClick={() => void toggle(branch)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${branch.isActive ? "border border-red-200 text-red-600 hover:bg-red-50" : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}><Power className="h-3.5 w-3.5" />{branch.isActive ? "Vô hiệu hóa" : "Bật lại"}</button></div></li>)}</ul>}
    {formOpen && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><form onSubmit={save} className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      <div className="flex items-center justify-between"><h3 className="text-lg font-black text-slate-800">{editing ? "Sửa chi nhánh" : "Tạo chi nhánh"}</h3><button type="button" aria-label="Đóng" onClick={closeForm} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
      <div className="mt-5 space-y-4">
        <label className="block text-xs font-bold text-slate-600">Mã chi nhánh<input required value={form.code} disabled={!!editing} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" /></label>
        <label className="block text-xs font-bold text-slate-600">Tên chi nhánh<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-bold text-slate-600">Địa chỉ<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" /></label><label className="block text-xs font-bold text-slate-600">Số điện thoại<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" /></label></div>
        <div className="rounded-xl border border-cyan-100 bg-cyan-50/50 p-4"><div className="flex items-center justify-between gap-3"><div><h4 className="text-xs font-black text-slate-700">Cấu hình chấm công</h4><p className="text-[10px] text-slate-500">Bắt buộc để nhân viên chấm công.</p></div><button type="button" onClick={() => void captureLocationAndIp()} disabled={locating} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><LocateFixed className="h-3.5 w-3.5" />{locating ? "Đang lấy..." : "Lấy vị trí & IP hiện tại"}</button></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-[11px] font-bold text-slate-600">Vĩ độ<input aria-label="Vĩ độ" type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className="mt-1 w-full rounded-lg border p-2 text-xs" /></label><label className="text-[11px] font-bold text-slate-600">Kinh độ<input aria-label="Kinh độ" type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className="mt-1 w-full rounded-lg border p-2 text-xs" /></label><label className="text-[11px] font-bold text-slate-600">Bán kính (m)<input aria-label="Bán kính" type="number" min="1" value={form.allowedRadius} onChange={(e) => setForm({ ...form, allowedRadius: e.target.value })} className="mt-1 w-full rounded-lg border p-2 text-xs" /></label></div>
          <label className="mt-3 block text-[11px] font-bold text-slate-600">IP công cộng được phép<textarea aria-label="IP công cộng được phép" rows={3} value={form.allowedPublicIps} onChange={(e) => setForm({ ...form, allowedPublicIps: e.target.value })} placeholder="Mỗi IP một dòng" className="mt-1 w-full rounded-lg border p-2 font-mono text-xs" /></label>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={closeForm} className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-slate-600">Hủy</button><button type="submit" disabled={saving} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? "Đang lưu..." : editing ? "Lưu cập nhật" : "Tạo chi nhánh"}</button></div>
    </form></div>}
  </section>;
}

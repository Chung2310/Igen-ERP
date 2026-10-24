import React, { useEffect, useMemo, useState } from "react";
import { Building2, Edit3, LocateFixed, Plus, Power, Search, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { branchService, type BranchInput, type BranchRecord } from "../../services/branchService";
import { toast } from "../../pages/Toast";
import { toAttendanceNetwork } from "../../utils/attendanceNetwork";
import { RoadmapPicker } from "../../modules/student-management/components/ui/RoadmapPicker";
import { UserFormModal } from "../user-admin/UserFormModal";

type FormState = Required<Pick<BranchInput, "code" | "name">> & Pick<BranchInput, "address" | "phone"> & { latitude: string; longitude: string; allowedRadius: string; allowedPublicIps: string };
const emptyForm: FormState = { code: "", name: "", address: "", phone: "", latitude: "", longitude: "", allowedRadius: "100", allowedPublicIps: "" };

function geolocationErrorMessage(reason: unknown) {
  const code = typeof reason === "object" && reason !== null && "code" in reason
    ? Number((reason as { code: unknown }).code)
    : 0;
  if (code === 1) return "Trình duyệt đang chặn quyền truy cập vị trí. Hãy cho phép Vị trí cho trang này rồi thử lại.";
  if (code === 2) return "Thiết bị chưa xác định được vị trí. Hãy bật GPS/Dịch vụ vị trí rồi thử lại.";
  if (code === 3) return "Lấy vị trí quá lâu. Hãy đứng ở nơi có tín hiệu GPS tốt hơn rồi thử lại.";
  if (reason instanceof Error) return reason.message;
  return "Không thể lấy vị trí hiện tại. Hãy kiểm tra quyền Vị trí của trình duyệt rồi thử lại.";
}

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
  const [pendingBranch, setPendingBranch] = useState<BranchRecord | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerBirthDate, setOwnerBirthDate] = useState("");
  const [ownerQualification, setOwnerQualification] = useState("");
  const [ownerDepartment, setOwnerDepartment] = useState("");
  const [ownerJobDescriptionLink, setOwnerJobDescriptionLink] = useState("");
  const [ownerJobDescriptionUploadToken, setOwnerJobDescriptionUploadToken] = useState("");
  const [ownerMonthlySalary, setOwnerMonthlySalary] = useState("");
  const [savingOwner, setSavingOwner] = useState(false);

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
      if (!editing) {
        setPendingBranch(data);
        setOwnerName(""); setOwnerEmail(""); setOwnerPassword(""); setOwnerPhone(""); setOwnerBirthDate(""); setOwnerQualification("");
        return;
      }
      window.dispatchEvent(new CustomEvent("branch-change", { detail: { branchId: data.isActive ? data._id : "" } }));
      toast.success(editing ? "Đã cập nhật chi nhánh." : "Đã tạo chi nhánh.");
    } catch (error: any) { toast.error(error.message || "Không thể lưu chi nhánh."); }
    finally { setSaving(false); }
  };
  const cancelOwner = async () => {
    if (!pendingBranch) return;
    setSavingOwner(true);
    try {
      await branchService.removePending(pendingBranch._id);
      setBranches((current) => current.filter((branch) => branch._id !== pendingBranch._id));
      setPendingBranch(null);
      toast.success("Đã hủy tạo chi nhánh.");
    } catch (error: any) { toast.error(error.message || "Không thể hủy chi nhánh mới."); }
    finally { setSavingOwner(false); }
  };
  const saveOwner = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pendingBranch) return;
    setSavingOwner(true);
    try {
      const result = await branchService.createOwner(pendingBranch._id, { displayName: ownerName, email: ownerEmail, password: ownerPassword, phone: ownerPhone || undefined, birthDate: ownerBirthDate || undefined, qualification: ownerQualification || undefined });
      setBranches((current) => current.map((branch) => branch._id === result.branch._id ? result.branch : branch));
      setPendingBranch(null);
      window.dispatchEvent(new CustomEvent("branch-change", { detail: { branchId: result.branch._id } }));
      toast.success("Đã tạo chi nhánh và Chủ chi nhánh.");
    } catch (error: any) { toast.error(error.message || "Không thể tạo Chủ chi nhánh."); }
    finally { setSavingOwner(false); }
  };
  const captureLocationAndIp = async () => {
    setLocating(true);
    const positionPromise = new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Trình duyệt không hỗ trợ định vị."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
    });
    const [position, ipResult] = await Promise.allSettled([positionPromise, branchService.currentIp()]);
    setForm((current) => ({
      ...current,
      latitude: position.status === "fulfilled" ? String(position.value.coords.latitude) : current.latitude,
      longitude: position.status === "fulfilled" ? String(position.value.coords.longitude) : current.longitude,
      allowedPublicIps: ipResult.status === "fulfilled" ? [...new Set([...current.allowedPublicIps.split(/[\n,]/).map((item) => item.trim()).filter(Boolean), toAttendanceNetwork(ipResult.value.ip)])].join("\n") : current.allowedPublicIps,
    }));
    if (position.status === "rejected") toast.error(geolocationErrorMessage(position.reason));
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
  return <section className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-sky-50 p-2.5 text-brand-primary"><Building2 className="h-5 w-5" /></div><div><h2 className="text-base font-medium text-slate-800">Quản lý chi nhánh</h2></div></div>
      <button type="button" onClick={openCreate} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-medium text-white transition hover:bg-sky-600"><Plus className="h-4 w-4" />Thêm chi nhánh</button>
    </div>
    <div className="mt-4 flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input aria-label="Tìm kiếm chi nhánh" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo mã hoặc tên" className="h-10 w-full rounded-xl border border-sky-100 bg-white pl-9 pr-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10" /></label><div className="w-full sm:w-48"><RoadmapPicker ariaLabel="Lọc trạng thái" value={status} onChange={(value) => setStatus(value as typeof status)} placeholder="Tất cả trạng thái" allowClear={false} portal options={[{ value: "all", label: "Tất cả trạng thái" }, { value: "active", label: "Đang hoạt động" }, { value: "inactive", label: "Đã vô hiệu hóa" }]} /></div></div>
    {loading ? <p className="py-10 text-center text-sm text-slate-500">Đang tải chi nhánh...</p> : filtered.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">Chưa có chi nhánh phù hợp.</p> : <ul className="mt-4 divide-y divide-slate-100 border-y border-slate-100">{filtered.map((branch) => <li key={branch._id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-2"><div><div className="flex items-center gap-2"><span className="font-mono text-xs font-medium text-brand-primary">{branch.code}</span><span className={`rounded-full border px-2 py-0.5 text-xs font-normal ${branch.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{branch.isActive ? "Đang hoạt động" : "Đã vô hiệu hóa"}</span></div><h3 className="mt-1 text-sm font-medium text-slate-800">{branch.name}</h3><p className="mt-1 text-xs text-slate-500">{branch.address || "Chưa có địa chỉ"}{branch.phone ? ` · ${branch.phone}` : ""}</p></div><div className="flex items-center gap-1.5"><button type="button" title="Sửa chi nhánh" aria-label={`Sửa chi nhánh ${branch.name}`} onClick={() => openEdit(branch)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-100 bg-white text-slate-500 transition hover:bg-sky-50 hover:text-brand-primary"><Edit3 className="h-4 w-4" /></button><button type="button" title={branch.isActive ? "Vô hiệu hóa" : "Bật lại"} aria-label={branch.isActive ? "Vô hiệu hóa" : "Bật lại"} onClick={() => void toggle(branch)} className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${branch.isActive ? "border-rose-200 bg-white text-rose-600 hover:bg-rose-50" : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"}`}><Power className="h-4 w-4" /></button></div></li>)}</ul>}
    {formOpen && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"><form onSubmit={save} className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-sky-100 bg-white p-5 shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3"><div className="flex items-center gap-3"><span className="h-6 w-1 rounded-full bg-brand-primary" aria-hidden="true" /><h3 className="text-base font-medium text-slate-800">{editing ? "Sửa chi nhánh" : "Tạo chi nhánh"}</h3></div><button type="button" aria-label="Đóng" onClick={closeForm} className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white transition hover:bg-rose-600"><X className="h-4 w-4" /></button></div>
      <div className="mt-4 space-y-3">
        <label className="block text-xs font-medium text-slate-600">Mã chi nhánh<input required value={form.code} disabled={!!editing} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} className="mt-1.5 h-9 w-full rounded-xl border border-sky-100 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 disabled:bg-slate-50 disabled:text-slate-500" /></label>
        <label className="block text-xs font-medium text-slate-600">Tên chi nhánh<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1.5 h-9 w-full rounded-xl border border-sky-100 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10" /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs font-medium text-slate-600">Địa chỉ<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="mt-1.5 h-9 w-full rounded-xl border border-sky-100 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10" /></label><label className="block text-xs font-medium text-slate-600">Số điện thoại<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-1.5 h-9 w-full rounded-xl border border-sky-100 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10" /></label></div>
        <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3.5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h4 className="text-sm font-medium text-slate-700">Cấu hình chấm công</h4><p className="text-xs text-slate-500">Bắt buộc để nhân viên chấm công.</p></div><button type="button" onClick={() => void captureLocationAndIp()} disabled={locating} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-brand-primary px-3 text-xs font-medium text-white transition hover:bg-sky-600 disabled:opacity-50"><LocateFixed className="h-3.5 w-3.5" />{locating ? "Đang lấy..." : "Lấy vị trí & IP hiện tại"}</button></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-xs font-medium text-slate-600">Vĩ độ<input aria-label="Vĩ độ" type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className="no-number-spinner mt-1.5 h-9 w-full rounded-xl border border-sky-100 bg-white px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10" /></label><label className="text-xs font-medium text-slate-600">Kinh độ<input aria-label="Kinh độ" type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className="no-number-spinner mt-1.5 h-9 w-full rounded-xl border border-sky-100 bg-white px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10" /></label><label className="text-xs font-medium text-slate-600">Bán kính (m)<input aria-label="Bán kính" type="number" min="1" value={form.allowedRadius} onChange={(e) => setForm({ ...form, allowedRadius: e.target.value })} className="no-number-spinner mt-1.5 h-9 w-full rounded-xl border border-sky-100 bg-white px-2.5 text-sm font-normal text-slate-800 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10" /></label></div>
          <label className="mt-3 block text-xs font-medium text-slate-600">IP công cộng được phép<textarea aria-label="IP công cộng được phép" rows={3} value={form.allowedPublicIps} onChange={(e) => setForm({ ...form, allowedPublicIps: e.target.value })} placeholder="Mỗi IP một dòng" className="mt-1.5 w-full rounded-xl border border-sky-100 bg-white p-2.5 font-mono text-xs font-normal text-slate-700 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10" /><span className="mt-1 block text-xs font-normal leading-5 text-slate-500">IPv4 được kiểm tra chính xác; IPv6 dùng chung mạng /64 cho các thiết bị cùng Wi-Fi.</span></label>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={closeForm} className="h-9 rounded-lg px-3 text-sm font-normal text-slate-600 transition hover:bg-slate-50">Hủy</button><button type="submit" disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-medium text-white transition hover:bg-sky-600 disabled:opacity-50">{saving ? "Đang lưu..." : editing ? "Lưu cập nhật" : "Tạo chi nhánh"}</button></div>
    </form></div>}
    <UserFormModal
      open={!!pendingBranch} onClose={() => void cancelOwner()} editingUser={null}
      userDisplayName={ownerName} setUserDisplayName={setOwnerName} userEmail={ownerEmail} setUserEmail={setOwnerEmail}
      userPhone={ownerPhone} setUserPhone={setOwnerPhone} userBirthDate={ownerBirthDate} setUserBirthDate={setOwnerBirthDate}
      userPassword={ownerPassword} setUserPassword={setOwnerPassword} userRole="branch_owner" setUserRole={() => undefined}
      userCompanyCode={userProfile?.companyCode || ""} setUserCompanyCode={() => undefined}
      userBranchId={pendingBranch?._id || ""} setUserBranchId={() => undefined}
      userParentId={userProfile?.uid || ""} setUserParentId={() => undefined}
      userDepartment={ownerDepartment} setUserDepartment={setOwnerDepartment}
      userQualification={ownerQualification} setUserQualification={setOwnerQualification}
      userJobDescriptionLink={ownerJobDescriptionLink} setUserJobDescriptionLink={setOwnerJobDescriptionLink}
      setUserJobDescriptionUploadToken={setOwnerJobDescriptionUploadToken}
      userMonthlySalary={ownerMonthlySalary} setUserMonthlySalary={setOwnerMonthlySalary}
      getAvailableRoles={() => [{ role: "branch_owner", displayName: "Chủ chi nhánh", level: 2 }]}
      userProfile={userProfile} companies={[]} branches={pendingBranch ? [pendingBranch] : []} usersList={userProfile ? [userProfile] : []}
      onSubmit={saveOwner} submittingUser={savingOwner} lockRole lockCompany lockBranch lockParent
    />
  </section>;
}

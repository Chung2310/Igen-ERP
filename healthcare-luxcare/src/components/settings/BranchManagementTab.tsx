import React, { useEffect, useMemo, useState } from "react";
import { Building2, Edit3, LocateFixed, Plus, Power, Search, Trash2, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { branchService, type BranchInput, type BranchRecord } from "../../services/branchService";
import { toast } from "../../pages/Toast";
import { toAttendanceNetwork } from "../../utils/attendanceNetwork";
import { UserFormModal } from "../user-admin/UserFormModal";

type FormLocation = { id: string; name: string; type: "office" | "business_trip"; latitude: string; longitude: string; allowedRadius: string; allowedPublicIps: string; isActive: boolean };
type FormState = Required<Pick<BranchInput, "code" | "name">> & Pick<BranchInput, "address" | "phone"> & { attendanceLocations: FormLocation[] };
const emptyForm: FormState = { code: "", name: "", address: "", phone: "", attendanceLocations: [] };
const newLocation = (): FormLocation => ({ id: `location-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: "", type: "office", latitude: "", longitude: "", allowedRadius: "100", allowedPublicIps: "", isActive: true });

export function generateBranchCode(companyCode?: string, branchName?: string): string {
  const cleanName = (branchName || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!cleanName) return "";

  const comp = (companyCode || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Z0-9]/g, "");

  if (!comp) return cleanName.slice(0, 32).replace(/_+$/, "");

  const combined = `${comp}_${cleanName}`;
  return combined.slice(0, 32).replace(/_+$/, "");
}

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

function locationSummary(branch: BranchRecord) {
  const locations = (branch.attendanceLocations || []).filter((location) => location.isActive);
  if (!locations.length && branch.locationConfig) return "1 vị trí · 1 văn phòng · 0 công tác";
  const offices = locations.filter((location) => location.type === "office").length;
  return `${locations.length} vị trí · ${offices} văn phòng · ${locations.length - offices} công tác`;
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

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm, attendanceLocations: [] }); setFormOpen(true); };
  const openEdit = (branch: BranchRecord) => {
    const locations = branch.attendanceLocations || (branch.locationConfig ? [{ id: "legacy", name: "Văn phòng chính", type: "office" as const, isActive: true, ...branch.locationConfig }] : []);
    setEditing(branch);
    setForm({ code: branch.code, name: branch.name, address: branch.address || "", phone: branch.phone || "", attendanceLocations: locations.map((location) => ({ ...location, latitude: String(location.latitude), longitude: String(location.longitude), allowedRadius: String(location.allowedRadius), allowedPublicIps: location.allowedPublicIps.join("\n") })) });
    setFormOpen(true);
  };
  const closeForm = () => { setEditing(null); setForm(emptyForm); setFormOpen(false); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const attendanceLocations = form.attendanceLocations.map((location) => ({
        id: location.id, name: location.name.trim(), type: location.type,
        latitude: Number(location.latitude), longitude: Number(location.longitude), allowedRadius: Number(location.allowedRadius),
        allowedPublicIps: location.type === "office" ? [...new Set(location.allowedPublicIps.split(/[\n,]/).map((value) => value.trim()).filter(Boolean))] : [],
        isActive: location.isActive,
      }));
      const branchCode = form.code || generateBranchCode(userProfile?.companyCode, form.name);
      const payload = { code: branchCode, name: form.name, address: form.address, phone: form.phone, attendanceLocations };
      const data = editing ? await branchService.update(editing._id, payload) : await branchService.create(payload);
      closeForm();
      if (!editing) {
        setPendingBranch(data);
        setOwnerName(""); setOwnerEmail(""); setOwnerPassword(""); setOwnerPhone(""); setOwnerBirthDate(""); setOwnerQualification("");
        return;
      }
      setBranches((current) => current.map((branch) => branch._id === data._id ? data : branch));
      window.dispatchEvent(new CustomEvent("branch-change", { detail: { branchId: data.isActive ? data._id : "" } }));
      toast.success("Đã cập nhật chi nhánh.");
    } catch (error: any) { toast.error(error.message || "Không thể lưu chi nhánh."); }
    finally { setSaving(false); }
  };
  const cancelOwner = async () => {
    if (!pendingBranch) return;
    const branchToRemove = pendingBranch;
    setSavingOwner(true);
    try {
      await branchService.removePending(branchToRemove._id);
      setBranches((current) => current.filter((branch) => branch._id !== branchToRemove._id));
      setPendingBranch(null);
      toast.info("Đã hủy tạo chi nhánh.");
    } catch (error: any) {
      setPendingBranch(null);
      toast.error(error.message || "Không thể hủy chi nhánh mới.");
    } finally {
      setSavingOwner(false);
    }
  };
  const saveOwner = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pendingBranch) return;
    setSavingOwner(true);
    try {
      const result = await branchService.createOwner(pendingBranch._id, { displayName: ownerName, email: ownerEmail, password: ownerPassword, phone: ownerPhone || undefined, birthDate: ownerBirthDate || undefined, qualification: ownerQualification || undefined });
      setBranches((current) => [result.branch, ...current.filter((b) => b._id !== result.branch._id)]);
      setPendingBranch(null);
      window.dispatchEvent(new CustomEvent("branch-change", { detail: { branchId: result.branch._id } }));
      toast.success("Đã tạo chi nhánh và Chủ chi nhánh.");
    } catch (error: any) { toast.error(error.message || "Không thể tạo Chủ chi nhánh."); }
    finally { setSavingOwner(false); }
  };
  const updateLocation = (index: number, patch: Partial<FormLocation>) => setForm((current) => ({ ...current, attendanceLocations: current.attendanceLocations.map((location, itemIndex) => itemIndex === index ? { ...location, ...patch } : location) }));
  const captureLocationAndIp = async (index: number) => {
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
    setForm((current) => ({ ...current, attendanceLocations: current.attendanceLocations.map((location, itemIndex) => itemIndex !== index ? location : ({
      ...location,
      latitude: position.status === "fulfilled" ? String(position.value.coords.latitude) : location.latitude,
      longitude: position.status === "fulfilled" ? String(position.value.coords.longitude) : location.longitude,
      allowedPublicIps: location.type === "office" && ipResult.status === "fulfilled" ? [...new Set([...location.allowedPublicIps.split(/[\n,]/).map((item) => item.trim()).filter(Boolean), toAttendanceNetwork(ipResult.value.ip)])].join("\n") : location.allowedPublicIps,
    })) }));
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
  return <section className="rounded-2xl border border-gray-200/80 bg-white/80 p-5 shadow-xs">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-100 p-2.5 text-cyan-700"><Building2 className="h-5 w-5" /></div><div><h2 className="text-lg font-black text-slate-800">Quản lý chi nhánh</h2><p className="text-xs text-slate-500">Quản lý các địa điểm thuộc công ty của bạn.</p></div></div>
      <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-cyan-700"><Plus className="h-4 w-4" />Thêm chi nhánh</button>
    </div>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input aria-label="Tìm kiếm chi nhánh" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo mã hoặc tên" className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-cyan-500" /></label><select aria-label="Lọc trạng thái" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="inactive">Đã vô hiệu hóa</option></select></div>
    {loading ? <p className="py-10 text-center text-sm text-slate-500">Đang tải chi nhánh...</p> : filtered.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">Chưa có chi nhánh phù hợp.</p> : <ul className="mt-5 space-y-3">{filtered.map((branch) => <li key={branch._id} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><span className="font-mono text-xs font-bold text-cyan-700">{branch.code}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${branch.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{branch.isActive ? "Đang hoạt động" : "Đã vô hiệu hóa"}</span></div><h3 className="mt-1 text-sm font-bold text-slate-800">{branch.name}</h3><p className="mt-1 text-xs text-slate-500">{branch.address || "Chưa có địa chỉ"}{branch.phone ? ` · ${branch.phone}` : ""}</p><p className="mt-1 text-[11px] font-semibold text-cyan-700">{locationSummary(branch)}</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => openEdit(branch)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-gray-50"><Edit3 className="h-3.5 w-3.5" />Sửa</button><button type="button" aria-label={branch.isActive ? "Vô hiệu hóa" : "Bật lại"} onClick={() => void toggle(branch)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${branch.isActive ? "border border-red-200 text-red-600 hover:bg-red-50" : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}><Power className="h-3.5 w-3.5" />{branch.isActive ? "Vô hiệu hóa" : "Bật lại"}</button></div></li>)}</ul>}
    {formOpen && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><form onSubmit={save} className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      <div className="flex items-center justify-between"><h3 className="text-lg font-black text-slate-800">{editing ? "Sửa chi nhánh" : "Tạo chi nhánh"}</h3><button type="button" aria-label="Đóng" onClick={closeForm} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
      <div className="mt-5 space-y-4">
        {editing && (
          <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
            Mã chi nhánh: <span className="font-mono font-bold text-cyan-700">{form.code}</span>
          </div>
        )}
        <div>
          <label htmlFor="branch-name-input" className="block text-xs font-bold text-slate-600">Tên chi nhánh</label>
          <input
            id="branch-name-input"
            aria-label="Tên chi nhánh"
            required
            value={form.name}
            onChange={(event) => {
              const newName = event.target.value;
              setForm((current) => ({
                ...current,
                name: newName,
                code: !editing ? generateBranchCode(userProfile?.companyCode, newName) : current.code,
              }));
            }}
            placeholder="Nhập tên chi nhánh..."
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-bold text-slate-600">Địa chỉ<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" /></label><label className="block text-xs font-bold text-slate-600">Số điện thoại<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" /></label></div>
        <div className="rounded-xl border border-cyan-100 bg-cyan-50/50 p-4">
          <div className="flex items-center justify-between gap-3"><div><h4 className="text-xs font-black text-slate-700">Cấu hình chấm công</h4><p className="text-[10px] text-slate-500">Một chi nhánh có thể có nhiều vị trí văn phòng hoặc công tác.</p></div><button type="button" onClick={() => setForm((current) => ({ ...current, attendanceLocations: [...current.attendanceLocations, newLocation()] }))} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5" />Thêm vị trí chấm công</button></div>
          <div className="mt-3 space-y-3">{form.attendanceLocations.map((location, index) => <div key={location.id} className="rounded-xl border border-cyan-100 bg-white p-3">
            <div className="flex items-center gap-2"><input aria-label={`Tên vị trí ${index + 1}`} required placeholder="Tên vị trí" value={location.name} onChange={(event) => updateLocation(index, { name: event.target.value })} className="min-w-0 flex-1 rounded-lg border p-2 text-xs" /><select aria-label={`Loại vị trí ${index + 1}`} value={location.type} onChange={(event) => updateLocation(index, { type: event.target.value as FormLocation["type"], allowedPublicIps: event.target.value === "business_trip" ? "" : location.allowedPublicIps })} className="rounded-lg border p-2 text-xs"><option value="office">Văn phòng</option><option value="business_trip">Công tác</option></select><label className="flex items-center gap-1 text-[10px] font-bold text-slate-600"><input type="checkbox" checked={location.isActive} onChange={(event) => updateLocation(index, { isActive: event.target.checked })} />Bật</label><button type="button" aria-label={`Xóa vị trí ${index + 1}`} onClick={() => setForm((current) => ({ ...current, attendanceLocations: current.attendanceLocations.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-[11px] font-bold text-slate-600">Vĩ độ<input required aria-label={`Vĩ độ ${index + 1}`} type="number" step="any" value={location.latitude} onChange={(event) => updateLocation(index, { latitude: event.target.value })} className="mt-1 w-full rounded-lg border p-2 text-xs" /></label><label className="text-[11px] font-bold text-slate-600">Kinh độ<input required aria-label={`Kinh độ ${index + 1}`} type="number" step="any" value={location.longitude} onChange={(event) => updateLocation(index, { longitude: event.target.value })} className="mt-1 w-full rounded-lg border p-2 text-xs" /></label><label className="text-[11px] font-bold text-slate-600">Bán kính (m)<input required aria-label={`Bán kính ${index + 1}`} type="number" min="1" value={location.allowedRadius} onChange={(event) => updateLocation(index, { allowedRadius: event.target.value })} className="mt-1 w-full rounded-lg border p-2 text-xs" /></label></div>
            <button type="button" onClick={() => void captureLocationAndIp(index)} disabled={locating} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><LocateFixed className="h-3.5 w-3.5" />{locating ? "Đang lấy..." : "Lấy vị trí & IP hiện tại"}</button>
            {location.type === "office" ? <label className="mt-3 block text-[11px] font-bold text-slate-600">IP công cộng được phép<textarea required aria-label={`IP được phép ${index + 1}`} rows={2} value={location.allowedPublicIps} onChange={(event) => updateLocation(index, { allowedPublicIps: event.target.value })} placeholder="Mỗi IP một dòng" className="mt-1 w-full rounded-lg border p-2 font-mono text-xs" /></label> : <p className="mt-3 rounded-lg bg-amber-50 p-2 text-[11px] font-semibold text-amber-700">Vị trí công tác chỉ kiểm tra GPS, không kiểm tra IP.</p>}
          </div>)}</div>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={closeForm} className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-slate-600">Hủy</button><button type="submit" disabled={saving} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? "Đang lưu..." : editing ? "Lưu cập nhật" : "Tạo chi nhánh"}</button></div>
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
      userMonthlySalary={ownerMonthlySalary} setUserMonthlySalary={setOwnerMonthlySalary}
      getAvailableRoles={() => [{ role: "branch_owner", displayName: "Chủ chi nhánh", level: 2 }]}
      userProfile={userProfile} companies={[]} branches={pendingBranch ? [pendingBranch] : []} usersList={userProfile ? [userProfile] : []}
      onSubmit={saveOwner} submittingUser={savingOwner}
    />
  </section>;
}

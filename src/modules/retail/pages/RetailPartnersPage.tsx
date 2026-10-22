import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../../context/AuthContext";
import { apiFetch } from "../../shared/lib/apiFetch";
import RetailPartnerStatement from "../components/RetailPartnerStatement";

type PartnerRole = "collaborator" | "dealer" | "supplier";
type Partner = {
  _id: string;
  code: string;
  name: string;
  roles: PartnerRole[];
  phone?: string;
  email?: string;
  address?: string;
  status: "active" | "inactive";
  supplierId?: string;
  userId?: string;
  supplier?: { name: string; code: string } | null;
};
type Supplier = { _id: string; code: string; name: string };
type PartnerUser = { _id: string; displayName?: string; email: string };
type Form = Omit<Partner, "_id" | "supplier">;
const initialForm: Form = { code: "", name: "", roles: ["collaborator"], phone: "", email: "", address: "", status: "active", supplierId: "", userId: "" };
const roleLabels: Record<PartnerRole, string> = { collaborator: "Cộng tác viên", dealer: "Đại lý", supplier: "Nhà cung cấp" };
const fieldClass = "min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary";

export default function RetailPartnersPage() {
  const { userProfile, hasPermission } = useAuth();
  const companyCode = userProfile?.companyCode;
  const canManage = userProfile?.role === "admin" || userProfile?.role === "superadmin" || hasPermission("retail-partner:manage");
  const canRead = canManage || hasPermission("retail-partner:read");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [users, setUsers] = useState<PartnerUser[]>([]);
  const [form, setForm] = useState<Form>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [filter, setFilter] = useState("");

  async function load() {
    if (!companyCode) return;
    setLoading(true);
    setError("");
    try {
      if (canRead) {
        const response = await apiFetch<{ data: Partner[] }>("/retail/partners", { params: { companyCode } });
        setPartners(response.data);
        if (canManage) {
          const supplierResponse = await apiFetch<{ data: Supplier[] }>("/retail/partners/suppliers", { params: { companyCode } });
          setSuppliers(supplierResponse.data);
          const userResponse = await apiFetch<{ data: PartnerUser[] }>("/retail/partners/users", { params: { companyCode } });
          setUsers(userResponse.data);
        }
      } else {
        const response = await apiFetch<{ data: Partner }>("/retail/partners/me", { params: { companyCode } });
        setPartners([response.data]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được danh sách đối tác.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [companyCode, canRead, canManage]);

  function startCreate() {
    setEditingId(null);
    setForm(initialForm);
    setFormError("");
    setShowForm(true);
  }

  function startEdit(partner: Partner) {
    setEditingId(partner._id);
    setForm({ code: partner.code, name: partner.name, roles: partner.roles, phone: partner.phone || "", email: partner.email || "", address: partner.address || "", status: partner.status, supplierId: partner.supplierId || "", userId: partner.userId || "" });
    setFormError("");
    setShowForm(true);
  }

  function toggleRole(role: PartnerRole) {
    setForm((current) => {
      const roles = current.roles.includes(role) ? current.roles.filter((item) => item !== role) : [...current.roles, role];
      return { ...current, roles, ...(role === "supplier" && !roles.includes("supplier") ? { supplierId: "" } : {}) };
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!companyCode || saving) return;
    if (!form.roles.length) { setFormError("Chọn ít nhất một vai trò."); return; }
    setSaving(true);
    setFormError("");
    try {
      await apiFetch(`/retail/partners${editingId ? `/${editingId}` : ""}`, {
        method: editingId ? "PATCH" : "POST",
        params: { companyCode },
        body: JSON.stringify(form),
      });
      setShowForm(false);
      await load();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Không lưu được đối tác.");
    } finally {
      setSaving(false);
    }
  }

  const visible = partners.filter((partner) => `${partner.code} ${partner.name} ${partner.phone || ""}`.toLocaleLowerCase("vi").includes(filter.toLocaleLowerCase("vi")));

  return (
    <main className="h-full overflow-y-auto bg-surface p-4 text-on-surface sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-balance text-2xl font-semibold">Đối tác bán lẻ</h1>
            <p className="mt-1 text-pretty text-sm text-on-surface-variant">Hồ sơ cộng tác viên, đại lý và nhà cung cấp của công ty.</p>
          </div>
          {canManage && <button type="button" onClick={startCreate} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Thêm đối tác</button>}
        </header>

        {showForm && canManage && <form onSubmit={(event) => void save(event)} className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-6" aria-busy={saving}>
          <h2 className="text-balance text-lg font-semibold">{editingId ? "Chỉnh sửa đối tác" : "Thêm đối tác"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">Mã đối tác <span aria-hidden="true">*</span><input className={fieldClass} required maxLength={60} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
            <label className="space-y-1 text-sm font-medium">Tên đối tác <span aria-hidden="true">*</span><input className={fieldClass} required maxLength={200} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label className="space-y-1 text-sm font-medium">Số điện thoại<input className={fieldClass} type="tel" maxLength={30} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label className="space-y-1 text-sm font-medium">Email<input className={fieldClass} type="email" maxLength={200} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">Địa chỉ<input className={fieldClass} maxLength={500} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
          </div>
          <fieldset className="space-y-2" aria-describedby={formError ? "retail-partner-form-error" : undefined}>
            <legend className="text-sm font-medium">Vai trò <span aria-hidden="true">*</span></legend>
            <div className="flex flex-wrap gap-4">{(Object.keys(roleLabels) as PartnerRole[]).map((role) => <label key={role} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={form.roles.includes(role)} onChange={() => toggleRole(role)} className="size-4 accent-primary" />{roleLabels[role]}</label>)}</div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            {form.roles.includes("supplier") && <label className="space-y-1 text-sm font-medium">Nhà cung cấp trong kho<select className={fieldClass} value={form.supplierId || ""} onChange={(event) => setForm({ ...form, supplierId: event.target.value })}><option value="">Chưa liên kết</option>{suppliers.map((supplier) => <option key={supplier._id} value={supplier._id}>{supplier.name} ({supplier.code})</option>)}</select></label>}
            {form.roles.includes("collaborator") && <label className="space-y-1 text-sm font-medium">Tài khoản xem sao kê<select className={fieldClass} value={form.userId || ""} onChange={(event) => setForm({ ...form, userId: event.target.value })} disabled={!!editingId && !!partners.find((item) => item._id === editingId)?.userId}><option value="">Chưa liên kết</option>{users.map((user) => <option key={user._id} value={user._id}>{user.displayName || user.email} ({user.email})</option>)}</select></label>}
            {editingId && partners.find((item) => item._id === editingId)?.userId && <p className="text-pretty text-sm text-on-surface-variant sm:col-span-2">Tài khoản đã liên kết với đối tác này và không thể đổi.</p>}
            <label className="space-y-1 text-sm font-medium">Trạng thái<select className={fieldClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Form["status"] })}><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option></select></label>
          </div>
          {formError && <p id="retail-partner-form-error" role="alert" className="text-sm text-error">{formError}</p>}
          <div className="flex flex-wrap gap-3"><button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{saving ? "Đang lưu..." : "Lưu đối tác"}</button><button type="button" onClick={() => setShowForm(false)} className="min-h-11 rounded-lg border border-outline px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary">Hủy</button></div>
        </form>}

        {error && <div role="alert" className="rounded-lg border border-error bg-surface-container-lowest p-4 text-sm text-error">{error} <button type="button" onClick={() => void load()} className="ml-2 font-semibold underline focus-visible:outline-2 focus-visible:outline-primary">Thử lại</button></div>}
        {!error && <section aria-label="Danh sách đối tác" className="space-y-3">
          {canRead && <label className="block max-w-sm space-y-1 text-sm font-medium">Tìm đối tác<input className={fieldClass} type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Mã, tên hoặc số điện thoại" /></label>}
          {loading ? <p role="status" className="text-sm text-on-surface-variant">Đang tải đối tác...</p> : visible.length ? <ul className="grid gap-3 md:grid-cols-2">{visible.map((partner) => <li key={partner._id} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-base font-semibold">{partner.name}</h2><p className="text-sm text-on-surface-variant">{partner.code}</p></div><span className="shrink-0 text-xs font-medium text-on-surface-variant">{partner.status === "active" ? "Đang hoạt động" : "Ngừng hoạt động"}</span></div>
            <p className="mt-3 text-pretty text-sm">{partner.roles.map((role) => roleLabels[role]).join(" · ")}</p>
            {partner.supplier && <p className="mt-1 text-pretty text-sm text-on-surface-variant">NCC kho: {partner.supplier.name}</p>}
            {partner.phone && <p className="mt-1 text-sm text-on-surface-variant">{partner.phone}</p>}
            {canManage && <button type="button" onClick={() => startEdit(partner)} className="mt-3 min-h-11 text-sm font-semibold text-primary underline focus-visible:outline-2 focus-visible:outline-primary">Chỉnh sửa</button>}
          </li>)}</ul> : <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-center"><p className="text-pretty text-sm text-on-surface-variant">{filter ? "Không tìm thấy đối tác phù hợp." : "Chưa có đối tác bán lẻ."}</p>{canManage && <button type="button" onClick={startCreate} className="mt-3 min-h-11 text-sm font-semibold text-primary underline focus-visible:outline-2 focus-visible:outline-primary">Thêm đối tác</button>}</div>}
        </section>}
        {!canRead && <RetailPartnerStatement />}
      </div>
    </main>
  );
}

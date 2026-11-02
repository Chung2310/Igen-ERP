import { ModuleNavigation, ModuleNavigationButton } from "../../../components/common/ModuleNavigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Handshake, Package, Pencil, Percent, Search, Store, UsersRound, X } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { apiFetch } from "../../shared/lib/apiFetch";
import { cn } from "../../student-management/lib/utils";
import { ErpCard, ErpEmptyState, ErpLoadingState, ErpPrimaryButton, ErpStatCard, erpInputClass } from "../../student-management/components/Erp/ErpUI";
import RetailCommissionPoliciesPanel from "../components/RetailCommissionPoliciesPanel";
import RetailProductCommissionsPanel from "../components/RetailProductCommissionsPanel";
import RetailPartnerStatement from "../components/RetailPartnerStatement";

type RetailPartnerRole = "collaborator" | "dealer" | "supplier";
type RetailPartner = {
  _id: string;
  code: string;
  name: string;
  roles: RetailPartnerRole[];
  phone?: string;
  email?: string;
  address?: string;
  status: "active" | "inactive";
  supplierId?: string;
  userId?: string;
  customerId?: string;
  supplier?: { name: string; code: string } | null;
};
type Supplier = { _id: string; code: string; name: string };
type PartnerUser = { _id: string; displayName?: string; email: string };
type PartnerCustomer = { _id: string; customerCode: string; name: string; phone: string };
type CommissionBalance = { partnerId: string; balance: number };
type Form = Omit<RetailPartner, "_id" | "supplier" | "roles"> & { role: RetailPartnerRole };
const initialForm: Form = { code: "", name: "", role: "collaborator", phone: "", email: "", address: "", status: "active", supplierId: "", userId: "", customerId: "" };
const roleLabels: Record<RetailPartnerRole, string> = { collaborator: "Cộng tác viên bán lẻ", dealer: "Đại lý", supplier: "Nhà cung cấp" };
const fieldClass = erpInputClass(false);

function getRetailPartnerRole(partner: RetailPartner): RetailPartnerRole {
  if (partner.userId && partner.roles.includes("collaborator")) return "collaborator";
  if (partner.supplierId && partner.roles.includes("supplier")) return "supplier";
  return partner.roles[0] || "collaborator";
}

export default function RetailPartnersPage() {
  const { userProfile, hasPermission } = useAuth();
  const companyCode = userProfile?.companyCode;
  const canManage = userProfile?.role === "admin" || userProfile?.role === "superadmin" || hasPermission("retail-partner:manage");
  const canManagePolicies = userProfile?.role === "admin" || userProfile?.role === "superadmin" || hasPermission("retail-partner-policy:manage");
  const canRead = canManage || canManagePolicies || hasPermission("retail-partner:read");
  const [partners, setPartners] = useState<RetailPartner[]>([]);
  const [commissionBalances, setCommissionBalances] = useState<Record<string, number>>({});
  const [commissionBalancesLoading, setCommissionBalancesLoading] = useState(false);
  const [commissionBalanceError, setCommissionBalanceError] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [users, setUsers] = useState<PartnerUser[]>([]);
  const [customers, setCustomers] = useState<PartnerCustomer[]>([]);
  const [form, setForm] = useState<Form>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"partners" | "policies" | "products">("partners");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RetailPartner["status"]>("all");
  const formDialogRef = useRef<HTMLDialogElement>(null);

  async function load() {
    if (!companyCode) return;
    setLoading(true);
    setError("");
    try {
      if (canRead) {
        const response = await apiFetch<{ data: RetailPartner[] }>("/retail/partners", { params: { companyCode } });
        setPartners(response.data);
        if (canManage) {
          const supplierResponse = await apiFetch<{ data: Supplier[] }>("/retail/partners/suppliers", { params: { companyCode } });
          setSuppliers(supplierResponse.data);
          const userResponse = await apiFetch<{ data: PartnerUser[] }>("/retail/partners/users", { params: { companyCode } });
          setUsers(userResponse.data);
          const customerResponse = await apiFetch<{ data: PartnerCustomer[] }>("/retail/partners/customers", { params: { companyCode } });
          setCustomers(customerResponse.data);
        }
      } else {
        const response = await apiFetch<{ data: RetailPartner }>("/retail/partners/me", { params: { companyCode } });
        setPartners([response.data]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được danh sách đối tác.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [companyCode, canRead, canManage, canManagePolicies]);

  useEffect(() => {
    if (!companyCode || !canManagePolicies) {
      setCommissionBalances({});
      setCommissionBalanceError("");
      setCommissionBalancesLoading(false);
      return;
    }
    let active = true;
    setCommissionBalancesLoading(true);
    setCommissionBalanceError("");
    void apiFetch<{ data: CommissionBalance[] }>("/retail/finance/commission/balances", { params: { companyCode } })
      .then((response) => {
        if (active) setCommissionBalances(Object.fromEntries(response.data.map((item) => [item.partnerId, item.balance])));
      })
      .catch((cause) => {
        if (active) setCommissionBalanceError(cause instanceof Error ? cause.message : "Không tải được số dư hoa hồng.");
      })
      .finally(() => { if (active) setCommissionBalancesLoading(false); });
    return () => { active = false; };
  }, [companyCode, canManagePolicies]);

  useEffect(() => {
    const dialog = formDialogRef.current;
    if (!dialog) return;
    if (showForm && canManage && !dialog.open) dialog.showModal();
    else if ((!showForm || !canManage) && dialog.open) dialog.close();
  }, [showForm, canManage]);

  function startCreate() {
    setEditingId(null);
    setForm(initialForm);
    setFormError("");
    setShowForm(true);
  }

  function startEdit(partner: RetailPartner) {
    setEditingId(partner._id);
    setForm({ code: partner.code, name: partner.name, role: getRetailPartnerRole(partner), phone: partner.phone || "", email: partner.email || "", address: partner.address || "", status: partner.status, supplierId: partner.supplierId || "", userId: partner.userId || "", customerId: partner.customerId || "" });
    setFormError("");
    setShowForm(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!companyCode || saving) return;
    setSaving(true);
    setFormError("");
    try {
      const { role, ...details } = form;
      await apiFetch(`/retail/partners${editingId ? `/${editingId}` : ""}`, {
        method: editingId ? "PATCH" : "POST",
        params: { companyCode },
        body: JSON.stringify({ ...details, supplierId: role === "supplier" ? form.supplierId : "", userId: role === "collaborator" ? form.userId : "", customerId: role === "dealer" ? form.customerId : "", roles: [role] }),
      });
      setShowForm(false);
      await load();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Không lưu được đối tác.");
    } finally {
      setSaving(false);
    }
  }

  const visible = partners.filter((partner) => {
    const matchesSearch = `${partner.code} ${partner.name} ${partner.phone || ""} ${partner.email || ""}`.toLocaleLowerCase("vi").includes(filter.toLocaleLowerCase("vi"));
    return matchesSearch && (statusFilter === "all" || partner.status === statusFilter);
  });
  const stats = [
    { name: "Tổng số đối tác", value: partners.length, icon: Handshake },
    { name: "Đang hoạt động", value: partners.filter((partner) => partner.status === "active").length, icon: CheckCircle2 },
    { name: "Cộng tác viên bán lẻ", value: partners.filter((partner) => getRetailPartnerRole(partner) === "collaborator").length, icon: UsersRound },
    { name: "Đại lý / nhà cung cấp", value: partners.filter((partner) => getRetailPartnerRole(partner) !== "collaborator").length, icon: Store },
  ];
  const getLinkedUser = (partner: RetailPartner): PartnerUser | undefined => {
    if (!partner.userId) return undefined;
    return users.find((user) => user._id === partner.userId) || (partner.userId === userProfile?.uid
      ? { _id: partner.userId, displayName: userProfile.displayName, email: userProfile.email }
      : undefined);
  };
  const getLinkedCustomer = (partner: RetailPartner) => customers.find((customer) => customer._id === partner.customerId);
  const editingPartner = partners.find((partner) => partner._id === editingId);
  const isRemovingSupplierLink = Boolean(editingPartner?.supplierId && form.role !== "supplier");
  const isRemovingUserLink = Boolean(editingPartner?.userId && form.role !== "collaborator");
  const isRemovingCustomerLink = Boolean(editingPartner?.customerId && form.role !== "dealer");
  const roleLinkHint = isRemovingSupplierLink || isRemovingUserLink || isRemovingCustomerLink
    ? "Lưu thay đổi vai trò sẽ gỡ các liên kết không còn phù hợp."
    : "";

  return (
    <main className="h-full overflow-y-auto bg-white p-6">
      <div className="space-y-6 text-left">
        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-5 w-1 shrink-0 rounded-full bg-[#00ADFC]" />
            <div>
              <h1 className="text-balance text-xl font-medium tracking-tight text-slate-900">Đối tác bán lẻ</h1>
              <p className="mt-0.5 text-pretty text-xs font-medium text-slate-500">Hồ sơ cộng tác viên bán lẻ, đại lý và nhà cung cấp của công ty.</p>
            </div>
          </div>
          {canManage && tab === "partners" && <ErpPrimaryButton type="button" onClick={startCreate} className="min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Khai báo đối tác mới</ErpPrimaryButton>}
        </header>

        {canRead && <ModuleNavigation label="Quản lý đối tác bán lẻ" activeValue={tab}>
          {([["partners", "Đối tác & hoa hồng", UsersRound], ["policies", "Chính sách", Percent], ["products", "Hoa hồng sản phẩm", Package]] as const).map(([key, label, Icon]) => <ModuleNavigationButton key={key} active={tab === key} icon={<Icon />} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</ModuleNavigationButton>)}
        </ModuleNavigation>}

        {canManage && <dialog
          ref={formDialogRef}
          aria-labelledby="retail-partner-form-title"
          aria-modal="true"
          onClose={() => setShowForm(false)}
          onCancel={(event) => { if (saving) event.preventDefault(); }}
          className="m-auto max-h-[90dvh] w-[calc(100vw-2rem)] max-w-4xl overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-4 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 sm:p-5"
        >
          <form onSubmit={(event) => void save(event)} className="space-y-4 text-left" aria-busy={saving}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-full bg-[#00ADFC]" />
                <h2 id="retail-partner-form-title" className="text-balance text-sm font-bold tracking-tight text-slate-900">{editingId ? "Cập nhật đối tác" : "Thêm đối tác mới"}</h2>
              </div>
              <button type="button" aria-label="Đóng biểu mẫu đối tác" onClick={() => setShowForm(false)} disabled={saving} className="flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"><X aria-hidden="true" className="size-4" /></button>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1"><h3 className="text-balance text-xs font-bold text-slate-800">Thông tin đối tác</h3></div>
                <label className="block space-y-1 text-xs font-semibold text-slate-900">Mã đối tác <span aria-hidden="true">*</span><input className={fieldClass} required maxLength={60} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="Nhập mã đối tác..." /></label>
                <label className="block space-y-1 text-xs font-semibold text-slate-900">Tên đối tác <span aria-hidden="true">*</span><input className={fieldClass} required maxLength={200} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nhập tên đối tác..." /></label>
                <label className="block space-y-1 text-xs font-semibold text-slate-900">Số điện thoại<input className={fieldClass} type="tel" maxLength={30} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Nhập số điện thoại..." /></label>
                <label className="block space-y-1 text-xs font-semibold text-slate-900">Địa chỉ Email<input className={fieldClass} type="email" maxLength={200} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Nhập địa chỉ email..." /></label>
                <label className="block space-y-1 text-xs font-semibold text-slate-900">Địa chỉ<input className={fieldClass} maxLength={500} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Nhập địa chỉ..." /></label>
                <label className="block space-y-1 text-xs font-semibold text-slate-900">Trạng thái hoạt động<select className={fieldClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Form["status"] })}><option value="active">Đang hoạt động</option><option value="inactive">Ngưng hoạt động</option></select></label>
              </section>
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1"><h3 className="text-balance text-xs font-bold text-slate-800">Vai trò & liên kết</h3></div>
                <fieldset className="space-y-2">
                  <legend className="text-xs font-semibold text-slate-900">Vai trò <span aria-hidden="true">*</span></legend>
                  <div className="grid gap-2">{(Object.keys(roleLabels) as RetailPartnerRole[]).map((role) => <label key={role} className={cn("flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-xs font-medium", form.role === role ? "border-[#00ADFC] bg-sky-50/50 text-slate-900" : "border-slate-200 bg-white text-slate-700")}><input type="radio" name="retail-partner-role" value={role} checked={form.role === role} onChange={() => setForm((current) => ({ ...current, role }))} className="size-4 accent-[#00ADFC]" />{roleLabels[role]}</label>)}</div>
                </fieldset>
                {roleLinkHint && <p className="text-xs text-amber-700" role="status">{roleLinkHint}</p>}
                {form.role === "supplier" && <label className="block space-y-1 text-xs font-semibold text-slate-900">Nhà cung cấp trong kho<select className={fieldClass} value={form.supplierId || ""} onChange={(event) => setForm({ ...form, supplierId: event.target.value })} disabled={!!editingPartner?.supplierId}><option value="">Chưa liên kết</option>{suppliers.map((supplier) => <option key={supplier._id} value={supplier._id}>{supplier.name} ({supplier.code})</option>)}</select>{editingPartner?.supplierId && <span className="block text-[11px] font-normal text-slate-500">Nhà cung cấp đã liên kết không thể đổi.</span>}</label>}
                {form.role === "dealer" && <label className="block space-y-1 text-xs font-semibold text-on-surface">Khách hàng liên kết công nợ<select className={fieldClass} value={form.customerId || ""} onChange={(event) => setForm({ ...form, customerId: event.target.value })} disabled={!!editingPartner?.customerId}><option value="">Chưa liên kết</option>{customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name} ({customer.customerCode})</option>)}</select>{editingPartner?.customerId && <span className="block text-xs font-normal text-on-surface-variant">Khách hàng đã liên kết với đại lý này và không thể đổi.</span>}</label>}
                {form.role === "collaborator" && <label className="block space-y-1 text-xs font-semibold text-slate-900">Tài khoản xem sao kê<select className={fieldClass} value={form.userId || ""} onChange={(event) => setForm({ ...form, userId: event.target.value })} disabled={!!editingPartner?.userId}><option value="">Chưa liên kết</option>{users.map((user) => <option key={user._id} value={user._id}>{user.displayName || user.email} ({user.email})</option>)}</select>{editingPartner?.userId && <span className="block text-[11px] font-normal text-slate-500">Tài khoản đã liên kết với đối tác này và không thể đổi.</span>}</label>}
              </section>
            </div>
            {formError && <p id="retail-partner-form-error" role="alert" className="text-xs font-medium text-rose-600">{formError}</p>}
            <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => setShowForm(false)} disabled={saving} className="min-h-9 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">Hủy</button>
              <button type="submit" disabled={saving} className="min-h-9 rounded-xl bg-[#00ADFC] px-6 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0095d9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Đang lưu..." : editingId ? "Cập nhật đối tác" : "Khai báo đối tác"}</button>
            </div>
          </form>
        </dialog>}

        {canRead && tab === "partners" && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => <ErpStatCard key={stat.name} name={stat.name} value={String(stat.value)} icon={stat.icon} />)}
        </div>}

        {error && <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs font-medium text-rose-700 sm:flex-row sm:items-center sm:justify-between">{error}<button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Thử lại</button></div>}

        {canRead && tab === "policies" && (canManagePolicies ? <RetailCommissionPoliciesPanel companyCode={companyCode} partners={partners} /> : <ErpCard className="border-outline-variant p-5 text-pretty text-sm text-on-surface-variant">Tài khoản của bạn chưa có quyền cấu hình chính sách hoa hồng bán lẻ. Vui lòng liên hệ quản trị viên.</ErpCard>)}
        {canRead && tab === "products" && (canManagePolicies ? <RetailProductCommissionsPanel companyCode={companyCode} /> : <ErpCard className="border-outline-variant p-5 text-pretty text-sm text-on-surface-variant">Tài khoản của bạn chưa có quyền cấu hình hoa hồng sản phẩm. Vui lòng liên hệ quản trị viên.</ErpCard>)}

        {!error && tab === "partners" && <section aria-label="Danh sách đối tác" className="space-y-4">
          {canRead && <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
            <label className="relative flex-1 max-w-md">
              <span className="sr-only">Tìm đối tác</span>
              <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Tìm đối tác theo mã, tên, số điện thoại hoặc email..." className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-normal text-slate-800 shadow-xs outline-none transition-all placeholder:text-slate-400 focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/10" />
            </label>
            <div role="group" aria-label="Lọc theo trạng thái" className="flex shrink-0 gap-1 overflow-x-auto rounded-xl bg-slate-100/70 p-1">
              {([ ["all", "Tất cả"], ["active", "Đang hoạt động"], ["inactive", "Ngừng hoạt động"] ] as const).map(([value, label]) => {
                const active = statusFilter === value;
                return <button key={value} type="button" aria-pressed={active} onClick={() => setStatusFilter(value)} className={cn("cursor-pointer whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", active ? "bg-[#00ADFC] font-semibold text-white shadow-xs" : "font-medium text-slate-600 hover:bg-white/80 hover:text-slate-900")}>{label}</button>;
              })}
            </div>
          </div>}

          <ErpCard className="overflow-hidden border border-slate-200/80">
            {loading ? <div role="status" aria-live="polite"><ErpLoadingState message="Đang tải danh sách đối tác..." /></div> : visible.length === 0 ? <>
              <ErpEmptyState icon={Handshake} title={filter || statusFilter !== "all" ? "Không tìm thấy đối tác nào" : "Chưa có đối tác bán lẻ"} subtitle={filter || statusFilter !== "all" ? "Không có đối tác khớp với nội dung tìm kiếm hoặc trạng thái đã chọn." : "Khai báo đối tác để quản lý cộng tác viên, đại lý và nhà cung cấp bán lẻ."} />
              {canManage && !(filter || statusFilter !== "all") && <div className="flex justify-center pb-8"><ErpPrimaryButton type="button" onClick={startCreate} className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Khai báo đối tác mới</ErpPrimaryButton></div>}
              {(filter || statusFilter !== "all") && <div className="flex justify-center pb-8"><button type="button" onClick={() => { setFilter(""); setStatusFilter("all"); }} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Xóa bộ lọc</button></div>}
            </> : <>
              <ul className="flex flex-col gap-3 bg-slate-50/50 p-4 md:hidden">
                {visible.map((partner) => {
                  const linkedUser = getLinkedUser(partner);
                  const role = getRetailPartnerRole(partner);
                  return <li key={partner._id} className="flex flex-col gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col"><span className="truncate text-sm font-semibold text-slate-900">{partner.name}</span><span className="mt-0.5 text-xs font-normal text-slate-500">Mã: {partner.code}</span></div>
                    <span className={cn("shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold", partner.status === "active" ? "border-sky-100 bg-sky-50 text-[#007EB8]" : "border-slate-200 bg-slate-100 text-slate-600")}>{partner.status === "active" ? "Đang hoạt động" : "Ngừng hoạt động"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/60 bg-slate-50 p-2.5 text-xs text-slate-700">
                    <div className="flex min-w-0 flex-col gap-0.5"><span className="text-[11px] font-medium text-slate-500">Vai trò</span><span className="truncate text-xs font-semibold text-slate-900">{roleLabels[role]}</span></div>
                    {role === "supplier" && <div className="flex min-w-0 flex-col gap-0.5 text-right"><span className="text-[11px] font-medium text-slate-500">Nhà cung cấp kho</span><span className="truncate text-xs font-semibold text-slate-900">{partner.supplier ? `${partner.supplier.name} (${partner.supplier.code})` : partner.supplierId ? "Đã liên kết kho" : "Chưa liên kết"}</span></div>}
                    {role === "dealer" && <div className="flex min-w-0 flex-col gap-0.5 text-right"><span className="text-[11px] font-medium text-on-surface-variant">Khách hàng công nợ</span><span className="truncate text-xs font-semibold text-on-surface">{getLinkedCustomer(partner)?.name || (partner.customerId ? "Đã liên kết" : "Chưa liên kết")}</span></div>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-slate-200/50 bg-white p-2"><span className="text-[11px] font-medium text-slate-500">Điện thoại</span><span className="truncate font-semibold text-slate-900">{partner.phone || "Chưa cập nhật"}</span></div>
                    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-slate-200/50 bg-white p-2"><span className="text-[11px] font-medium text-slate-500">Email</span><span className="truncate font-semibold text-slate-900">{partner.email || "Chưa cập nhật"}</span></div>
                    <div className="col-span-2 flex min-w-0 flex-col gap-0.5 rounded-xl border border-slate-200/50 bg-white p-2"><span className="text-[11px] font-medium text-slate-500">Địa chỉ</span><span className="line-clamp-2 font-semibold text-slate-900">{partner.address || "Chưa cập nhật"}</span></div>
                    {role === "collaborator" && <div className="col-span-2 flex min-w-0 flex-col gap-0.5 rounded-xl border border-slate-200/50 bg-white p-2"><span className="text-[11px] font-medium text-slate-500">Tài khoản xem sao kê</span><span className="truncate font-semibold text-slate-900">{linkedUser?.displayName || linkedUser?.email || (partner.userId ? "Đã liên kết tài khoản" : "Chưa liên kết")}</span>{linkedUser?.displayName && linkedUser.email && <span className="truncate text-[11px] text-slate-500">{linkedUser.email}</span>}</div>}
                    {canManagePolicies && role === "collaborator" && <div className="col-span-2 flex min-w-0 flex-col gap-0.5 rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-2"><span className="text-[11px] font-medium text-emerald-800">Số dư hoa hồng</span><span className="truncate text-sm font-bold tabular-nums text-emerald-900">{commissionBalancesLoading ? "Đang tải..." : commissionBalanceError ? "Không tải được" : new Intl.NumberFormat("vi-VN").format(commissionBalances[partner._id] || 0) + " ₫"}</span><span className="text-[10px] text-emerald-800/80">Hoa hồng đã ghi sổ trừ các khoản đảo và chi trả</span></div>}
                  </div>
                  {canManage && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                    {canManage && <button type="button" onClick={() => startEdit(partner)} aria-label={`Chỉnh sửa ${partner.name}`} className="flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><Pencil aria-hidden="true" className="size-3.5 text-slate-500" />Chỉnh sửa</button>}
                  </div>}
                </li>;
                })}
              </ul>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-max text-left text-xs">
                  <thead><tr className="border-b border-slate-200/80 bg-slate-50/70 text-xs font-semibold text-slate-600">
                    <th scope="col" className="px-3.5 py-3 text-left font-semibold text-slate-700">Mã & tên đối tác</th>
                    <th scope="col" className="px-3.5 py-3 text-left font-semibold text-slate-700">Vai trò</th>
                    <th scope="col" className="px-3.5 py-3 text-left font-semibold text-slate-700">Liên hệ</th>
                    <th scope="col" className="px-3.5 py-3 text-left font-semibold text-slate-700">Địa chỉ</th>
                    <th scope="col" className="px-3.5 py-3 text-left font-semibold text-slate-700">Liên kết dữ liệu</th>
                    <th scope="col" className="px-3.5 py-3 text-left font-semibold text-slate-700">Tài khoản sao kê</th>
                    {canManagePolicies && <th scope="col" className="px-3.5 py-3 text-right font-semibold text-slate-700">Số dư hoa hồng</th>}
                    <th scope="col" className="px-3.5 py-3 text-center font-semibold text-slate-700">Trạng thái</th>
                    {canManage && <th scope="col" className="px-3.5 py-3 text-center font-semibold text-slate-700">Hành động</th>}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {visible.map((partner) => {
                      const linkedUser = getLinkedUser(partner);
                      const role = getRetailPartnerRole(partner);
                      return <tr key={partner._id} className="text-slate-700 transition-colors hover:bg-slate-50/60">
                      <td className="px-3.5 py-3"><div className="text-xs font-semibold text-slate-900">{partner.name}</div><div className="mt-0.5 text-[11px] font-normal text-slate-500">{partner.code}</div></td>
                      <td className="px-3.5 py-3"><span className="inline-block rounded-full border border-slate-200/60 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">{roleLabels[role]}</span></td>
                      <td className="px-3.5 py-3"><div className="text-xs font-medium text-slate-800">{partner.phone || "Chưa có số điện thoại"}</div><div className="mt-0.5 text-[11px] font-normal text-slate-500">{partner.email || "Chưa có email"}</div></td>
                      <td className="max-w-64 px-3.5 py-3 text-xs text-slate-600">{partner.address || "Chưa cập nhật"}</td>
                      <td className="px-3.5 py-3 text-xs text-slate-600">{role === "supplier" ? partner.supplier ? `${partner.supplier.name} (${partner.supplier.code})` : partner.supplierId ? "Đã liên kết kho" : "Chưa liên kết" : role === "dealer" ? getLinkedCustomer(partner)?.name || (partner.customerId ? "Đã liên kết khách hàng" : "Chưa liên kết khách hàng") : "—"}</td>
                      <td className="px-3.5 py-3">{role === "collaborator" ? <><div className="text-xs font-medium text-slate-800">{linkedUser?.displayName || linkedUser?.email || (partner.userId ? "Đã liên kết tài khoản" : "Chưa liên kết")}</div>{linkedUser?.displayName && linkedUser.email && <div className="mt-0.5 text-[11px] text-slate-500">{linkedUser.email}</div>}</> : <span className="text-slate-500">—</span>}</td>
                      {canManagePolicies && <td className="px-3.5 py-3 text-right font-semibold tabular-nums text-emerald-800">{role === "collaborator" ? commissionBalancesLoading ? "Đang tải..." : commissionBalanceError ? "—" : new Intl.NumberFormat("vi-VN").format(commissionBalances[partner._id] || 0) + " ₫" : "—"}</td>}
                      <td className="px-3.5 py-3 text-center"><span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", partner.status === "active" ? "border-sky-100 bg-sky-50 text-[#007EB8]" : "border-slate-200 bg-slate-100 text-slate-600")}>{partner.status === "active" ? "Đang hoạt động" : "Ngừng hoạt động"}</span></td>
                      {canManage && <td className="px-3.5 py-3 text-center"><div className="flex items-center justify-center gap-1">
                        {canManage && <button type="button" onClick={() => startEdit(partner)} aria-label={`Chỉnh sửa ${partner.name}`} title={`Chỉnh sửa ${partner.name}`} className="min-h-9 min-w-9 rounded-lg p-1.5 text-slate-500 hover:bg-sky-50 hover:text-[#00ADFC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><Pencil aria-hidden="true" className="size-3.5" /></button>}
                      </div></td>}
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </>}
          </ErpCard>
          {canManagePolicies && commissionBalanceError && <p role="alert" className="text-xs font-medium text-rose-600">Không tải được số dư hoa hồng: {commissionBalanceError}</p>}
        </section>}
        {!canRead && <RetailPartnerStatement />}
      </div>
    </main>
  );
}

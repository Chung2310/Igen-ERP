import React from "react";
import { Plus, Settings, Users, Trash2, Save, AlertTriangle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { customerApi } from "./customerApi";
import CustomerDetailPage from "./components/CustomerDetailPage";
import CustomerRetailPoliciesPanel from "./components/CustomerRetailPoliciesPanel";
import CustomerFormDialog from "./components/CustomerFormDialog";
import CustomerList from "./components/CustomerList";
import { cn } from "../student-management/lib/utils";
import type { BillingProfileInput, Customer, CustomerInput, CustomerStatus, CustomerType, PaginatedCustomers } from "./types";

const emptyResult: PaginatedCustomers = { items: [], total: 0, page: 1, limit: 20 };

export default function CustomerWorkspace() {
  const { user, userProfile } = useAuth();
  const { activeBranchId } = useBranch();
  const companyCode = userProfile?.companyCode || '';
  if (!companyCode) return <p role="status" className="text-sm text-on-surface-variant">Chọn doanh nghiệp để quản lý khách hàng.</p>;
  return <CustomerWorkspaceContent key={`${companyCode}:${activeBranchId}:${user?.uid || userProfile?.email || ''}`} />;
}

function CustomerWorkspaceContent() {
  const { userProfile } = useAuth();
  const { activeBranchId } = useBranch();
  const companyCode = userProfile?.companyCode?.trim().toUpperCase() || "";
  const permissions = userProfile?.permissions || [];
  const isAdmin = userProfile?.role === "admin" || userProfile?.role === "superadmin" || permissions.includes("*");
  const canManage = isAdmin || permissions.includes("customer:manage");
  const canRetailRead = isAdmin || permissions.includes("retail:manage");
  const canManagePoints = isAdmin || permissions.includes("retail-points:manage");
  const [activeTab, setActiveTab] = React.useState<"list" | "settings">("list");
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [status, setStatus] = React.useState<CustomerStatus>("active");
  const [type, setType] = React.useState<"" | CustomerType>("");
  const [page, setPage] = React.useState(1);
  const [result, setResult] = React.useState(emptyResult);
  const [selected, setSelected] = React.useState<Customer | null>(null);
  const [editing, setEditing] = React.useState<Customer | "new" | null>(null);
  const [error, setError] = React.useState("");
  const listRequest = React.useRef(0);
  const detailRequest = React.useRef(0);
  const [settingsMessage, setSettingsMessage] = React.useState("");

  // Settings state
  const [settings, setSettings] = React.useState<{ companyCode: string; customerTiers: Array<{ code: string; name: string; minSpend: number }> } | null>(null);
  const [loadingSettings, setLoadingSettings] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!companyCode) return;
    const requestId = ++listRequest.current;
    try {
      const nextResult = await customerApi.list({ companyCode, q: debouncedQuery, status, type: type || undefined, page, limit: 20 });
      if (requestId !== listRequest.current) return;
      setResult(nextResult);
      setError("");
    } catch (cause) {
      if (requestId !== listRequest.current) return;
      setError(cause instanceof Error ? cause.message : "Không tải được danh sách khách hàng.");
    }
  }, [companyCode, debouncedQuery, status, type, page]);

  const loadSettings = React.useCallback(async () => {
    if (!companyCode) return;
    setLoadingSettings(true);
    setError("");
    try {
      const data = await customerApi.getSettings(companyCode);
      setSettings(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được cấu hình phân hạng.");
    } finally {
      setLoadingSettings(false);
    }
  }, [companyCode]);

  React.useEffect(() => {
    if (activeTab === "list") {
      void load();
    } else {
      void loadSettings();
    }
  }, [activeTab, load, loadSettings]);

  const openDetail = async (customer: Customer) => {
    const requestId = ++detailRequest.current;
    try { const detail = await customerApi.detail(customer._id, companyCode); if (requestId === detailRequest.current) setSelected(detail); }
    catch (cause) { if (requestId === detailRequest.current) setError(cause instanceof Error ? cause.message : "Không tải được hồ sơ khách hàng."); }
  };

  const handleUpdateTier = (index: number, field: "code" | "name" | "minSpend", value: any) => {
    if (!settings) return;
    const newTiers = settings.customerTiers.map((tier, itemIndex) => {
      if (itemIndex === index) {
        if (field === "code") {
          return { ...tier, [field]: String(value).toLowerCase().replace(/[^a-z0-9-]/g, "") };
        }
        return { ...tier, [field]: value };
      }
      return tier;
    });
    setSettings({ ...settings, customerTiers: newTiers });
  };

  const handleAddTier = () => {
    if (!settings) return;
    const newTiers = [
      ...settings.customerTiers,
      { code: `tier-${settings.customerTiers.length + 1}`, name: `Hạng mới ${settings.customerTiers.length + 1}`, minSpend: 0 }
    ];
    setSettings({ ...settings, customerTiers: newTiers });
  };

  const handleRemoveTier = (index: number) => {
    if (!settings || index === 0) return;
    const newTiers = settings.customerTiers.filter((_, itemIndex) => itemIndex !== index);
    setSettings({ ...settings, customerTiers: newTiers });
  };

  const saveSettings = async () => {
    if (!settings || !companyCode) return;
    setSavingSettings(true);
    setError("");
    setSettingsMessage("");
    try {
      const data = await customerApi.updateSettings({ customerTiers: settings.customerTiers }, companyCode);
      setSettings(data);
      setSettingsMessage("Đã lưu cấu hình phân hạng khách hàng.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được cấu hình phân hạng.");
    } finally {
      setSavingSettings(false);
    }
  };

  const saveCustomer = async (target: Customer | "new", input: CustomerInput, billingProfile?: BillingProfileInput) => {
    const saved = target === "new"
      ? await customerApi.create(input, companyCode)
      : await customerApi.update(target._id, input, target.version, companyCode);
    let refreshed = saved;
    let billingError = "";
    if (billingProfile) {
      try {
        await customerApi.createBillingProfile(saved._id, billingProfile, companyCode);
        refreshed = await customerApi.detail(saved._id, companyCode);
      } catch (cause) {
        billingError = cause instanceof Error ? cause.message : "Không lưu được hồ sơ VAT.";
      }
    }
    setEditing(null);
    setSelected(refreshed);
    await load();
    if (billingError) setError(`Đã lưu khách hàng nhưng chưa hoàn tất hồ sơ VAT: ${billingError}`);
  };

  if (selected) return <>
    <CustomerDetailPage
      customer={selected}
      branchId={activeBranchId}
      canManage={canManage}
      canRetailRead={canRetailRead}
      canManagePoints={canManagePoints}
      actionError={error}
      onBack={() => { detailRequest.current++; setSelected(null); }}
      onEdit={() => setEditing(selected)}
      onBillingProfileCreated={async () => {
        await load();
        try { setSelected(await customerApi.detail(selected._id, companyCode)); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "Không làm mới được hồ sơ khách hàng."); }
      }}
      onToggleStatus={() => { setError(""); void customerApi
        .setStatus(selected._id, selected.status === "active" ? "inactive" : "active", selected.version, companyCode)
        .then((updated) => { setSelected(updated); void load(); })
        .catch((cause) => setError(cause instanceof Error ? cause.message : "Không cập nhật được trạng thái.")); }}
    />
    {editing && editing !== "new" && <CustomerFormDialog
      customer={editing}
      onClose={() => setEditing(null)}
      onSave={(input, billingProfile) => saveCustomer(editing, input, billingProfile)}
    />}
  </>;

  return (
    <section className="mx-auto w-full max-w-screen-2xl space-y-5 px-4 py-5 text-on-surface sm:px-6 sm:py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-1 h-8 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-semibold text-on-surface text-balance">Quản lý khách hàng</h1>
            <p className="mt-1 text-sm text-on-surface-variant text-pretty">Hồ sơ khách hàng dùng chung trong toàn công ty.</p>
          </div>
        </div>
        {canManage && activeTab === "list" && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Plus className="h-4 w-4" />Thêm khách hàng
          </button>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("list")}
          aria-current={activeTab === "list" ? "page" : undefined}
          className={cn("flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-primary", activeTab === "list" ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-container")}
        >
          <Users className="h-4 w-4" />
          Danh sách khách hàng
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          aria-current={activeTab === "settings" ? "page" : undefined}
          className={cn("flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-primary", activeTab === "settings" ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-container")}
        >
          <Settings className="h-4 w-4" />
          Cài đặt khách hàng
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-error bg-error-container p-4 text-sm text-on-error-container">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      {settingsMessage && activeTab === "settings" && <p role="status" className="rounded-xl border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface">{settingsMessage}</p>}

      {activeTab === "list" ? (
        <>
          <CustomerList
            {...result}
            query={query}
            status={status}
            type={type}
            onQueryChange={(value) => { setQuery(value); setPage(1); }}
            onStatusChange={(value) => { setStatus(value); setPage(1); }}
            onTypeChange={(value) => { setType(value); setPage(1); }}
            onPageChange={setPage}
            onOpen={(customer) => void openDetail(customer)}
          />
          {editing && (
            <CustomerFormDialog
              customer={editing === "new" ? undefined : editing}
              onClose={() => setEditing(null)}
              onSave={(input, billingProfile) => saveCustomer(editing, input, billingProfile)}
            />
          )}
        </>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-on-surface text-balance">Cấu hình phân cấp và mốc chi tiêu khách hàng</h2>
              <p className="mt-1 text-sm leading-relaxed text-on-surface-variant text-pretty">
                Các bậc xếp hạng sẽ được tự động áp dụng dựa trên tổng doanh số mua hàng tích lũy của khách hàng.
                Mốc đầu tiên bắt đầu từ 0 chi tiêu. Các mốc tiếp theo phải có mức chi tiêu lớn hơn bậc trước đó.
              </p>
            </div>
            {canManage && settings && !loadingSettings && (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddTier}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-outline-variant px-3.5 py-2 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <Plus className="h-4 w-4" />
                  Thêm bậc
                </button>
                <button
                  type="button"
                  onClick={() => void saveSettings()}
                  disabled={savingSettings}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {savingSettings ? "Đang lưu..." : "Lưu cài đặt phân hạng"}
                </button>
              </div>
            )}
          </div>

          {loadingSettings ? (
            <div role="status" className="py-12 text-center text-on-surface-variant">Đang tải cấu hình phân hạng...</div>
          ) : settings ? (
            <div className="max-w-5xl space-y-4">
              <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant bg-surface-container-low text-xs font-semibold text-on-surface-variant">
                      <th className="px-5 py-3">Mã hạng</th>
                      <th className="px-5 py-3">Tên hạng</th>
                      <th className="px-5 py-3">Chi tiêu tối thiểu (VNĐ)</th>
                      {canManage && <th className="px-5 py-3 text-right">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {settings.customerTiers.map((tier, index) => (
                      <tr key={index} className="border-b border-outline-variant last:border-0 transition hover:bg-surface-container-low">
                        <td className="px-5 py-3">
                          <input
                            aria-label={`Mã hạng ${index + 1}`}
                            disabled={!canManage}
                            className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-mono text-on-surface outline-none focus-visible:outline-2 focus-visible:outline-primary disabled:bg-surface-container-low"
                            value={tier.code}
                            onChange={(e) => handleUpdateTier(index, "code", e.target.value)}
                            placeholder="vd: standard, gold, vip"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <input
                            aria-label={`Tên hạng ${index + 1}`}
                            disabled={!canManage}
                            className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface outline-none focus-visible:outline-2 focus-visible:outline-primary disabled:bg-surface-container-low"
                            value={tier.name}
                            onChange={(e) => handleUpdateTier(index, "name", e.target.value)}
                            placeholder="Tên hiển thị"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <input
                            aria-label={`Ngưỡng hạng ${tier.name}`}
                            type="number"
                            min="0"
                            step="1"
                            disabled={!canManage || index === 0}
                            className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-semibold tabular-nums text-on-surface outline-none focus-visible:outline-2 focus-visible:outline-primary disabled:bg-surface-container-low"
                            value={tier.minSpend}
                            onChange={(e) => handleUpdateTier(index, "minSpend", Number(e.target.value))}
                          />
                        </td>
                        {canManage && (
                          <td className="px-5 py-3 text-right">
                            {index > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleRemoveTier(index)}
                                className="rounded-lg p-2 text-error hover:bg-error-container focus-visible:outline-2 focus-visible:outline-primary"
                                title="Xóa phân hạng này"
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </button>
                            ) : (
                              <span className="select-none pr-2 text-xs font-medium text-on-surface-variant">Mặc định</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-outline-variant py-12 text-center text-on-surface-variant">Không tìm thấy dữ liệu cấu hình.</div>
          )}
          <CustomerRetailPoliciesPanel companyCode={companyCode} branchId={activeBranchId} canRead={canRetailRead} canManagePoints={canManagePoints} />
        </div>
      )}
    </section>
  );
}

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
import { ModuleNavigation, ModuleNavigationButton } from "../../components/common/ModuleNavigation";
import { primaryCreateButtonClass } from "../../components/common/primaryCreateButton";
import type { BillingProfileInput, Customer, CustomerInput, CustomerStatus, CustomerType, PaginatedCustomers } from "./types";

const emptyResult: PaginatedCustomers = { items: [], total: 0, page: 1, limit: 20 };
type CustomerTierSetting = { code: string; name: string; minGrossProfit: number; minSpend?: number };

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
  const [settings, setSettings] = React.useState<{ companyCode: string; customerTiers: CustomerTierSetting[] } | null>(null);
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
      setSettings({
        ...data,
        customerTiers: data.customerTiers.map((tier) => ({
          ...tier,
          minGrossProfit: Number(tier.minGrossProfit ?? tier.minSpend ?? 0),
        })),
      });
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

  const handleUpdateTier = (index: number, field: "code" | "name" | "minGrossProfit", value: any) => {
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
      { code: `tier-${settings.customerTiers.length + 1}`, name: `Hạng mới ${settings.customerTiers.length + 1}`, minGrossProfit: 0 }
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
      const data = await customerApi.updateSettings({
        customerTiers: settings.customerTiers.map(({ code, name, minGrossProfit }) => ({ code, name, minGrossProfit })),
      }, companyCode);
      setSettings({
        ...data,
        customerTiers: data.customerTiers.map((tier) => ({
          ...tier,
          minGrossProfit: Number(tier.minGrossProfit ?? tier.minSpend ?? 0),
        })),
      });
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
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-surface text-on-surface">
      <ModuleNavigation label="Mục Khách hàng" activeValue={activeTab}>
        <ModuleNavigationButton active={activeTab === "list"} icon={<Users />} onClick={() => setActiveTab("list")}>Danh sách khách hàng</ModuleNavigationButton>
        <ModuleNavigationButton active={activeTab === "settings"} icon={<Settings />} onClick={() => setActiveTab("settings")}>Cài đặt khách hàng</ModuleNavigationButton>
      </ModuleNavigation>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-md border border-outline-variant bg-surface-container-lowest p-3 shadow-xs sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 h-6 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <div>
            <h1 className="text-lg font-semibold text-on-surface text-balance">Quản lý khách hàng</h1>
          </div>
        </div>
        {canManage && activeTab === "list" && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className={primaryCreateButtonClass}
          >
            <Plus className="h-4 w-4" />Thêm khách hàng
          </button>
        )}
        {canManage && activeTab === "settings" && settings && !loadingSettings && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAddTier}
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-sm font-medium text-on-surface transition hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Thêm bậc
            </button>
            <button
              type="button"
              onClick={() => void saveSettings()}
              disabled={savingSettings}
              className={primaryCreateButtonClass}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {savingSettings ? "Đang lưu..." : "Lưu cài đặt phân hạng"}
            </button>
          </div>
        )}
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
        <div className="space-y-3">
          {loadingSettings ? (
            <div role="status" className="py-12 text-center text-on-surface-variant">Đang tải cấu hình phân hạng...</div>
          ) : settings ? (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-md border border-outline-variant bg-surface-container-lowest">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant bg-surface-container-low text-xs font-semibold text-on-surface-variant">
                      <th className="px-3 py-2">Mã hạng</th>
                      <th className="px-3 py-2">Tên hạng</th>
                      <th className="px-3 py-2">Lợi nhuận gộp tối thiểu (VNĐ)</th>
                      {canManage && <th className="px-3 py-2 text-right">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {settings.customerTiers.map((tier, index) => (
                      <tr key={index} className="border-b border-outline-variant last:border-0 transition hover:bg-surface-container-low">
                        <td className="px-3 py-2">
                          <input
                            aria-label={`Mã hạng ${index + 1}`}
                            disabled={!canManage}
                            className="h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-on-surface outline-none focus-visible:outline-2 focus-visible:outline-primary disabled:bg-surface-container-low"
                            value={tier.code}
                            onChange={(e) => handleUpdateTier(index, "code", e.target.value)}
                            placeholder="vd: standard, gold, vip"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            aria-label={`Tên hạng ${index + 1}`}
                            disabled={!canManage}
                            className="h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-on-surface outline-none focus-visible:outline-2 focus-visible:outline-primary disabled:bg-surface-container-low"
                            value={tier.name}
                            onChange={(e) => handleUpdateTier(index, "name", e.target.value)}
                            placeholder="Tên hiển thị"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            aria-label={`Ngưỡng hạng ${tier.name}`}
                            type="number"
                            min="0"
                            step="1"
                            disabled={!canManage || index === 0}
                            className="h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 font-semibold tabular-nums text-on-surface outline-none focus-visible:outline-2 focus-visible:outline-primary disabled:bg-surface-container-low"
                            value={tier.minGrossProfit}
                            onChange={(e) => handleUpdateTier(index, "minGrossProfit", Number(e.target.value))}
                          />
                        </td>
                        {canManage && (
                          <td className="px-3 py-2 text-right">
                            {index > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleRemoveTier(index)}
                                className="rounded-md p-2 text-error hover:bg-error-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                title="Xóa phân hạng này"
                                aria-label={`Xóa phân hạng ${tier.name}`}
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
            <div className="rounded-md border border-dashed border-outline-variant py-12 text-center text-on-surface-variant">Không tìm thấy dữ liệu cấu hình.</div>
          )}
          <CustomerRetailPoliciesPanel companyCode={companyCode} branchId={activeBranchId} canRead={canRetailRead} canManagePoints={canManagePoints} />
        </div>
      )}
      </div>
    </section>
  );
}

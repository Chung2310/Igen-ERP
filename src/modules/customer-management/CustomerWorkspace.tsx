import React from "react";
import { Plus, Settings, Users, Trash2, Save, AlertTriangle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { customerApi } from "./customerApi";
import CustomerDetailDrawer from "./components/CustomerDetailDrawer";
import CustomerFormDialog from "./components/CustomerFormDialog";
import CustomerList from "./components/CustomerList";
import type { Customer, CustomerInput, CustomerStatus, CustomerType, PaginatedCustomers } from "./types";

const emptyResult: PaginatedCustomers = { items: [], total: 0, page: 1, limit: 20 };

export default function CustomerWorkspace() {
  const { userProfile } = useAuth();
  const { activeBranchId } = useBranch();
  const companyCode = userProfile?.companyCode?.trim().toUpperCase() || "";
  const permissions = userProfile?.permissions || [];
  const canManage = userProfile?.role === "admin" || userProfile?.role === "superadmin" || permissions.includes("*") || permissions.includes("customer:manage");
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

  // Settings state
  const [settings, setSettings] = React.useState<{ companyCode: string; customerTiers: Array<{ code: string; name: string; minSpend: number }> } | null>(null);
  const [loadingSettings, setLoadingSettings] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!companyCode) return;
    try {
      setResult(await customerApi.list({ companyCode, q: debouncedQuery, status, type: type || undefined, page, limit: 20 }));
      setError("");
    } catch (cause) {
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
    try { setSelected(await customerApi.detail(customer._id, companyCode)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được hồ sơ khách hàng."); }
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
    try {
      const data = await customerApi.updateSettings({ customerTiers: settings.customerTiers }, companyCode);
      setSettings(data);
      alert("Đã lưu cấu hình phân hạng khách hàng thành công!");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được cấu hình phân hạng.");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-5 text-slate-800 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-1 h-8 w-1 shrink-0 rounded-full bg-[#00adfc]" aria-hidden="true" />
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Quản lý khách hàng</h1>
            <p className="mt-1 text-sm text-slate-500">Hồ sơ khách hàng dùng chung trong toàn công ty.</p>
          </div>
        </div>
        {canManage && activeTab === "list" && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00ADFC] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0095d9]"
          >
            <Plus className="h-4 w-4" />Thêm khách hàng
          </button>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("list")}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "list"
              ? "bg-[#e8f7ff] text-[#007eb8]"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          }`}
        >
          <Users className="h-4 w-4" />
          Danh sách khách hàng
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "settings"
              ? "bg-[#e8f7ff] text-[#007eb8]"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          }`}
        >
          <Settings className="h-4 w-4" />
          Cài đặt phân hạng
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2 border border-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

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
          {selected && (
            <CustomerDetailDrawer
              customer={selected}
              branchId={activeBranchId}
              canManage={canManage}
              onClose={() => setSelected(null)}
              onEdit={() => setEditing(selected)}
              onToggleStatus={() =>
                void customerApi
                  .setStatus(selected._id, selected.status === "active" ? "inactive" : "active", selected.version, companyCode)
                  .then((updated) => {
                    setSelected(updated);
                    void load();
                  })
                  .catch((cause) => setError(cause instanceof Error ? cause.message : "Không cập nhật được trạng thái."))
              }
            />
          )}
          {editing && (
            <CustomerFormDialog
              customer={editing === "new" ? undefined : editing}
              onClose={() => setEditing(null)}
              onSave={async (input: CustomerInput) => {
                const saved = editing === "new" ? await customerApi.create(input, companyCode) : await customerApi.update(editing._id, input, editing.version, companyCode);
                setEditing(null);
                setSelected(saved);
                await load();
              }}
            />
          )}
        </>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-slate-900">Cấu hình phân cấp và mốc chi tiêu khách hàng</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                Các bậc xếp hạng sẽ được tự động áp dụng dựa trên tổng doanh số mua hàng tích lũy của khách hàng.
                Mốc đầu tiên bắt đầu từ 0 chi tiêu. Các mốc tiếp theo phải có mức chi tiêu lớn hơn bậc trước đó.
              </p>
            </div>
            {canManage && settings && !loadingSettings && (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddTier}
                  className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-sm font-semibold text-[#007EB8] transition hover:bg-sky-100"
                >
                  <Plus className="h-4 w-4" />
                  Thêm bậc
                </button>
                <button
                  type="button"
                  onClick={() => void saveSettings()}
                  disabled={savingSettings}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#00ADFC] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0095d9] disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {savingSettings ? "Đang lưu..." : "Lưu cài đặt phân hạng"}
                </button>
              </div>
            )}
          </div>

          {loadingSettings ? (
            <div className="text-center py-12 text-slate-500">Đang tải cấu hình phân hạng...</div>
          ) : settings ? (
            <div className="max-w-5xl space-y-4">
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold text-slate-600">
                      <th className="px-5 py-3">Mã hạng</th>
                      <th className="px-5 py-3">Tên hạng</th>
                      <th className="px-5 py-3">Chi tiêu tối thiểu (VNĐ)</th>
                      {canManage && <th className="px-5 py-3 text-right">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {settings.customerTiers.map((tier, index) => (
                      <tr key={index} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition">
                        <td className="px-5 py-3">
                          <input
                            aria-label={`Mã hạng ${index + 1}`}
                            disabled={!canManage}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-slate-800 outline-none focus:border-[#00adfc] focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"
                            value={tier.code}
                            onChange={(e) => handleUpdateTier(index, "code", e.target.value)}
                            placeholder="vd: standard, gold, vip"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <input
                            aria-label={`Tên hạng ${index + 1}`}
                            disabled={!canManage}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 outline-none focus:border-[#00adfc] focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"
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
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 outline-none focus:border-[#00adfc] focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"
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
                                className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                                title="Xóa phân hạng này"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium select-none pr-2">Mặc định</span>
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
            <div className="text-slate-500 text-center py-12 border border-dashed rounded-2xl">Không tìm thấy dữ liệu cấu hình.</div>
          )}
        </div>
      )}
    </section>
  );
}

import React from "react";
import { Plus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { customerApi } from "./customerApi";
import CustomerDetailDrawer from "./components/CustomerDetailDrawer";
import CustomerFormDialog from "./components/CustomerFormDialog";
import CustomerList from "./components/CustomerList";
import type { Customer, CustomerInput, CustomerStatus, CustomerType, PaginatedCustomers } from "./types";

const emptyResult: PaginatedCustomers = { items: [], total: 0, page: 1, limit: 20 };

export default function CustomerWorkspace() {
  const { userProfile } = useAuth();
  const companyCode = userProfile?.companyCode?.trim().toUpperCase() || "";
  const permissions = userProfile?.permissions || [];
  const canManage = userProfile?.role === "admin" || userProfile?.role === "superadmin" || permissions.includes("*") || permissions.includes("customer:manage");
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [status, setStatus] = React.useState<CustomerStatus>("active");
  const [type, setType] = React.useState<"" | CustomerType>("");
  const [page, setPage] = React.useState(1);
  const [result, setResult] = React.useState(emptyResult);
  const [selected, setSelected] = React.useState<Customer | null>(null);
  const [editing, setEditing] = React.useState<Customer | "new" | null>(null);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    if (!companyCode) return;
    try {
      setResult(await customerApi.list({ companyCode, q: debouncedQuery, status, type: type || undefined, page, limit: 20 }));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được danh sách khách hàng.");
    }
  }, [companyCode, debouncedQuery, status, type, page]);
  React.useEffect(() => { void load(); }, [load]);

  const openDetail = async (customer: Customer) => {
    try { setSelected(await customerApi.detail(customer._id, companyCode)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được hồ sơ khách hàng."); }
  };

  return <section className="space-y-5 p-4 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold text-slate-900">Quản lý khách hàng</h1><p className="mt-1 text-sm text-slate-500">Hồ sơ khách hàng dùng chung trong toàn công ty.</p></div>{canManage && <button type="button" onClick={() => setEditing("new")} className="flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4" />Thêm khách hàng</button>}</div>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <CustomerList {...result} query={query} status={status} type={type} onQueryChange={(value) => { setQuery(value); setPage(1); }} onStatusChange={(value) => { setStatus(value); setPage(1); }} onTypeChange={(value) => { setType(value); setPage(1); }} onPageChange={setPage} onOpen={(customer) => void openDetail(customer)} />
    {selected && <CustomerDetailDrawer customer={selected} canManage={canManage} onClose={() => setSelected(null)} onEdit={() => setEditing(selected)} onToggleStatus={() => void customerApi.setStatus(selected._id, selected.status === "active" ? "inactive" : "active", selected.version, companyCode).then((updated) => { setSelected(updated); void load(); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Không cập nhật được trạng thái."))} />}
    {editing && <CustomerFormDialog customer={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSave={async (input: CustomerInput) => { const saved = editing === "new" ? await customerApi.create(input, companyCode) : await customerApi.update(editing._id, input, editing.version, companyCode); setEditing(null); setSelected(saved); await load(); }} />}
  </section>;
}

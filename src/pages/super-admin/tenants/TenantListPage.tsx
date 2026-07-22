import React from "react";
import { Building2, Search, Plus } from "lucide-react";
import { superAdminTenantService, type Tenant } from "../../../services/superAdminTenantService";
import { TenantCreateDialog } from "./TenantCreateDialog";
import { TenantModuleDialog } from "./TenantModuleDialog";

export function TenantListPage({ onSelect }: { onSelect?: (code: string) => void }) {
  const [items, setItems] = React.useState<Tenant[]>([]);
  const [query, setQuery] = React.useState("");
  const [error, setError] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [selectedTenantCode, setSelectedTenantCode] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    superAdminTenantService.list(query).then(setItems).catch((e: any) => setError(`${e.message}${e.correlationId ? ` (${e.correlationId})` : ""}`));
  }, [query]);

  React.useEffect(() => { load(); }, [load]);

  return <section className="mx-auto w-full max-w-6xl space-y-6 text-slate-100">
    <header className="flex items-center justify-between border-b border-white/10 pb-5">
      <div><h2 className="text-2xl font-bold">Quản lý doanh nghiệp</h2><p className="mt-1 text-sm text-slate-400">Tìm kiếm và theo dõi trạng thái tenant.</p></div>
      <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-cyan-400"><Plus className="h-4 w-4" />Tạo doanh nghiệp mới</button>
    </header>
    <label className="relative block max-w-xl"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"/><input aria-label="Filter tenants" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm theo mã hoặc tên doanh nghiệp" className="w-full rounded-xl border border-white/10 bg-slate-900 py-3 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-400"/></label>
    {error && <p role="alert" className="break-words rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map(t => <li key={t.code}><button onClick={() => { setSelectedTenantCode(t.code); onSelect?.(t.code); }} className="group flex w-full min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-left transition hover:border-cyan-400/40 hover:bg-slate-800"><span className="rounded-xl bg-cyan-500/10 p-2 text-cyan-300"><Building2 className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-100">{t.name || t.code}</span><span className="mt-1 block truncate font-mono text-xs text-slate-500">{t.code}</span></span><span className="shrink-0 rounded-full bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase text-slate-300">{t.lifecycleStatus}</span></button></li>)}</ul>
    {!error && items.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">Không tìm thấy doanh nghiệp phù hợp.</p>}
    {showCreate && <TenantCreateDialog onClose={() => setShowCreate(false)} onCreated={(code) => { setShowCreate(false); load(); onSelect?.(code); }} />}
    {selectedTenantCode && (
      <TenantModuleDialog
        code={selectedTenantCode}
        onClose={() => setSelectedTenantCode(null)}
        onSaved={() => {
          setSelectedTenantCode(null);
          load();
        }}
      />
    )}
  </section>;
}

import React from "react";
import { Search, UserRound } from "lucide-react";
import { superAdminUserAccessService, type SuperAdminUser } from "../../../services/superAdminUserAccessService";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";

export function UserSearchPage({ tenantId, onSelect }: { tenantId: string; onSelect: (user: SuperAdminUser) => void }) {
  const [q, setQ] = React.useState("");
  const debouncedQ = useDebouncedValue(q);
  const [page, setPage] = React.useState(1);
  const [result, setResult] = React.useState<{ data: SuperAdminUser[]; total: number; limit: number }>({ data: [], total: 0, limit: 20 });

  React.useEffect(() => {
    superAdminUserAccessService.search(tenantId, { q: debouncedQ, page }).then(setResult).catch(() => setResult({ data: [], total: 0, limit: 20 }));
  }, [tenantId, debouncedQ, page]);

  const totalPages = Math.max(1, Math.ceil(result.total / (result.limit || 20)));

  return <section className="mx-auto w-full max-w-6xl space-y-6 text-slate-100"><header className="border-b border-white/10 pb-5"><h2 className="text-2xl font-bold">Người dùng và quyền truy cập</h2><p className="mt-1 text-sm text-slate-400">Phạm vi tenant: <span className="font-mono text-slate-300">{tenantId}</span></p></header><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"/><input aria-label="Search users" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} className="w-full rounded-xl border border-white/10 bg-slate-900 py-3 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-400" placeholder="Email hoặc tên người dùng"/></label><span className="shrink-0 text-sm text-slate-400">{result.total} người dùng</span></div><div className="space-y-2">{result.data.map(user => <button key={user._id} onClick={() => onSelect(user)} className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-4 text-left hover:border-cyan-400/40 hover:bg-slate-800"><UserRound className="h-5 w-5 shrink-0 text-cyan-300"/><span className="min-w-0 flex-1"><span className="block truncate font-medium text-slate-100">{user.displayName || user.email}</span><span className="block truncate text-xs text-slate-500">{user.email}</span></span><span className="shrink-0 rounded-full bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase text-slate-300">{user.role}</span></button>)}</div><div className="flex flex-wrap items-center gap-2"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 disabled:opacity-40">Trước</button><span className="text-xs text-slate-400">Trang {page}/{totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 disabled:opacity-40">Tiếp</button></div></section>;
}

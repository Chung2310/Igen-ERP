import React from "react";
import { retailReceivablesApi, type RetailReceivableReconciliation as Result } from "../../api/retailReceivables.api";
import type { RetailScope } from "../../types";
import { getApiErrorMessage } from "../../../../utils/errorMessage";
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;

export default function RetailReceivableReconciliation({ scope }: { scope: RetailScope }) {
  const [result, setResult] = React.useState<Result | null>(null);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => { void retailReceivablesApi.latestReconciliation(scope).then(setResult).catch(() => undefined); }, [scope.companyCode, scope.branchId]);
  const run = async () => { setRunning(true); try { setResult(await retailReceivablesApi.reconcile(scope)); setError(""); } catch (cause) { setError(getApiErrorMessage(cause, "Không đối soát được công nợ.")); } finally { setRunning(false); } };
  return <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between"><div><h2 className="font-bold">Đối soát công nợ</h2><p className="text-sm text-slate-500">So sánh số dư đơn hàng với sổ công nợ, không sửa dữ liệu.</p></div><button type="button" disabled={running} onClick={() => void run()} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white">{running ? "Đang đối soát..." : "Chạy đối soát"}</button></div>
    {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    {result && <div className="mt-3 overflow-auto"><p className="mb-2 text-sm">Chênh lệch tổng: <b>{money(result.differenceTotal)}</b></p><table className="w-full text-sm"><thead><tr><th className="text-left">Đơn hàng</th><th className="text-right">Theo đơn</th><th className="text-right">Theo sổ</th><th className="text-right">Chênh lệch</th></tr></thead><tbody>{result.differences.map((row) => <tr key={row.orderId}><td>{row.orderId}</td><td className="text-right">{money(row.snapshotDue)}</td><td className="text-right">{money(row.ledgerDue)}</td><td className="text-right">{money(row.difference)}</td></tr>)}</tbody></table></div>}
  </section>;
}

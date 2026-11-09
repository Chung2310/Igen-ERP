import { useEffect, useState } from "react";
import { financeAssetsApi, type AssetDepreciation } from "../api/financeAssets.api";
import { canManageAssets } from "./FixedAssetsPage";
import { exportCsv } from "../components/ManagementUI";
import { FinanceEmptyState } from "../components/FinanceEmptyState";
import { StyledSelect } from "../../../components/common/StyledSelect";
import { MonthPicker } from "../../../components/common/MonthPicker";

const vnd = (value: number) => value.toLocaleString("vi-VN");
const message = (reason: unknown, fallback: string) =>
  reason instanceof Error ? reason.message : fallback;

function currentPeriod() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function AssetDepreciationPage({
  permissions,
}: {
  permissions: readonly string[];
}) {
  const [period, setPeriod] = useState(currentPeriod);
  const [lines, setLines] = useState<AssetDepreciation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const canManage = canManageAssets(permissions);
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const posted = lines.length > 0 && lines.every((line) => line.status === "posted");
  const visibleLines = statusFilter === "all" ? lines : lines.filter((line) => line.status === statusFilter);

  const load = async (target = period) => {
    try {
      setLines(await financeAssetsApi.listDepreciations(target));
      setError("");
    } catch (reason) {
      setError(message(reason, "Không tải được kỳ khấu hao."));
    }
  };

  useEffect(() => {
    void load(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const act = async (action: "run" | "post") => {
    setBusy(true);
    setNotice("");
    try {
      const result = action === "run"
        ? await financeAssetsApi.runDepreciation(period)
        : await financeAssetsApi.postDepreciation(period);
      setNotice(
        action === "run"
          ? `Đã lập kế hoạch ${(result as { planned: number }).planned} dòng.`
          : `Đã ghi sổ ${(result as { posted: number }).posted} dòng.`,
      );
      await load(period);
    } catch (reason) {
      setError(message(reason, "Không thực hiện được thao tác khấu hao."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="finance-page-content">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-on-surface-variant">Lập kế hoạch theo kỳ, soát lại rồi ghi sổ.</p>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
            <span>Kỳ</span>
            <MonthPicker value={period} onChange={setPeriod} ariaLabel="Kỳ khấu hao" appearance="erp" />
          </div>
          {canManage && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void act("run")}
                className="min-h-9 rounded-md border border-outline-variant bg-surface-container-lowest px-4 py-2 text-xs font-semibold text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
              >
                Lập kế hoạch
              </button>
              <button
                type="button"
                disabled={busy || posted || !lines.length}
                onClick={() => void act("post")}
                className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-on-primary disabled:opacity-50"
              >
                Ghi sổ
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className="rounded-md bg-error-container p-4 text-sm text-on-error-container">{error}</p>}
      {notice && <p className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-sm text-on-surface"><span>Trạng thái</span><div className="w-40"><StyledSelect ariaLabel="Lọc trạng thái khấu hao" className="h-9 rounded-md" menuClassName="finance-select-menu" value={statusFilter} onChange={setStatusFilter} options={[{ value: "all", label: "Tất cả" }, { value: "planned", label: "Kế hoạch" }, { value: "posted", label: "Đã ghi sổ" }]} /></div></div>
        <button type="button" disabled={!visibleLines.length} onClick={() => exportCsv(`khau-hao-${period}`, ["Tài sản", "Mã tài sản", "Nguyên giá", "Khấu hao", "Lũy kế", "Giá trị còn lại", "Trạng thái"], visibleLines.map((line) => [line.assetName || line.assetId, line.assetCode || "", line.originalCost ?? "", line.amount, line.accumulatedAfter, line.netBookValueAfter, line.status]))} className="min-h-9 rounded-md border border-outline-variant bg-surface-container-lowest px-4 text-sm font-semibold text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Xuất CSV</button>
      </div>
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest">
        <div className="flex items-center justify-between border-b p-4 text-sm">
          <b>
            Kỳ {period} · {lines.length} dòng {posted ? "(đã ghi sổ)" : ""}
          </b>
          <b>Tổng khấu hao: {vnd(total)}</b>
        </div>
        <div className="divide-y">
          {visibleLines.map((line) => (
            <div key={line._id} className="grid grid-cols-2 gap-2 p-4 text-sm sm:grid-cols-4">
              <span><strong>{line.assetName || line.assetCode || line.assetId}</strong>{line.assetCode && <small className="block text-on-surface-variant">{line.assetCode}</small>}</span>
              <span>{vnd(line.amount)}</span>
              <span>Luỹ kế: {vnd(line.accumulatedAfter)}{line.originalCost != null && <small className="block text-on-surface-variant">Nguyên giá: {vnd(line.originalCost)}</small>}</span>
              <span>{line.status === "posted" ? "Đã ghi sổ" : "Kế hoạch"}</span>
            </div>
          ))}
          {!visibleLines.length && (
            <FinanceEmptyState kind={!lines.length ? "payroll" : "search"}>{!lines.length ? <><span>Kỳ này chưa có dòng khấu hao nào.</span> <span>Lập kế hoạch để bắt đầu.</span></> : "Không có dòng khấu hao phù hợp. Chọn trạng thái khác."}</FinanceEmptyState>
          )}
        </div>
      </div>
    </section>
  );
}

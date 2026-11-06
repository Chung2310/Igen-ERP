import { useEffect, useState } from "react";
import {
  financeAssetInventoriesApi,
  type AssetInventorySession,
  type AssetInventoryVariance,
} from "../api/financeAssets.api";
import { canManageAssets } from "./FixedAssetsPage";
import { FinanceEmptyState } from "../components/FinanceEmptyState";

const RESULT_LABELS: Record<string, string> = {
  pending: "Chưa kiểm",
  present: "Khớp",
  damaged: "Hư hỏng",
  missing: "Thiếu",
  surplus: "Thừa",
};

const message = (reason: unknown, fallback: string) =>
  reason instanceof Error ? reason.message : fallback;

const EMPTY_OPENING = { sessionCode: "", name: "", branchIds: "", inventoryDate: "" };

export default function AssetInventoryPage({
  permissions,
}: {
  permissions: readonly string[];
}) {
  const [sessions, setSessions] = useState<AssetInventorySession[]>([]);
  const [selected, setSelected] = useState<AssetInventorySession>();
  const [variance, setVariance] = useState<AssetInventoryVariance>();
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState<"present" | "damaged" | "surplus">("present");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const [openForm, setOpenForm] = useState(EMPTY_OPENING);
  const canManage = canManageAssets(permissions);

  const load = async () => {
    try {
      setSessions(await financeAssetInventoriesApi.list());
      setError("");
    } catch (reason) {
      setError(message(reason, "Không tải được phiên kiểm kê."));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const open = async (session: AssetInventorySession) => {
    try {
      const [detail, summary] = await Promise.all([
        financeAssetInventoriesApi.detail(session._id),
        financeAssetInventoriesApi.variance(session._id),
      ]);
      setSelected(detail);
      setVariance(summary);
    } catch (reason) {
      setError(message(reason, "Không tải được chi tiết phiên kiểm kê."));
    }
  };

  /** Company-wide sessions leave branchIds empty; the server derives them from the assets in scope. */
  const openSession = async () => {
    const branchIds = openForm.branchIds
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!openForm.sessionCode.trim() || !openForm.name.trim() || !openForm.inventoryDate) {
      setError("Cần nhập mã phiên, tên phiên và ngày kiểm kê.");
      return;
    }
    setBusy(true);
    try {
      const session = await financeAssetInventoriesApi.open({
        sessionCode: openForm.sessionCode.trim(),
        name: openForm.name.trim(),
        scope: branchIds.length ? "branch" : "company",
        branchIds,
        inventoryDate: new Date(`${openForm.inventoryDate}T00:00:00.000Z`).toISOString(),
      });
      setOpenForm(EMPTY_OPENING);
      setOpening(false);
      setError("");
      await load();
      await open(session);
    } catch (reason) {
      setError(message(reason, "Không mở được phiên kiểm kê."));
    } finally {
      setBusy(false);
    }
  };

  const scan = async () => {
    if (!selected || !barcode.trim()) return;
    setBusy(true);
    try {
      await financeAssetInventoriesApi.count(selected._id, { barcode: barcode.trim(), result });
      setBarcode("");
      await open(selected);
    } catch (reason) {
      setError(message(reason, "Không ghi nhận được kết quả kiểm kê."));
    } finally {
      setBusy(false);
    }
  };

  const finalize = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const outcome = await financeAssetInventoriesApi.finalize(selected._id);
      setSelected(outcome.session);
      setVariance(outcome.variance);
      await load();
    } catch (reason) {
      setError(message(reason, "Không chốt được phiên kiểm kê."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="finance-page-content">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="finance-page-title">Kiểm kê tài sản</h1>
          <p className="text-sm text-on-surface-variant">Quét mã vạch theo phiên, đối chiếu và chốt bảng lệch.</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setOpening((value) => !value)}
            className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-on-primary"
          >
            Mở phiên kiểm kê
          </button>
        )}
      </div>

      {error && <p className="rounded-md bg-error-container p-4 text-sm text-on-error-container">{error}</p>}

      {opening && canManage && (
        <div className="grid gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-4 sm:grid-cols-2">
          {[
            ["sessionCode", "Mã phiên", "text"],
            ["name", "Tên phiên", "text"],
            ["branchIds", "Chi nhánh (để trống = toàn công ty)", "text"],
            ["inventoryDate", "Ngày kiểm kê", "date"],
          ].map(([field, label, type]) => (
            <label key={field} className="text-sm font-semibold text-on-surface-variant">
              {label}
              <input
                type={type}
                aria-label={label}
                value={(openForm as Record<string, string>)[field]}
                onChange={(event) => setOpenForm((current) => ({ ...current, [field]: event.target.value }))}
                className="mt-1 w-full rounded-md border border-outline-variant px-3 py-2 font-normal"
              />
            </label>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => void openSession()}
            className="self-end rounded-md bg-primary px-4 py-2 text-xs font-semibold text-on-primary disabled:opacity-50"
          >
            Tạo phiên
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest">
        <div className="divide-y">
          {sessions.map((session) => (
            <button
              key={session._id}
              type="button"
              aria-label={`Phiên ${session.sessionCode}`}
              onClick={() => void open(session)}
              className="grid w-full grid-cols-2 gap-2 p-4 text-left text-sm hover:bg-surface-container-low sm:grid-cols-4"
            >
              <b>{session.sessionCode}</b>
              <span>{session.name}</span>
              <span>{session.inventoryDate?.slice(0, 10)}</span>
              <span>{session.status === "open" ? "Đang mở" : "Đã chốt"}</span>
            </button>
          ))}
          {!sessions.length && <FinanceEmptyState kind="task">Chưa có phiên kiểm kê nào.</FinanceEmptyState>}
        </div>
      </div>

      {selected && (
        <div className="rounded-md border border-outline-variant bg-surface-container-lowest">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-bold">
              {selected.sessionCode} · {selected.name}
            </h2>
            <button type="button" onClick={() => setSelected(undefined)} className="text-sm font-bold text-on-surface-variant">
              Đóng
            </button>
          </div>

          {canManage && selected.status === "open" && (
            <div className="flex flex-wrap items-end gap-3 border-b p-4">
              <input
                aria-label="Mã vạch"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void scan()}
                placeholder="Quét hoặc nhập mã vạch"
                className="flex-1 rounded-md border border-outline-variant px-3 py-2 text-sm"
              />
              <select
                aria-label="Kết quả kiểm kê"
                value={result}
                onChange={(event) => setResult(event.target.value as typeof result)}
                className="finance-select"
              >
                <option value="present">Khớp</option>
                <option value="damaged">Hư hỏng</option>
                <option value="surplus">Thừa</option>
              </select>
              <button
                type="button"
                disabled={busy}
                onClick={() => void scan()}
                className="min-h-9 rounded-md border border-outline-variant bg-surface-container-lowest px-4 py-2 text-xs font-semibold text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
              >
                Ghi nhận
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void finalize()}
                className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-on-primary disabled:opacity-50"
              >
                Chốt phiên
              </button>
            </div>
          )}

          {variance && (
            <div className="flex flex-wrap gap-3 border-b p-4 text-sm">
              <b>Tổng: {variance.total}</b>
              {Object.entries(variance.counts).map(([key, count]) => (
                <span key={key}>
                  {RESULT_LABELS[key] || key}: {count}
                </span>
              ))}
            </div>
          )}

          <div className="divide-y">
            {selected.items.map((item) => (
              <div key={item.barcode} className="grid grid-cols-2 gap-2 p-4 text-sm sm:grid-cols-4">
                <b>{item.assetCode}</b>
                <span>{item.name}</span>
                <span>{item.expectedBranchId}</span>
                <span>{RESULT_LABELS[item.result] || item.result}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

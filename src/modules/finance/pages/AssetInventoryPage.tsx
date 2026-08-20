import { useEffect, useState } from "react";
import {
  financeAssetInventoriesApi,
  type AssetInventorySession,
  type AssetInventoryVariance,
} from "../api/financeAssets.api";
import { canManageAssets } from "./FixedAssetsPage";

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
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Kiểm kê tài sản</h1>
          <p className="text-sm text-slate-500">Quét mã vạch theo phiên, đối chiếu và chốt bảng lệch.</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setOpening((value) => !value)}
            className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white"
          >
            Mở phiên kiểm kê
          </button>
        )}
      </div>

      {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      {opening && canManage && (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
          {[
            ["sessionCode", "Mã phiên", "text"],
            ["name", "Tên phiên", "text"],
            ["branchIds", "Chi nhánh (để trống = toàn công ty)", "text"],
            ["inventoryDate", "Ngày kiểm kê", "date"],
          ].map(([field, label, type]) => (
            <label key={field} className="text-sm font-semibold text-slate-700">
              {label}
              <input
                type={type}
                aria-label={label}
                value={(openForm as Record<string, string>)[field]}
                onChange={(event) => setOpenForm((current) => ({ ...current, [field]: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal"
              />
            </label>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => void openSession()}
            className="self-end rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            Tạo phiên
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="divide-y">
          {sessions.map((session) => (
            <button
              key={session._id}
              type="button"
              aria-label={`Phiên ${session.sessionCode}`}
              onClick={() => void open(session)}
              className="grid w-full grid-cols-2 gap-2 p-4 text-left text-sm hover:bg-slate-50 sm:grid-cols-4"
            >
              <b>{session.sessionCode}</b>
              <span>{session.name}</span>
              <span>{session.inventoryDate?.slice(0, 10)}</span>
              <span>{session.status === "open" ? "Đang mở" : "Đã chốt"}</span>
            </button>
          ))}
          {!sessions.length && <p className="p-6 text-center text-sm text-slate-500">Chưa có phiên kiểm kê nào.</p>}
        </div>
      </div>

      {selected && (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-bold">
              {selected.sessionCode} · {selected.name}
            </h2>
            <button type="button" onClick={() => setSelected(undefined)} className="text-sm font-bold text-slate-500">
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
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                aria-label="Kết quả kiểm kê"
                value={result}
                onChange={(event) => setResult(event.target.value as typeof result)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="present">Khớp</option>
                <option value="damaged">Hư hỏng</option>
                <option value="surplus">Thừa</option>
              </select>
              <button
                type="button"
                disabled={busy}
                onClick={() => void scan()}
                className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Ghi nhận
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void finalize()}
                className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Chốt phiên
              </button>
            </div>
          )}

          {variance && (
            <div className="flex flex-wrap gap-4 border-b p-4 text-sm">
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

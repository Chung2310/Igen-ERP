import { useEffect, useState } from "react";
import {
  financeAssetsApi,
  type DepreciationScheduleLine,
  type FixedAsset,
} from "../api/financeAssets.api";

const STATUS_LABELS: Record<string, string> = {
  in_use: "Đang dùng",
  idle: "Chờ dùng",
  disposed: "Đã thanh lý",
};

export const canManageAssets = (permissions: readonly string[]) =>
  permissions.includes("*") || permissions.includes("asset:manage");

const vnd = (value: number) => value.toLocaleString("vi-VN");
const toIso = (value: string) => new Date(`${value}T00:00:00.000Z`).toISOString();
const message = (reason: unknown, fallback: string) =>
  reason instanceof Error ? reason.message : fallback;

const EMPTY_FORM = {
  assetCode: "",
  barcode: "",
  name: "",
  group: "",
  originalCost: "",
  salvageValue: "",
  inServiceDate: "",
  usefulLifeMonths: "",
  location: "",
};

export default function FixedAssetsPage({
  permissions,
}: {
  permissions: readonly string[];
}) {
  const [items, setItems] = useState<FixedAsset[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FixedAsset>();
  const [schedule, setSchedule] = useState<DepreciationScheduleLine[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canManage = canManageAssets(permissions);

  const load = async () => {
    try {
      setItems(await financeAssetsApi.list({ status: status || undefined, search: search || undefined }));
      setError("");
    } catch (reason) {
      setError(message(reason, "Không tải được danh sách tài sản."));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const open = async (asset: FixedAsset) => {
    setSelected(asset);
    try {
      setSchedule(await financeAssetsApi.schedule(asset._id));
    } catch (reason) {
      setError(message(reason, "Không tải được lịch khấu hao."));
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      await financeAssetsApi.create({
        assetCode: form.assetCode,
        barcode: form.barcode,
        name: form.name,
        group: form.group,
        originalCost: Number(form.originalCost),
        salvageValue: Number(form.salvageValue || 0),
        inServiceDate: toIso(form.inServiceDate),
        usefulLifeMonths: Number(form.usefulLifeMonths),
        ...(form.location ? { location: form.location } : {}),
      });
      setForm(EMPTY_FORM);
      setCreating(false);
      await load();
    } catch (reason) {
      setError(message(reason, "Không tạo được tài sản."));
    } finally {
      setBusy(false);
    }
  };

  const dispose = async (asset: FixedAsset) => {
    const reason = window.prompt("Lý do thanh lý?");
    if (!reason) return;
    setBusy(true);
    try {
      await financeAssetsApi.dispose(asset._id, {
        disposedAt: new Date().toISOString(),
        disposalAmount: 0,
        reason,
      });
      setSelected(undefined);
      await load();
    } catch (failure) {
      setError(message(failure, "Không thanh lý được tài sản."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tài sản cố định</h1>
          <p className="text-sm text-slate-500">Danh mục, nguyên giá và giá trị còn lại theo chi nhánh.</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setCreating((value) => !value)}
            className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white"
          >
            Thêm tài sản
          </button>
        )}
      </div>

      {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      {creating && canManage && (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
          {[
            ["assetCode", "Mã tài sản", "text"],
            ["barcode", "Mã vạch", "text"],
            ["name", "Tên tài sản", "text"],
            ["group", "Nhóm", "text"],
            ["originalCost", "Nguyên giá", "number"],
            ["salvageValue", "Giá trị thu hồi", "number"],
            ["inServiceDate", "Ngày đưa vào dùng", "date"],
            ["usefulLifeMonths", "Số tháng khấu hao", "number"],
            ["location", "Vị trí", "text"],
          ].map(([field, label, type]) => (
            <label key={field} className="text-sm font-semibold text-slate-700">
              {label}
              <input
                type={type}
                aria-label={label}
                value={(form as Record<string, string>)[field]}
                onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal"
              />
            </label>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => void create()}
            className="self-end rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            Lưu tài sản
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Lọc trạng thái"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input
          aria-label="Tìm tài sản"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void load()}
          placeholder="Mã, mã vạch hoặc tên"
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="divide-y">
          {items.map((asset) => (
            <button
              key={asset._id}
              type="button"
              aria-label={`Tài sản ${asset.assetCode}`}
              onClick={() => void open(asset)}
              className="grid w-full grid-cols-2 gap-2 p-4 text-left text-sm hover:bg-slate-50 sm:grid-cols-5"
            >
              <b>{asset.assetCode}</b>
              <span>{asset.name}</span>
              <span>{STATUS_LABELS[asset.status] || asset.status}</span>
              <span>Nguyên giá: {vnd(asset.originalCost)}</span>
              <span>Còn lại: {vnd(asset.netBookValue)}</span>
            </button>
          ))}
          {!items.length && <p className="p-6 text-center text-sm text-slate-500">Chưa có tài sản nào.</p>}
        </div>
      </div>

      {selected && (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-bold">
              {selected.assetCode} · {selected.name}
            </h2>
            <div className="flex gap-3">
              {canManage && selected.status !== "disposed" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void dispose(selected)}
                  className="text-sm font-bold text-red-700 disabled:opacity-50"
                >
                  Thanh lý
                </button>
              )}
              <button type="button" onClick={() => setSelected(undefined)} className="text-sm font-bold text-slate-500">
                Đóng
              </button>
            </div>
          </div>
          <div className="grid gap-2 p-4 text-sm sm:grid-cols-3">
            <span>Đã khấu hao: {vnd(selected.accumulatedDepreciation)}</span>
            <span>Giá trị còn lại: {vnd(selected.netBookValue)}</span>
            <span>Số tháng: {selected.usefulLifeMonths}</span>
          </div>
          <h3 className="border-t p-4 font-bold">Lịch khấu hao</h3>
          <div className="divide-y">
            {schedule.map((line) => (
              <div key={line.period} className="grid grid-cols-3 gap-2 px-4 py-2 text-sm">
                <span>{line.period}</span>
                <span>{vnd(line.amount)}</span>
                <span>Còn: {vnd(line.netBookValueAfter)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

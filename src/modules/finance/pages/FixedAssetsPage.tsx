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

const EDITABLE_FIELDS = ["name", "group", "location", "custodianName"] as const;

const editFormFrom = (asset: FixedAsset) => ({
  name: asset.name,
  group: asset.group,
  location: asset.location || "",
  custodianName: asset.custodianName || "",
  status: asset.status === "disposed" ? "in_use" : asset.status,
  note: "",
});

const EMPTY_TRANSFER = { branchId: "", location: "", custodianName: "", reason: "" };

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
  const [panel, setPanel] = useState<"edit" | "transfer">();
  const [editForm, setEditForm] = useState(() => editFormFrom({} as FixedAsset));
  const [transferForm, setTransferForm] = useState(EMPTY_TRANSFER);
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
    setPanel(undefined);
    setEditForm(editFormFrom(asset));
    setTransferForm(EMPTY_TRANSFER);
    try {
      setSchedule(await financeAssetsApi.schedule(asset._id));
    } catch (reason) {
      setError(message(reason, "Không tải được lịch khấu hao."));
    }
  };

  const refresh = async (id: string) => {
    const fresh = await financeAssetsApi.detail(id);
    setSelected(fresh);
    setEditForm(editFormFrom(fresh));
    setPanel(undefined);
    await load();
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

  /** Sends only the fields that actually changed, so the server never sees an empty patch. */
  const submitEdit = async () => {
    if (!selected) return;
    const current = editFormFrom(selected);
    const patch: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) if (editForm[field] !== current[field]) patch[field] = editForm[field];
    if (editForm.status !== current.status) patch.status = editForm.status;
    if (!Object.keys(patch).length) {
      setError("Chưa có thay đổi nào để lưu.");
      return;
    }
    setBusy(true);
    try {
      await financeAssetsApi.update(selected._id, { ...patch, ...(editForm.note ? { note: editForm.note } : {}) });
      await refresh(selected._id);
      setError("");
    } catch (reason) {
      setError(message(reason, "Không cập nhật được tài sản."));
    } finally {
      setBusy(false);
    }
  };

  const submitTransfer = async () => {
    if (!selected) return;
    if (!transferForm.branchId.trim() || !transferForm.reason.trim()) {
      setError("Cần chọn chi nhánh đến và nhập lý do điều chuyển.");
      return;
    }
    setBusy(true);
    try {
      await financeAssetsApi.transfer(selected._id, {
        branchId: transferForm.branchId.trim(),
        reason: transferForm.reason.trim(),
        ...(transferForm.location ? { location: transferForm.location } : {}),
        ...(transferForm.custodianName ? { custodianName: transferForm.custodianName } : {}),
      });
      setTransferForm(EMPTY_TRANSFER);
      await refresh(selected._id);
      setError("");
    } catch (reason) {
      setError(message(reason, "Không điều chuyển được tài sản."));
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

  const active = selected && selected.status !== "disposed";

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
              {canManage && active && (
                <>
                  <button
                    type="button"
                    onClick={() => setPanel((value) => (value === "edit" ? undefined : "edit"))}
                    className="text-sm font-bold text-cyan-700"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel((value) => (value === "transfer" ? undefined : "transfer"))}
                    className="text-sm font-bold text-cyan-700"
                  >
                    Điều chuyển
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void dispose(selected)}
                    className="text-sm font-bold text-red-700 disabled:opacity-50"
                  >
                    Thanh lý
                  </button>
                </>
              )}
              <button type="button" onClick={() => setSelected(undefined)} className="text-sm font-bold text-slate-500">
                Đóng
              </button>
            </div>
          </div>

          {panel === "edit" && canManage && (
            <div className="grid gap-3 border-b p-4 sm:grid-cols-3">
              {[
                ["name", "Tên tài sản"],
                ["group", "Nhóm"],
                ["location", "Vị trí"],
                ["custodianName", "Người giữ"],
                ["note", "Ghi chú thay đổi"],
              ].map(([field, label]) => (
                <label key={field} className="text-sm font-semibold text-slate-700">
                  {label}
                  <input
                    aria-label={label}
                    value={(editForm as Record<string, string>)[field]}
                    onChange={(event) => setEditForm((current) => ({ ...current, [field]: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal"
                  />
                </label>
              ))}
              <label className="text-sm font-semibold text-slate-700">
                Trạng thái
                <select
                  aria-label="Trạng thái"
                  value={editForm.status}
                  onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as "in_use" | "idle" }))}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal"
                >
                  <option value="in_use">Đang dùng</option>
                  <option value="idle">Chờ dùng</option>
                </select>
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitEdit()}
                className="self-end rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Lưu thay đổi
              </button>
            </div>
          )}

          {panel === "transfer" && canManage && (
            <div className="grid gap-3 border-b p-4 sm:grid-cols-3">
              {[
                ["branchId", "Chi nhánh đến"],
                ["location", "Vị trí mới"],
                ["custodianName", "Người giữ mới"],
                ["reason", "Lý do điều chuyển"],
              ].map(([field, label]) => (
                <label key={field} className="text-sm font-semibold text-slate-700">
                  {label}
                  <input
                    aria-label={label}
                    value={(transferForm as Record<string, string>)[field]}
                    onChange={(event) => setTransferForm((current) => ({ ...current, [field]: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal"
                  />
                </label>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitTransfer()}
                className="self-end rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Xác nhận điều chuyển
              </button>
            </div>
          )}

          <div className="grid gap-2 p-4 text-sm sm:grid-cols-3">
            <span>Chi nhánh: {selected.branchId}</span>
            <span>Đã khấu hao: {vnd(selected.accumulatedDepreciation)}</span>
            <span>Giá trị còn lại: {vnd(selected.netBookValue)}</span>
          </div>

          <h3 className="border-t p-4 font-bold">Lịch sử biến động</h3>
          <div className="divide-y">
            {selected.lifecycleEvents?.map((event, index) => (
              <div key={`${event.at}-${index}`} className="grid grid-cols-3 gap-2 px-4 py-2 text-sm">
                <span>{event.type}</span>
                <span>{event.at?.slice(0, 10)}</span>
                <span>{event.note || ""}</span>
              </div>
            ))}
            {!selected.lifecycleEvents?.length && (
              <p className="px-4 py-2 text-sm text-slate-500">Chưa có biến động nào.</p>
            )}
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

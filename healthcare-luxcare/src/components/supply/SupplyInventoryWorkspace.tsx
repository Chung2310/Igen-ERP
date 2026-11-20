import React, { useEffect, useRef, useState } from "react";
import {
  supplyInventoryService as api,
  type InventoryCatalogItem,
  type InventoryDocument,
  type InventoryProfile,
  type InventoryWarehouse,
  type InventoryBalance,
  type InventoryMode,
} from "../../services/supplyInventoryService";
import type { InventoryDraft, InventoryDraftLine } from "../../../shared/supply-inventory";
import { SupplyRecordDetailModal } from "./SupplyRecordDetailModal";
import { LogisticsEmptyIllustration } from "../common/LogisticsEmptyIllustration";

const button =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-xs transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed";
const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/15 transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed";
const input =
  "w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100";
const panel = "rounded-2xl border border-slate-200/80 bg-white p-5 space-y-5 text-slate-900 shadow-xs";
const types = { receipt: "Nhập kho", issue: "Xuất dùng", opening: "Mở sổ" };
const statuses = {
  draft: "Nháp",
  submitted: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
  posted: "Đã ghi sổ",
  cancelled: "Đã hủy",
};
const documentsReadOnly = true;
const actions: Record<string, string> = {
  create: "Lập phiếu",
  update: "Sửa nháp",
  submit: "Gửi duyệt",
  approve: "Duyệt",
  reject: "Từ chối",
  cancel: "Hủy phiếu",
  post: "Ghi sổ",
};
const money = (n?: number) => (n === undefined ? "—" : n.toLocaleString("vi-VN") + " ₫");
export const inventoryQuantity = (n: number, precision: number) =>
  (n / 10 ** precision).toLocaleString("vi-VN", { maximumFractionDigits: precision });
const message = (e: unknown) => (e instanceof Error ? e.message : "Không thể xử lý yêu cầu.");
const emptyLine = (): InventoryDraftLine => ({
  supplyId: "",
  quantity: "1",
  unit: "",
  lotNumber: "",
  expiryDay: "",
  totalValueMinor: 0,
});
function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" className={button} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Trước
      </button>
      <span>
        Trang {page}/{Math.max(1, pages)}
      </span>
      <button type="button" className={button} disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Sau
      </button>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function InventoryActionButtons({
  doc,
  can,
  disabled,
  onAction,
}: {
  doc: InventoryDocument;
  can: (p: string) => boolean;
  disabled: boolean;
  onAction: (a: string) => void;
}) {
  const available: string[] = [];
  if (doc.status === "draft" && can("supply:document-create")) available.push("submit");
  if (doc.status === "submitted" && can("supply:approve")) available.push("approve", "reject");
  if (doc.status === "approved" && can("supply:post") && (doc.type !== "opening" || can("supply:adjust")))
    available.push("post");
  if (!["posted", "cancelled"].includes(doc.status) && can("supply:document-create")) available.push("cancel");
  return (
    <div className="flex flex-wrap gap-2">
      {available.map((a) => (
        <button
          key={a}
          className={["approve", "post", "submit"].includes(a) ? primaryButton : button}
          disabled={disabled}
          onClick={() => onAction(a)}
        >
          {actions[a]}
        </button>
      ))}
    </div>
  );
}

function Catalog({ branch, onChoose }: { branch: string; onChoose: (item: InventoryCatalogItem) => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<InventoryCatalogItem[]>([]);
  const [pages, setPages] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .catalog(branch, search, page)
        .then((r) => {
          if (alive) {
            setData(r.data);
            setPages(r.totalPages);
            setError("");
          }
        })
        .catch((e) => {
          if (alive) setError(message(e));
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [branch, search, page]);
  return (
    <div className="space-y-3">
      <Field label="Tìm vật tư theo tên hoặc mã">
        <input
          className={input}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </Field>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p>Đang tải danh mục…</p>
      ) : (
        <>
          <div className="max-h-72 overflow-auto divide-y">
            {data.map((item) => (
              <button
                type="button"
                className="block w-full p-3 text-left hover:bg-slate-50"
                key={item._id}
                onClick={() => onChoose(item)}
              >
                <strong>
                  {item.code} · {item.name}
                </strong>
                <span className="block text-sm text-slate-500">
                  {item.unit} · {item.profile ? "Đã cấu hình đơn vị" : "Chưa cấu hình đơn vị"}
                </span>
              </button>
            ))}
            {!data.length && <p>Không có vật tư phù hợp.</p>}
          </div>
          <Pager page={page} pages={pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

function ProfileEditor({
  item,
  branch,
  canSave,
  onClose,
}: {
  item: InventoryCatalogItem;
  branch: string;
  canSave: boolean;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<InventoryProfile>(() =>
    item.profile
      ? {
          baseUnit: item.profile.baseUnit,
          precision: item.profile.precision,
          trackingMode: item.profile.trackingMode,
          requiresExpiry: item.profile.requiresExpiry,
          conversions: item.profile.conversions.map((c) => ({ unit: c.unit, factor: c.factor })),
          version: item.profile.version,
        }
      : {
          baseUnit: item.unit,
          precision: 0,
          trackingMode: "lot",
          requiresExpiry: item.requiresExpiry !== false,
          conversions: [],
          version: 0,
        },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className={panel}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || !canSave) return;
        setBusy(true);
        setError("");
        try {
          await api.profile(branch, item, profile);
          onClose();
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h3 className="text-lg font-bold text-slate-900">Thiết lập đơn vị · {item.name}</h3>
        <p className="mt-1 text-sm text-slate-500">
          Chọn cách nhập số lượng và khai báo các đơn vị đóng gói thường dùng.
        </p>
      </div>
      <fieldset disabled={busy || !canSave} className="space-y-5">
        <section className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Đơn vị dùng để tính tồn kho</p>
          <p className="mt-1 text-xl font-bold text-emerald-900">{profile.baseUnit}</p>
          <p className="mt-1 text-xs text-emerald-700">Mọi đơn vị khác sẽ được quy đổi về {profile.baseUnit}.</p>
        </section>

        <section className="space-y-3">
          <div>
            <h4 className="font-semibold text-slate-900">Cách nhập và quản lý</h4>
            <p className="mt-0.5 text-xs text-slate-500">Các lựa chọn này áp dụng khi lập phiếu nhập và xuất kho.</p>
          </div>
          <Field label="Cho phép nhập số lượng lẻ">
            <select
              className={input}
              value={profile.precision}
              onChange={(e) => setProfile({ ...profile, precision: Number(e.target.value) })}
            >
              {[0, 1, 2, 3, 4, 5, 6].map((p) => (
                <option key={p} value={p}>
                  {p === 0 ? "Không, chỉ nhập số nguyên" : `Có, tối đa ${p} số sau dấu phẩy`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quản lý theo lô sản xuất">
            <select
              className={input}
              value={profile.trackingMode}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  trackingMode: e.target.value as "lot" | "none",
                  requiresExpiry: e.target.value === "none" ? false : profile.requiresExpiry,
                })
              }
            >
              <option value="lot">Có, mỗi lần nhập cần ghi số lô</option>
              <option value="none">Không, chỉ theo dõi tổng số lượng</option>
            </select>
          </Field>
          <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-emerald-600"
              checked={profile.requiresExpiry}
              disabled={profile.trackingMode === "none"}
              onChange={(e) => setProfile({ ...profile, requiresExpiry: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800">Theo dõi hạn sử dụng</span>
              <span className="block text-xs text-slate-500">Yêu cầu nhập hạn dùng cho từng lô hàng.</span>
            </span>
          </label>
        </section>

        <section className="space-y-3 border-t border-slate-100 pt-5">
          <div>
            <h4 className="font-semibold text-slate-900">Đơn vị đóng gói và quy đổi</h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Chỉ cần thêm khi vật tư được nhập hoặc xuất theo hộp, thùng, vỉ…
            </p>
          </div>
          {profile.conversions.map((c, i) => (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3" key={i}>
              <div className="grid items-end gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
                <Field label="Tên đơn vị đóng gói">
                  <input
                    required
                    className={input}
                    placeholder="Ví dụ: Hộp"
                    value={c.unit}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        conversions: profile.conversions.map((v, j) => (i === j ? { ...v, unit: e.target.value } : v)),
                      })
                    }
                  />
                </Field>
                <span className="pb-3 text-center font-bold text-slate-400">=</span>
                <Field label={`Số ${profile.baseUnit} trong 1 đơn vị`}>
                  <input
                    required
                    inputMode="decimal"
                    pattern="[0-9]+(\.[0-9]{1,6})?"
                    className={input}
                    placeholder="Ví dụ: 10"
                    value={c.factor}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        conversions: profile.conversions.map((v, j) =>
                          i === j ? { ...v, factor: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </Field>
                <button
                  type="button"
                  className="rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                  onClick={() => setProfile({ ...profile, conversions: profile.conversions.filter((_, j) => j !== i) })}
                >
                  Xóa
                </button>
              </div>
              <p className="mt-2 text-sm font-semibold text-emerald-700">
                1 {c.unit.trim() || "đơn vị đóng gói"} = {c.factor || "…"} {profile.baseUnit}
              </p>
            </div>
          ))}
          {!profile.conversions.length && (
            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
              Hiện chỉ sử dụng đơn vị {profile.baseUnit}.
            </p>
          )}
          <button
            type="button"
            className={button}
            disabled={profile.conversions.length >= 20}
            onClick={() => setProfile({ ...profile, conversions: [...profile.conversions, { unit: "", factor: "1" }] })}
          >
            + Thêm đơn vị đóng gói
          </button>
        </section>
      </fieldset>
      <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Sau khi đơn vị đã xuất hiện trong phiếu kho, hệ thống sẽ khóa cấu hình để giữ số liệu chính xác.
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        {canSave && (
          <button className={primaryButton} disabled={busy}>
            Lưu thiết lập
          </button>
        )}
        <button type="button" className={button} disabled={busy} onClick={onClose}>
          Đóng
        </button>
      </div>
    </form>
  );
}

function DraftEditor({
  branch,
  warehouses,
  existing,
  can,
  onSaved,
  onClose,
}: {
  branch: string;
  warehouses: InventoryWarehouse[];
  existing?: InventoryDocument;
  can: (p: string) => boolean;
  onSaved: (doc: InventoryDocument) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<InventoryDraft>(() =>
    existing
      ? {
          type: existing.type,
          warehouseId: existing.warehouseId,
          reason: existing.reason,
          recipientDepartment: existing.recipientDepartment,
          supplierId: existing.supplierId,
          lines: existing.lines.map((l) => ({
            supplyId: l.supplyId,
            quantity: l.enteredQuantity,
            unit: l.enteredUnit,
            lotNumber: l.lotNumber,
            manufacturerKey: l.manufacturerKey,
            expiryDay: l.expiryDay,
            ...(l.requestedLotId ? { lotId: l.requestedLotId } : {}),
            ...(l.totalValueMinor === undefined ? {} : { totalValueMinor: l.totalValueMinor }),
          })),
        }
      : {
          type: can("supply:cost-read") ? "receipt" : "issue",
          warehouseId: warehouses.find((w) => w.canWrite)?._id || "",
          reason: "",
          recipientDepartment: "",
          lines: [emptyLine()],
        },
  );
  const [picked, setPicked] = useState<Record<number, InventoryCatalogItem>>({});
  const [picker, setPicker] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef({ payload: "", key: "" });
  const patch = (i: number, fields: Partial<InventoryDraftLine>) =>
    setDraft((d) => ({ ...d, lines: d.lines.map((line, j) => (i === j ? { ...line, ...fields } : line)) }));
  return (
    <form
      className={panel}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setError("");
        if (draft.lines.some((l) => !l.supplyId)) {
          setError("Chọn vật tư cho mọi dòng.");
          return;
        }
        const payload = JSON.stringify(draft);
        if (operation.current.payload !== payload) operation.current = { payload, key: crypto.randomUUID() };
        setBusy(true);
        try {
          const doc = await api.saveDraft(branch, draft, operation.current.key, existing);
          onSaved(doc);
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 className="font-semibold text-slate-800">{existing ? `Sửa ${existing.number}` : "Lập chứng từ kho"}</h3>
      <fieldset disabled={busy} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Loại phiếu">
            <select
              className={input}
              value={draft.type}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  type: e.target.value as InventoryDraft["type"],
                  lines: draft.lines.map((l) => ({
                    supplyId: l.supplyId,
                    unit: l.unit,
                    quantity: l.quantity,
                    ...(e.target.value === "issue" ? {} : { lotNumber: "", expiryDay: "", totalValueMinor: 0 }),
                  })),
                })
              }
            >
              {Object.entries(types)
                .filter(
                  ([t]) => t === "issue" || (can("supply:cost-read") && (t !== "opening" || can("supply:adjust"))),
                )
                .map(([t, label]) => (
                  <option value={t} key={t}>
                    {label}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Kho">
            <select
              required
              className={input}
              value={draft.warehouseId}
              onChange={(e) => setDraft({ ...draft, warehouseId: e.target.value })}
            >
              <option value="">Chọn kho được phân công</option>
              {warehouses
                .filter((w) => w.canWrite)
                .map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <Field label="Lý do">
          <input
            required
            maxLength={1000}
            className={input}
            value={draft.reason}
            onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
          />
        </Field>
        {draft.type === "issue" && (
          <Field label="Khoa/phòng nhận">
            <input
              required
              maxLength={200}
              className={input}
              value={draft.recipientDepartment || ""}
              onChange={(e) => setDraft({ ...draft, recipientDepartment: e.target.value })}
            />
          </Field>
        )}
        {draft.lines.map((l, i) => {
          const item = picked[i];
          const snapshot = existing?.lines.find((row) => row.supplyId === l.supplyId);
          const profile = item?.profile;
          const name = item?.name || (snapshot?.supplyId === l.supplyId ? snapshot.supplyName : "Chọn vật tư");
          const units = profile ? [profile.baseUnit, ...profile.conversions.map((c) => c.unit)] : [l.unit];
          return (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/40 p-4" key={i}>
              <div className="flex justify-between gap-2">
                <button type="button" className={button} onClick={() => setPicker(i)}>
                  {i + 1}. {name}
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={draft.lines.length <= 1}
                  onClick={() => {
                    setDraft({ ...draft, lines: draft.lines.filter((_, j) => j !== i) });
                    setPicked(
                      Object.fromEntries(
                        Object.entries(picked)
                          .filter(([k]) => Number(k) !== i)
                          .map(([k, v]) => [Number(k) > i ? Number(k) - 1 : k, v]),
                      ),
                    );
                  }}
                >
                  Bỏ dòng
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Số lượng">
                  <input
                    required
                    inputMode="decimal"
                    pattern="[0-9]+(\.[0-9]{1,6})?"
                    className={input}
                    value={l.quantity}
                    onChange={(e) => patch(i, { quantity: e.target.value })}
                  />
                </Field>
                <Field label="Đơn vị">
                  <select
                    required
                    className={input}
                    value={l.unit}
                    onChange={(e) => patch(i, { unit: e.target.value })}
                  >
                    {units.map((u) => (
                      <option key={u} value={u}>
                        {u || "Chọn vật tư trước"}
                      </option>
                    ))}
                  </select>
                </Field>
                {draft.type !== "issue" && (
                  <Field label="Tổng giá trị dòng (VND)">
                    <input
                      required
                      type="number"
                      min={0}
                      max={Number.MAX_SAFE_INTEGER}
                      step={1}
                      className={input}
                      value={l.totalValueMinor ?? ""}
                      onChange={(e) =>
                        patch(i, { totalValueMinor: e.target.value === "" ? undefined : Number(e.target.value) })
                      }
                    />
                  </Field>
                )}
              </div>
              {draft.type !== "issue" && profile?.trackingMode !== "none" && (
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Số lô">
                    <input
                      required={profile?.trackingMode === "lot"}
                      maxLength={120}
                      className={input}
                      value={l.lotNumber || ""}
                      onChange={(e) => patch(i, { lotNumber: e.target.value })}
                    />
                  </Field>
                  <Field label="Mã nhà sản xuất (nếu có)">
                    <input
                      maxLength={120}
                      className={input}
                      value={l.manufacturerKey || ""}
                      onChange={(e) => patch(i, { manufacturerKey: e.target.value })}
                    />
                  </Field>
                  {profile?.requiresExpiry !== false && (
                    <Field label="Hạn dùng">
                      <input
                        type="date"
                        className={input}
                        value={l.expiryDay || ""}
                        onChange={(e) => patch(i, { expiryDay: e.target.value })}
                      />
                    </Field>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className={button}
          disabled={draft.lines.length >= 200}
          onClick={() => setDraft({ ...draft, lines: [...draft.lines, emptyLine()] })}
        >
          Thêm dòng vật tư
        </button>
        <p className="text-sm text-slate-500">
          {draft.type === "issue"
            ? "Lô được chọn theo hạn dùng gần nhất khi ghi sổ. Số tồn được kiểm tra lại tại thời điểm đó."
            : "Hàng cần hạn dùng nhưng thiếu hạn hoặc đã hết hạn sẽ được nhập vào tồn cách ly."}
        </p>
      </fieldset>
      {picker !== null && (
        <div className={panel}>
          <h4>Chọn vật tư cho dòng {picker + 1}</h4>
          <Catalog
            branch={branch}
            onChoose={(item) => {
              if (!item.profile) {
                setError("Vật tư chưa cấu hình đơn vị. Mở mục Danh mục và đơn vị để cấu hình trước.");
                return;
              }
              setPicked({ ...picked, [picker]: item });
              patch(picker, {
                supplyId: item._id,
                unit: item.profile.baseUnit,
                lotNumber: "",
                expiryDay: "",
                manufacturerKey: "",
                lotId: undefined,
              });
              setPicker(null);
              setError("");
            }}
          />
          <button type="button" className={button} onClick={() => setPicker(null)}>
            Đóng chọn vật tư
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button className={primaryButton} disabled={busy || picker !== null}>
          Lưu nháp
        </button>
        <button type="button" className={button} disabled={busy} onClick={onClose}>
          Đóng soạn phiếu
        </button>
      </div>
    </form>
  );
}

export function SupplyInventoryWorkspace({
  branch,
  mode,
  can,
  initialTab = "documents",
  hideNavigation = false,
  onNavigationLockChange,
}: {
  branch: string;
  mode: InventoryMode;
  can: (p: string) => boolean;
  initialTab?: string;
  hideNavigation?: boolean;
  onNavigationLockChange?: (locked: boolean) => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [businessDay, setBusinessDay] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [docs, setDocs] = useState<InventoryDocument[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [selectedBalance, setSelectedBalance] = useState<InventoryBalance | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<InventoryDocument | null>(null);
  const [edit, setEdit] = useState<InventoryDocument | null | undefined>(undefined);
  const [profile, setProfile] = useState<InventoryCatalogItem | null>(null);
  const [pending, setPending] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    onNavigationLockChange?.(busy || edit !== undefined || !!profile || !!pending || !!selectedBalance);
  }, [busy, edit, profile, pending, selectedBalance, onNavigationLockChange]);
  const operation = useRef({ payload: "", key: "" });
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([
      api.warehouses(branch),
      tab === "documents"
        ? api.documents(branch, page)
        : tab === "balances"
          ? api.balances(branch, page)
          : Promise.resolve(null),
    ])
      .then(([w, r]) => {
        if (!alive) return;
        setWarehouses(w);
        if (r) {
          setPages(r.totalPages);
          setBusinessDay(r.businessDay || "");
          if (tab === "documents") setDocs(r.data as InventoryDocument[]);
          else setBalances(r.data as InventoryBalance[]);
        }
      })
      .catch((e) => {
        if (alive) setError(message(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [branch, page, tab, refresh]);
  const openDoc = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      setSelected(await api.document(branch, id));
      setPending("");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const canEdit = (d: InventoryDocument) =>
    !documentsReadOnly &&
    mode === "v2" &&
    can("supply:document-create") &&
    ["draft", "rejected"].includes(d.status) &&
    (d.type === "issue" || can("supply:cost-read")) &&
    (d.type !== "opening" || can("supply:adjust"));
  return (
    <section className="space-y-5 text-slate-800">
      <div className={`flex flex-wrap items-center gap-3 ${hideNavigation ? "justify-end" : "justify-between"}`}>
        {!hideNavigation && <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {tab === "catalog" ? "Đơn vị quy đổi" : tab === "balances" ? "Tồn kho theo lô" : "Sổ chứng từ kho"}
          </h2>
          {tab === "catalog" && (
            <p className="mt-1 text-sm text-slate-500">Thiết lập cách tính và quy đổi đơn vị cho từng vật tư.</p>
          )}
        </div>}
        <button
          className={button}
          disabled={busy || loading || edit !== undefined || !!profile || !!pending}
          onClick={() => setRefresh((v) => v + 1)}
        >
          Tải lại danh sách
        </button>
      </div>
      {mode !== "v2" && (
        <div
          role="status"
          className="rounded-xl border border-amber-200/60 bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-amber-800"
        >
          {mode === "preparing"
            ? "Kho đang chuyển dữ liệu. Các thao tác ghi tạm khóa."
            : "Kho theo lô chưa được kích hoạt. Bạn có thể xem các mục; nhập/xuất sẽ mở sau khi chuyển đổi và đối soát dữ liệu."}
        </div>
      )}
      {!hideNavigation && (
        <nav className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" aria-label="Nghiệp vụ kho">
          {[
            ["documents", "Chứng từ"],
            ["balances", "Tồn theo lô"],
            ["catalog", "Danh mục và đơn vị"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40 ${tab === id ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-white/60"}`}
              aria-pressed={tab === id}
              disabled={busy || edit !== undefined || !!pending || !!profile}
              onClick={() => {
                setTab(id);
                setPage(1);
                setSelected(null);
                setSelectedBalance(null);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      {loading ? (
        <p>Đang tải dữ liệu kho…</p>
      ) : tab === "catalog" ? (
        profile ? (
          <ProfileEditor
            key={profile._id}
            branch={branch}
            item={profile}
            canSave={mode === "v2" && can("supply:catalog-manage")}
            onClose={() => {
              setProfile(null);
              setRefresh((v) => v + 1);
            }}
          />
        ) : (
          <div className={panel}>
            <Catalog key={refresh} branch={branch} onChoose={setProfile} />
          </div>
        )
      ) : tab === "balances" ? (
        <div className={panel}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 [&_th]:px-3 [&_th]:py-3">
                <tr>
                  {[
                    "Vật tư",
                    "Kho",
                    "Lô / hạn",
                    "Trạng thái",
                    "Số lượng",
                    ...(can("supply:cost-read") ? ["Giá trị"] : []),
                  ].map((h) => (
                    <th className="p-2" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr
                    key={b._id}
                    className="border-t border-slate-100 transition hover:bg-emerald-50/30 [&_td]:px-3 [&_td]:py-3"
                  >
                    <td className="p-2">
                      {b.supply?.name || "Vật tư không còn trong danh mục"}
                      <small className="block">{b.supply?.code}</small>
                      <button
                        type="button"
                        className="mt-1 text-xs font-semibold text-emerald-700 hover:underline"
                        onClick={() => setSelectedBalance(b)}
                      >
                        Xem chi tiết
                      </button>
                    </td>
                    <td className="p-2">{b.warehouseName || "Kho không còn khả dụng"}</td>
                    <td className="p-2">
                      {b.lot?.lotNumber || "Không theo lô"}
                      <small className="block">
                        {b.lot?.expiryDay || (b.profile?.requiresExpiry ? "Chưa xác minh hạn" : "Không áp dụng hạn")}
                      </small>
                    </td>
                    <td className="p-2">
                      {b.lot?.recalled
                        ? "Thu hồi"
                        : b.profile?.requiresExpiry && b.lot?.expiryDay && b.lot.expiryDay < businessDay
                          ? "Hết hạn"
                          : { available: "Khả dụng", quarantine: "Cách ly", damaged: "Hư hỏng" }[b.quality] ||
                            b.quality}
                    </td>
                    <td className="p-2">
                      {b.profile
                        ? `${inventoryQuantity(b.quantityScaled, b.profile.precision)} ${b.profile.baseUnit}`
                        : "Thiếu cấu hình đơn vị"}
                    </td>
                    {can("supply:cost-read") && <td className="p-2">{money(b.valueMinor)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {!balances.length && <div className="px-4 py-10 text-center text-on-surface-variant">
              <LogisticsEmptyIllustration kind="balance" />
              <p className="mt-2 text-pretty text-sm">Chưa có tồn theo lô trong phạm vi kho được phân công.</p>
            </div>}
          </div>
          <Pager page={page} pages={pages} onChange={setPage} />
        </div>
      ) : (
        <>
          {edit !== undefined ? (
            <DraftEditor
              key={edit?._id || "new"}
              branch={branch}
              warehouses={warehouses}
              existing={edit || undefined}
              can={can}
              onClose={() => setEdit(undefined)}
              onSaved={(doc) => {
                setEdit(undefined);
                setSelected(doc);
                setRefresh((v) => v + 1);
                void openDoc(doc._id);
              }}
            />
          ) : (
            <div className={panel}>
              {!documentsReadOnly && can("supply:document-create") && (
                <button
                  className={primaryButton}
                  disabled={mode !== "v2" || busy || !warehouses.some((w) => w.canWrite)}
                  onClick={() => {
                    setSelected(null);
                    setEdit(null);
                  }}
                >
                  Lập phiếu
                </button>
              )}
              <p className="mb-3 text-sm text-slate-500">
                Chứng từ được tự động sinh khi thực hiện Nhập/xuất và chỉ dùng để tra cứu, đối chiếu.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 [&_th]:px-3 [&_th]:py-3">
                    <tr>
                      {["Số phiếu", "Loại", "Kho", "Trạng thái", "Ngày lập"].map((h) => (
                        <th className="p-2" key={h}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d) => (
                      <tr
                        key={d._id}
                        className="border-t border-slate-100 transition hover:bg-emerald-50/30 [&_td]:px-3 [&_td]:py-3"
                      >
                        <td className="p-2">
                          <button
                            className="font-semibold text-emerald-700 hover:text-emerald-900 hover:underline"
                            disabled={busy}
                            onClick={() => void openDoc(d._id)}
                          >
                            {d.number}
                          </button>
                        </td>
                        <td className="p-2">{types[d.type]}</td>
                        <td className="p-2">
                          {warehouses.find((w) => w._id === d.warehouseId)?.name || "Kho không còn khả dụng"}
                        </td>
                        <td className="p-2">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${d.status === "posted" || d.status === "approved" ? "bg-emerald-50 text-emerald-700" : d.status === "submitted" ? "bg-amber-50 text-amber-700" : d.status === "rejected" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}
                          >
                            {statuses[d.status]}
                          </span>
                        </td>
                        <td className="p-2">{new Date(d.createdAt).toLocaleString("vi-VN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!docs.length && <div className="px-4 py-10 text-center text-on-surface-variant">
                  <LogisticsEmptyIllustration kind="documents" />
                  <p className="mt-2 text-pretty text-sm">Chưa có chứng từ trong phạm vi kho được phân công.</p>
                </div>}
              </div>
              <Pager page={page} pages={pages} onChange={setPage} />
            </div>
          )}
          {selected && edit === undefined && (
            <div className={panel}>
              <div className="flex justify-between">
                <h3 className="font-semibold text-slate-800">
                  {selected.number} · {statuses[selected.status]}
                </h3>
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => {
                    setSelected(null);
                    setPending("");
                  }}
                >
                  Đóng chi tiết
                </button>
              </div>
              <p>{selected.reason}</p>
              {selected.recipientDepartment && <p>Khoa/phòng nhận: {selected.recipientDepartment}</p>}
              {selected.decisionReason && <p>Lý do xử lý: {selected.decisionReason}</p>}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 [&_th]:px-3 [&_th]:py-3">
                    <tr>
                      <th>Vật tư</th>
                      <th>Số lượng</th>
                      <th>Lô / hạn</th>
                      {can("supply:cost-read") && <th>Giá trị nhập</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {selected.lines?.map((l, i) => (
                      <tr
                        className="border-t border-slate-100 transition hover:bg-emerald-50/30 [&_td]:px-3 [&_td]:py-3"
                        key={i}
                      >
                        <td className="py-2">{l.supplyName}</td>
                        <td>
                          {l.enteredQuantity} {l.enteredUnit}
                          <small className="block">
                            {inventoryQuantity(l.quantityScaled, l.precision)} {l.baseUnit}
                          </small>
                        </td>
                        <td>
                          {l.lotNumber || (selected.type === "issue" ? "Phân bổ khi ghi sổ" : "Không theo lô")}{" "}
                          {l.expiryDay}
                        </td>
                        {can("supply:cost-read") && <td>{money(l.totalValueMinor)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {canEdit(selected) && (
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => {
                    setEdit(selected);
                    setPending("");
                  }}
                >
                  Sửa nháp
                </button>
              )}
              <InventoryActionButtons
                doc={selected}
                can={documentsReadOnly ? () => false : can}
                disabled={
                  busy || mode !== "v2" || !warehouses.some((w) => w._id === selected.warehouseId && w.canWrite)
                }
                onAction={(a) => {
                  setPending(a);
                  setReason("");
                }}
              />
              {pending && (
                <form
                  className="space-y-3 rounded-lg bg-slate-50 p-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (busy) return;
                    const payload = JSON.stringify([selected._id, selected.revision, pending, reason]);
                    if (operation.current.payload !== payload)
                      operation.current = { payload, key: crypto.randomUUID() };
                    setBusy(true);
                    setError("");
                    try {
                      const result = await api.action(branch, selected, pending, reason, operation.current.key);
                      setSelected({ ...selected, ...result });
                      setPending("");
                      setRefresh((v) => v + 1);
                      setSelected(await api.document(branch, selected._id));
                    } catch (e) {
                      setError(message(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <p>
                    Xác nhận {actions[pending].toLowerCase()} phiếu {selected.number}?
                    {pending === "post" && " Số tồn và sổ kho sẽ được cập nhật."}
                  </p>
                  <Field label="Lý do xử lý">
                    <input
                      className={input}
                      required={pending === "reject" || pending === "cancel"}
                      maxLength={1000}
                      disabled={busy}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </Field>
                  <button className={button} disabled={busy}>
                    Xác nhận {actions[pending].toLowerCase()}
                  </button>
                  <button type="button" className={button} disabled={busy} onClick={() => setPending("")}>
                    Quay lại
                  </button>
                </form>
              )}
              <button className={button} disabled={busy} onClick={() => void openDoc(selected._id)}>
                Tải lại chi tiết
              </button>
              {!!selected.movements?.length && (
                <div>
                  <h4 className="font-semibold text-slate-800">Phân bổ đã ghi sổ</h4>
                  {selected.movements.map((m) => {
                    const l = selected.lines?.find((l) => l.supplyId === m.supplyId);
                    return (
                      <p key={m._id}>
                        {l?.supplyName} · Lô {m.lotNumber} ·{" "}
                        {l ? inventoryQuantity(m.deltaQty, l.precision) + " " + l.baseUnit : "Thiếu đơn vị"}
                        {can("supply:cost-read") ? " · " + money(m.deltaValue) : ""}
                      </p>
                    );
                  })}
                </div>
              )}
              <div>
                <h4 className="font-semibold text-slate-800">Lịch sử xử lý</h4>
                {selected.history?.map((h) => (
                  <p key={h._id} className="text-sm">
                    {new Date(h.createdAt).toLocaleString("vi-VN")} · {actions[h.action] || h.action} · {h.actorId}
                    {h.reason ? ` · ${h.reason}` : ""}
                  </p>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <SupplyRecordDetailModal
        open={Boolean(selectedBalance)}
        title={selectedBalance?.supply?.name || "Chi tiết tồn theo lô"}
        subtitle={
          selectedBalance ? `Mã vật tư: ${selectedBalance.supply?.code || selectedBalance.supplyId}` : undefined
        }
        status={
          selectedBalance
            ? {
                label: selectedBalance.lot?.recalled
                  ? "Thu hồi"
                  : selectedBalance.profile?.requiresExpiry &&
                      selectedBalance.lot?.expiryDay &&
                      selectedBalance.lot.expiryDay < businessDay
                    ? "Hết hạn"
                    : { available: "Khả dụng", quarantine: "Cách ly", damaged: "Hư hỏng" }[selectedBalance.quality] ||
                      selectedBalance.quality,
                active:
                  selectedBalance.quality === "available" &&
                  !selectedBalance.lot?.recalled &&
                  !(
                    selectedBalance.profile?.requiresExpiry &&
                    selectedBalance.lot?.expiryDay &&
                    selectedBalance.lot.expiryDay < businessDay
                  ),
              }
            : undefined
        }
        fields={
          selectedBalance
            ? [
                { label: "Kho lưu trữ", value: selectedBalance.warehouseName || selectedBalance.warehouseId },
                { label: "Vị trí trong kho", value: selectedBalance.locationId || "Mặc định" },
                { label: "Số lô", value: selectedBalance.lot?.lotNumber || "Không theo lô" },
                { label: "Hãng sản xuất", value: selectedBalance.lot?.manufacturerKey },
                {
                  label: "Hạn sử dụng",
                  value:
                    selectedBalance.lot?.expiryDay ||
                    (selectedBalance.profile?.requiresExpiry ? "Chưa xác minh" : "Không áp dụng"),
                },
                { label: "Quản lý hạn sử dụng", value: selectedBalance.profile?.requiresExpiry ? "Có" : "Không" },
                {
                  label: "Số lượng tồn",
                  value: selectedBalance.profile
                    ? `${inventoryQuantity(selectedBalance.quantityScaled, selectedBalance.profile.precision)} ${selectedBalance.profile.baseUnit}`
                    : selectedBalance.quantityScaled.toLocaleString("vi-VN"),
                },
                ...(can("supply:cost-read")
                  ? [{ label: "Giá trị tồn", value: money(selectedBalance.valueMinor) }]
                  : []),
                {
                  label: "Cách theo dõi",
                  value: selectedBalance.profile?.trackingMode === "lot" ? "Theo lô sản xuất" : "Không theo lô",
                },
                { label: "Phiên bản số dư", value: selectedBalance.version },
                { label: "Mã số dư", value: selectedBalance._id, wide: true },
                { label: "Mã lô", value: selectedBalance.lotId, wide: true },
              ]
            : []
        }
        onClose={() => setSelectedBalance(null)}
      />
    </section>
  );
}

import { useState } from "react";
import { DateInput24 } from "../../../components/common/TimeInput24";
import type {
  StockDocument,
  StockLine,
  LogisticsReferences,
  Supply,
  LogisticsList,
} from "../../../../shared/healthcare-logistics";
import { documentTypes } from "../../../../shared/healthcare-logistics";
import type { HealthcareApi } from "../api";
import { Field, buttonClass, controlClass, Feedback, useHealthcareQuery } from "../ui";
import { LineOptions } from "./SupplyLineOptions";
import { LogisticsForm, formValues } from "./LogisticsForm";
import { cn } from "../../student-management/lib/utils";

const blankLine = (): StockLine => ({
  supplyId: "",
  quantity: 1,
  lot: "",
  expiryDay: "",
  quality: "available",
  value: 0,
});
export default function SupplyDocumentEditor({
  api,
  record,
  refs,
  onClose,
  onSaved,
  batchType,
  initialSupply,
}: {
  batchType?: "receipt" | "issue";
  initialSupply?: Supply;
  api: HealthcareApi;
  record?: StockDocument;
  refs: LogisticsReferences;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [lines, setLines] = useState(
    record?.lines || [{ ...blankLine(), supplyId: initialSupply?._id || "", unit: initialSupply?.unit || "", lot: initialSupply?.batchNumber || "", expiryDay: initialSupply?.expiryDay || "", value: initialSupply?.unitPrice || 0 }],
  );
  const [type, setType] = useState(record?.type || batchType || "receipt");
  const [warehouse, setWarehouse] = useState(record?.warehouseId || initialSupply?.warehouseId || "");
  const [search, setSearch] = useState("");
  const [voucherCode] = useState(() => record?.voucherCode || `${(batchType || record?.type) === "issue" ? "PXK" : "PNK"}-${new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`);
  const [voucherDay] = useState(() => record?.voucherDay || new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10));
  const supplies = useHealthcareQuery<LogisticsList<Supply>>(
    api,
    `/logistics/supplies?pageSize=100&q=${encodeURIComponent(search)}`,
  );
  const [selected, setSelected] = useState<Record<string, string>>(
    initialSupply ? { [initialSupply._id]: initialSupply.name } : {},
  );
  const [selectedSupplies, setSelectedSupplies] = useState<Record<string, Supply>>(initialSupply ? { [initialSupply._id]: initialSupply } : {});
  const supplyById = { ...selectedSupplies, ...Object.fromEntries((supplies.data?.items || []).map((item) => [item._id, item])) };
  const totalQuantity = lines.reduce((total, line) => total + Number(line.quantity || 0), 0);
  const totalValue = lines.reduce((total, line) => total + Number(line.value || 0), 0);
  const options = [
    { value: "", label: "Chọn vật tư" },
    ...Object.entries({
      ...selected,
      ...Object.fromEntries((supplies.data?.items || []).map((x) => [x._id, `${x.code} · ${x.name} (${x.unit})`])),
    }).map(([value, label]) => ({ value, label })),
  ];
  function patch(index: number, value: Partial<StockLine>) {
    setLines((items) => items.map((line, i) => (i === index ? { ...line, ...value } : line)));
  }
  return (
    <LogisticsForm
      maxWidth="max-w-6xl"
      title={
        record
          ? "Sửa phiếu vật tư"
          : batchType === "receipt"
            ? "Lập Phiếu Nhập Kho Theo Lô"
            : batchType === "issue"
              ? "Lập Phiếu Xuất Kho Theo Lô"
              : "Lập phiếu vật tư"
      }
      submitLabel={batchType ? `Hoàn tất ${batchType === "receipt" ? "Nhập" : "Xuất"} kho theo lô` : "Lưu nháp"}
      secondarySubmitLabel={batchType ? "Lưu nháp" : undefined}
      api={api}
      path={(data) => batchType && data.get("save-mode") === "post" ? "/logistics/batch-stock" : `/logistics/documents${record ? `/${record._id}` : ""}`}
      method={record ? "PATCH" : "POST"}
      onClose={onClose}
      onSaved={onSaved}
      payload={(data) => {
        const v = formValues(data);
        return {
          ...Object.fromEntries(
            Object.entries(v).filter(
              ([key]) => !key.startsWith("line-") && key !== "supply-search" && key !== "save-mode",
            ),
          ),
          lines,
          ...(batchType ? { type: batchType } : {}),
          ...(record ? { revision: record.revision } : {}),
        };
      }}
    >
      {(error) => (
        <>
          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
          <h3 className="mb-4 border-b border-outline-variant pb-3 text-balance text-sm font-semibold text-on-surface">Thông tin chung chứng từ</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field name="voucherCode" label="Mã phiếu / Lô" value={voucherCode} required error={error} />
            <Field name="voucherDay" label="Ngày chứng từ" type="date" value={voucherDay} required error={error} />
            {!batchType && (
            <Field
              name="type"
              label="Loại phiếu"
              value={type}
              onSelectChange={(value) => setType(value as typeof type)}
              options={Object.entries(documentTypes).map(([value, label]) => ({ value, label }))}
            />
            )}
            <Field
              name="warehouseId"
              label={type === "issue" ? "Kho xuất hàng" : "Kho tiếp nhận"}
              value={warehouse}
              onSelectChange={setWarehouse}
              required
              error={error}
              options={[
                { value: "", label: "Chọn kho" },
                ...refs.warehouses.map((x) => ({ value: x._id, label: x.name })),
              ]}
            />
            {type !== "issue" && <Field
              name="supplierId"
              label="Nhà cung cấp"
              value={record?.supplierId || initialSupply?.supplierId}
              options={[
                { value: "", label: "Chưa chọn" },
                ...refs.suppliers.map((x) => ({ value: x._id, label: x.name })),
              ]}
            />}
            {type === "issue" && <Field
              name="departmentId"
              label="Khoa / Phòng nhận"
              value={record?.departmentId}
              required
              options={[
                { value: "", label: "Chưa chọn" },
                ...refs.departments.map((x) => ({ value: x._id, label: x.name })),
              ]}
            />}
            <div className="sm:col-span-2 lg:col-span-4">
              <Field name="reason" label="Lý do / Mục đích chứng từ" value={record?.reason || (batchType === "receipt" ? "Nhập thêm hàng định kỳ vào kho" : batchType === "issue" ? "Cấp phát sử dụng cho khoa phòng" : "")} required error={error} />
            </div>
          </div>
          </section>
          <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-balance text-sm font-semibold text-on-surface">Danh sách sản phẩm trong phiếu <span className="text-on-surface-variant">({lines.length} mặt hàng)</span></h3>
            <button type="button" className={buttonClass} disabled={lines.length >= 100} onClick={() => setLines((v) => [...v, blankLine()])}>Thêm sản phẩm</button>
          </div>
          <Field
            name="supply-search"
            label="Tìm vật tư để thêm vào phiếu"
            onChange={(e) => setSearch(e.target.value)}
          />
          <Feedback loading={supplies.loading} error={supplies.error} onRetry={supplies.refresh} />
          {lines.map((line, index) => (
            <fieldset key={index} className="grid min-w-0 gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
              <legend className="px-1 text-sm font-semibold text-on-surface">Vật tư {index + 1}</legend>
              <div className="min-w-0 sm:col-span-2 lg:col-span-3">
              <Field
                name={`line-${index}-supply`}
                label="Tên và mã vật tư"
                value={line.supplyId}
                required
                options={
                  options.some((x) => x.value === line.supplyId)
                    ? options
                    : [...options, { value: line.supplyId, label: "Vật tư đã chọn" }]
                }
                onSelectChange={(value) => {
                  const supply = supplyById[value];
                  patch(index, { supplyId: value, unit: supply?.unit || "", lot: supply?.batchNumber || "", expiryDay: supply?.expiryDay || "", value: Math.round(line.quantity * (supply?.unitPrice || 0)) });
                  setSelected((v) => ({ ...v, [value]: options.find((x) => x.value === value)?.label || value }));
                  if (supply) setSelectedSupplies((v) => ({ ...v, [value]: supply }));
                }}
              />
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm">
                <span className="block text-xs text-on-surface-variant">{type === "issue" ? "Tồn khả dụng" : "Tồn kho hiện có"}</span>
                <strong className="tabular-nums text-on-surface">{(supplyById[line.supplyId]?.quantity || 0).toLocaleString("vi-VN")} {supplyById[line.supplyId]?.unit || ""}</strong>
              </div>
              <LineOptions
                api={api}
                line={line}
                index={index}
                warehouse={warehouse}
                issue={type === "issue"}
                onChange={(value) => patch(index, value)}
              />
              <Field
                name={`line-${index}-quantity`}
                label={`Số lượng${supplyById[line.supplyId]?.unit ? ` (${supplyById[line.supplyId].unit})` : ""}`}
                type="number"
                min="0.000001"
                max="1000000000"
                step="0.000001"
                value={String(line.quantity)}
                required
                onChange={(e) => {
                  const quantity = Number(e.target.value);
                  patch(index, { quantity, value: Math.round(quantity * (line.quantity ? line.value / line.quantity : 0)) });
                }}
              />
              {type !== "issue" && <>
              <label className="space-y-1 text-sm font-medium">
                Số lô
                <input
                  className={controlClass}
                  name={`line-${index}-lot`}
                  value={line.lot}
                  onChange={(e) => patch(index, { lot: e.target.value })}
                />
              </label>
              <div className="space-y-1">
                <span className="block text-sm font-medium">Hạn dùng</span>
                <DateInput24
                  ariaLabel={`Hạn dùng dòng ${index + 1}`}
                  value={line.expiryDay}
                  onChange={(value) => patch(index, { expiryDay: value })}
                />
              </div>
              <Field
                name={`line-${index}-value`}
                label="Đơn giá (đ)"
                type="number"
                min={0}
                step={1}
                value={String(line.quantity ? Math.round(line.value / line.quantity) : 0)}
                onChange={(e) => patch(index, { value: Math.round(Number(e.target.value) * line.quantity) })}
              />
              <div className="flex items-end justify-between gap-3 border-t border-outline-variant pt-3 sm:col-span-2 lg:col-span-4">
                <span className="text-sm text-on-surface-variant">Thành tiền</span>
                <strong className="tabular-nums text-on-surface">{Number(line.value || 0).toLocaleString("vi-VN")} đ</strong>
              </div>
              </>}
              <button
                type="button"
                className={cn(buttonClass, "sm:col-span-2 lg:col-span-4 lg:justify-self-end")}
                disabled={lines.length === 1}
                onClick={() => setLines((v) => v.filter((_, i) => i !== index))}
              >
                Xóa vật tư dòng {index + 1}
              </button>
            </fieldset>
          ))}
          </section>
          <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface">
            <span>Tổng cộng: <strong className="tabular-nums">{lines.length}</strong> mặt hàng</span>
            <span>Tổng số lượng: <strong className="tabular-nums">{totalQuantity.toLocaleString("vi-VN")}</strong> đơn vị</span>
            {type !== "issue" && <span>Tổng giá trị: <strong className="tabular-nums">{totalValue.toLocaleString("vi-VN")} đ</strong></span>}
          </div>
        </>
      )}
    </LogisticsForm>
  );
}

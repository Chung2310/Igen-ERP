import { useId, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import type {
  DirectoryKind,
  DirectoryRecord,
  Supply,
  LogisticsReferences,
} from "../../../../shared/healthcare-logistics";
import type { HealthcareApi } from "../api";
import { Field, buttonClass, controlClass, messageOf, primaryClass } from "../ui";
import { cn } from "../../student-management/lib/utils";
import CatalogMediaFields from "./CatalogMediaFields";
import { LogisticsForm, formValues } from "./LogisticsForm";

const quickAddMeta: Record<
  DirectoryKind,
  {
    title: string;
    codePlaceholder: string;
    namePlaceholder: string;
    extraField?: { key: "phone" | "location"; label: string; placeholder: string };
  }
> = {
  categories: {
    title: "Thêm phân loại mới",
    codePlaceholder: "vd: PL-01",
    namePlaceholder: "vd: Vật tư tiêu hao",
  },
  suppliers: {
    title: "Thêm nhà cung cấp mới",
    codePlaceholder: "vd: NCC-01",
    namePlaceholder: "vd: Công ty Thiết bị Y tế ABC",
    extraField: { key: "phone", label: "Điện thoại", placeholder: "vd: 0901234567" },
  },
  warehouses: {
    title: "Thêm kho lưu trữ mới",
    codePlaceholder: "vd: KHO-01",
    namePlaceholder: "vd: Kho Vật tư Phòng khám",
    extraField: { key: "location", label: "Vị trí kho", placeholder: "vd: Tầng 2 - Khu B" },
  },
};

export default function SupplyEditor({
  api,
  record,
  refs,
  onRefsChanged,
  onClose,
  onSaved,
}: {
  api: HealthcareApi;
  record?: Supply;
  refs: LogisticsReferences;
  onRefsChanged?: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [documents] = useState(record?.documents || []);
  const [image, setImage] = useState<File>();
  const [files, setFiles] = useState<File[]>([]);
  const [requiresExpiry, setRequiresExpiry] = useState(record?.requiresExpiry ?? true);
  const [category, setCategory] = useState(record?.category || "");
  const [supplierId, setSupplierId] = useState(record?.supplierId || "");
  const [warehouseId, setWarehouseId] = useState(record?.warehouseId || "");
  const [quickAdd, setQuickAdd] = useState<DirectoryKind | null>(null);
  const [added, setAdded] = useState<{
    categories: { _id: string; name: string }[];
    suppliers: { _id: string; name: string }[];
    warehouses: { _id: string; name: string }[];
  }>({ categories: [], suppliers: [], warehouses: [] });
  const units = ["Hộp", "Cái", "Gói", "Ống", "Chai", "Cuộn"];

  const categories = [
    ...(refs.categories || []),
    ...added.categories.filter(
      (item) => !(refs.categories || []).some((x) => x._id === item._id || x.name === item.name),
    ),
  ];
  const suppliers = [
    ...refs.suppliers,
    ...added.suppliers.filter((item) => !refs.suppliers.some((x) => x._id === item._id)),
  ];
  const warehouses = [
    ...refs.warehouses,
    ...added.warehouses.filter((item) => !refs.warehouses.some((x) => x._id === item._id)),
  ];

  function handleQuickCreated(kind: DirectoryKind, created: DirectoryRecord) {
    setAdded((prev) => ({
      ...prev,
      [kind]: [...prev[kind], { _id: created._id, name: created.name }],
    }));
    if (kind === "categories") setCategory(created.name);
    if (kind === "suppliers") setSupplierId(created._id);
    if (kind === "warehouses") setWarehouseId(created._id);
    setQuickAdd(null);
    onRefsChanged?.();
  }
  return (
    <LogisticsForm
      title={record ? "Cập nhật Danh mục Vật tư" : "Khai báo Danh mục Vật tư mới"}
      maxWidth="max-w-5xl"
      api={api}
      path={`/logistics/supplies${record ? `/${record._id}` : ""}`}
      method={record ? "PATCH" : "POST"}
      onClose={onClose}
      onSaved={onSaved}
      afterSaved={async (result) => {
        const id = (result as Supply)._id;
        try {
          for (const entry of [
            ...(image ? [{ file: image, image: true }] : []),
            ...files.map((file) => ({ file, image: false })),
          ]) {
            const body = new FormData();
            body.set("file", entry.file);
            if (entry.image) body.set("image", "true");
            await api.json(`/logistics/files/supplies/${id}/attachment`, {
              method: "POST",
              body,
            });
          }
        } catch (error) {
          throw new Error(
            `Vật tư đã lưu, nhưng chưa tải hết tệp. Mở Chi tiết để tải lại. ${error instanceof Error ? error.message : ""}`,
          );
        }
      }}
      payload={(data) => {
        const v = formValues(data);
        return {
          ...v,
          minQuantity: Number(v.minQuantity),
          unitPrice: Number(v.unitPrice),
          requiresExpiry,
          expiryDay: requiresExpiry ? v.expiryDay : "",
          active: v.active === "true",
          roomId: record?.roomId || "",
          warehouseLocation: record?.warehouseLocation || "",
          documents,
          imageUrl: record?.imageUrl || "",
          ...(record ? { revision: record.revision } : {}),
        };
      }}
    >
      {(error) => (
        <>
          <input type="hidden" name="active" value={String(record?.active ?? true)} />
          <p className="text-pretty text-sm text-on-surface-variant">
            Khai báo thông tin danh mục (Tên, Mã, ĐVT, Kho). Số lượng tồn và số lô được nhập qua Phiếu Nhập kho theo lô.
          </p>
          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
            <h3 className="mb-3 border-b border-outline-variant pb-2 text-balance text-sm font-semibold text-on-surface">
              1. Thông tin định danh & Phân loại
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["name", "Tên vật tư tiêu hao"],
                  ["code", "Mã vật tư"],
                ] as const
              ).map(([name, label]) => (
                <Field
                  key={name}
                  name={name}
                  label={label}
                  value={record?.[name]}
                  required
                  error={error}
                  placeholder={name === "name" ? "vd: Găng tay y tế Nitrile không bột Vglove (Size M)" : "vd: VT-GT-01"}
                />
              ))}
              <Field
                name="category"
                label="Danh mục phân loại"
                value={category}
                onSelectChange={setCategory}
                required
                error={error}
                actionButton={{
                  label: "Thêm phân loại",
                  onClick: () => setQuickAdd("categories"),
                }}
                options={[
                  { value: "", label: "Chọn hoặc bấm + Thêm phân loại..." },
                  ...categories.map((x) => ({
                    value: x.name,
                    label: x.name,
                  })),
                  ...(category && !categories.some((x) => x.name === category)
                    ? [{ value: category, label: category }]
                    : []),
                ]}
              />
              <Field
                name="unit"
                label="Đơn vị tính"
                value={record?.unit || "Hộp"}
                required
                error={error}
                options={[
                  ...(!units.includes(record?.unit || "Hộp") && record?.unit
                    ? [{ value: record.unit, label: record.unit }]
                    : []),
                  ...units.map((unit) => ({ value: unit, label: unit })),
                ]}
              />
              <Field
                name="unitPrice"
                label="Đơn giá nhập dự kiến (VNĐ)"
                type="number"
                min={0}
                value={String(record?.unitPrice || 0)}
                placeholder="vd: 85000"
              />
            </div>
            {quickAdd === "categories" && (
              <QuickDirectoryPanel
                api={api}
                kind="categories"
                onClose={() => setQuickAdd(null)}
                onCreated={(created) => handleQuickCreated("categories", created)}
              />
            )}
          </section>

          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
            <h3 className="mb-3 border-b border-outline-variant pb-2 text-balance text-sm font-semibold text-on-surface">
              2. Nguồn cung ứng & Vị trí lưu trữ
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                name="supplierId"
                label="Nhà cung cấp / Hãng sản xuất"
                value={supplierId}
                onSelectChange={setSupplierId}
                error={error}
                required
                actionButton={{
                  label: "Thêm nhà cung cấp",
                  onClick: () => setQuickAdd("suppliers"),
                }}
                options={[
                  { value: "", label: "Chọn hoặc bấm + Thêm nhà cung cấp..." },
                  ...suppliers.map((x) => ({ value: x._id, label: x.name })),
                ]}
              />
              <Field
                name="warehouseId"
                label="Vị trí kho lưu trữ"
                value={warehouseId}
                onSelectChange={setWarehouseId}
                required
                error={error}
                actionButton={{
                  label: "Thêm kho lưu trữ",
                  onClick: () => setQuickAdd("warehouses"),
                }}
                options={[
                  { value: "", label: "Chọn hoặc bấm + Thêm kho lưu trữ..." },
                  ...warehouses.map((x) => ({ value: x._id, label: x.name })),
                ]}
              />
              <Field
                name="departmentId"
                label="Phòng ban / Kho liên kết (nếu có)"
                value={record?.departmentId}
                options={[
                  { value: "", label: "Chọn phòng ban đặt kho liên kết..." },
                  ...refs.departments.map((x) => ({ value: x._id, label: x.name })),
                ]}
              />
            </div>
            {(quickAdd === "suppliers" || quickAdd === "warehouses") && (
              <QuickDirectoryPanel
                api={api}
                kind={quickAdd}
                onClose={() => setQuickAdd(null)}
                onCreated={(created) => handleQuickCreated(quickAdd, created)}
              />
            )}
          </section>

          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
            <h3 className="border-b border-outline-variant pb-2 text-balance text-sm font-semibold text-on-surface">
              3. Thiết lập tồn kho & Cảnh báo
            </h3>
            <div className="grid gap-3 pt-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-medium">
                Số lượng tồn kho
                <input
                  aria-label="Số lượng tồn kho"
                  className={controlClass}
                  value={record?.quantity || 0}
                  readOnly
                  type="number"
                />
                <span className="block text-xs font-normal text-on-surface-variant">
                  Sản phẩm mới có tồn kho bằng 0. Sau khi tạo, dùng “+ Nhập kho theo lô” để nhập số lượng hàng.
                </span>
              </label>
              <div className="space-y-1">
                <Field
                  type="number"
                  min={0}
                  step="0.001"
                  name="minQuantity"
                  label="Mức tồn tối thiểu cảnh báo"
                  value={String(record?.minQuantity ?? 10)}
                  error={error}
                />
                <span className="block text-xs text-on-surface-variant">
                  Cảnh báo khi chạm mốc này.
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
            <h3 className="mb-3 border-b border-outline-variant pb-2 text-balance text-sm font-semibold text-on-surface">
              4. Lô hàng & Hạn sử dụng
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                name="batchNumber"
                label="Số lô sản xuất (Batch/Lot)"
                value={record?.batchNumber}
                placeholder="vd: LOT-2026-A1"
              />
              <Field
                name="manufactureDay"
                label="Ngày sản xuất"
                type="date"
                value={record?.manufactureDay}
              />
              <Field
                name="expiryDay"
                label="Hạn sử dụng (HSD)"
                type="date"
                value={record?.expiryDay}
                disabled={!requiresExpiry}
              />
              <Field
                name="requiresExpiry"
                label="Vật tư có quản lý hạn dùng"
                value={String(requiresExpiry)}
                onSelectChange={(value) => setRequiresExpiry(value === "true")}
                options={[
                  { value: "true", label: "Có quản lý hạn dùng" },
                  { value: "false", label: "Không có hạn dùng" },
                ]}
              />
              <p className="self-center text-sm text-on-surface-variant">
                Chưa có hạn dùng: hàng chưa được phép xuất dùng.
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
            <h3 className="mb-3 border-b border-outline-variant pb-2 text-balance text-sm font-semibold text-on-surface">
              5. Kiểm định & Chứng nhận chất lượng
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                name="inspectionDay"
                label="Ngày kiểm định"
                type="date"
                value={record?.inspectionDay}
              />
              <Field
                name="nextInspectionDay"
                label="Hạn kiểm định tiếp theo"
                type="date"
                value={record?.nextInspectionDay}
              />
              <Field
                name="inspectionCertificateNumber"
                label="Số phiếu / Giấy kiểm định"
                value={record?.inspectionCertificateNumber}
                placeholder="vd: KD-2026/08/BYT"
              />
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
            <h3 className="border-b border-outline-variant pb-2 text-balance text-sm font-semibold text-on-surface">
              6. Hình ảnh, Tài liệu CO/CQ & Điều kiện bảo quản
            </h3>
            <CatalogMediaFields
              imageUrl={record?.imageUrl}
              image={image}
              documents={files}
              onImage={setImage}
              onDocuments={setFiles}
            />
            <label className="block space-y-1 text-sm font-medium">
              Ghi chú điều kiện bảo quản & Lưu ý sử dụng
              <textarea
                name="notes"
                rows={3}
                defaultValue={record?.notes || ""}
                className={`${controlClass} !h-auto`}
              />
            </label>
          </section>
        </>
      )}
    </LogisticsForm>
  );
}

function QuickDirectoryPanel({
  api,
  kind,
  onClose,
  onCreated,
}: {
  api: HealthcareApi;
  kind: DirectoryKind;
  onClose: () => void;
  onCreated: (created: DirectoryRecord) => void;
}) {
  const meta = quickAddMeta[kind];
  const baseId = useId();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    if (!trimmedCode || !trimmedName) {
      setError("Vui lòng nhập đầy đủ mã và tên.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await api.json<DirectoryRecord>(`/logistics/directories/${kind}`, {
        method: "POST",
        body: JSON.stringify({
          code: trimmedCode,
          name: trimmedName,
          active: true,
          ...(meta.extraField && extra.trim() ? { [meta.extraField.key]: extra.trim() } : {}),
        }),
      });
      onCreated(created);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (!busy) void submit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!busy) onClose();
    }
  }

  const errorId = `${baseId}-error`;
  return (
    <div
      role="region"
      aria-label={meta.title}
      className="mt-3 space-y-3 rounded-lg border border-outline-variant bg-surface p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-balance text-sm font-semibold text-on-surface">{meta.title}</h4>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Đóng biểu mẫu thêm nhanh"
          className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className={cn("grid gap-3", meta.extraField ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        <div className="min-w-0 space-y-1">
          <label htmlFor={`${baseId}-code`} className="block text-sm font-medium text-on-surface">
            Mã<span aria-hidden="true"> *</span>
          </label>
          <input
            id={`${baseId}-code`}
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={meta.codePlaceholder}
            aria-required="true"
            aria-invalid={Boolean(error && !code.trim()) || undefined}
            aria-describedby={error ? errorId : undefined}
            disabled={busy}
            className={controlClass}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <label htmlFor={`${baseId}-name`} className="block text-sm font-medium text-on-surface">
            Tên<span aria-hidden="true"> *</span>
          </label>
          <input
            id={`${baseId}-name`}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={meta.namePlaceholder}
            aria-required="true"
            aria-invalid={Boolean(error && !name.trim()) || undefined}
            aria-describedby={error ? errorId : undefined}
            disabled={busy}
            className={controlClass}
          />
        </div>
        {meta.extraField && (
          <div className="min-w-0 space-y-1">
            <label htmlFor={`${baseId}-extra`} className="block text-sm font-medium text-on-surface">
              {meta.extraField.label}
            </label>
            <input
              id={`${baseId}-extra`}
              type="text"
              value={extra}
              onChange={(event) => setExtra(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={meta.extraField.placeholder}
              disabled={busy}
              className={controlClass}
            />
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-pretty text-xs text-error">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className={buttonClass} disabled={busy} onClick={onClose}>
          Hủy
        </button>
        <button type="button" className={primaryClass} disabled={busy} onClick={() => void submit()}>
          {busy ? "Đang thêm…" : "Thêm"}
        </button>
      </div>
    </div>
  );
}

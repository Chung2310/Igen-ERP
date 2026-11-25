import { useState } from "react";
import type {
  Supply,
  LogisticsReferences,
} from "../../../../shared/healthcare-logistics";
import type { HealthcareApi } from "../api";
import { Field, controlClass } from "../ui";
import CatalogMediaFields from "./CatalogMediaFields";
import { LogisticsForm, formValues } from "./LogisticsForm";
export default function SupplyEditor({
  api,
  record,
  refs,
  onClose,
  onSaved,
}: {
  api: HealthcareApi;
  record?: Supply;
  refs: LogisticsReferences;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [documents] = useState(record?.documents || []);
  const [image, setImage] = useState<File>();
  const [files, setFiles] = useState<File[]>([]);
  const [requiresExpiry, setRequiresExpiry] = useState(record?.requiresExpiry ?? true);
  const units = ["Hộp", "Cái", "Gói", "Ống", "Chai", "Cuộn"];
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
                value={record?.category}
                required
                error={error}
                options={[
                  { value: "", label: "Chọn hoặc bấm + Thêm phân loại..." },
                  ...(refs.categories || []).map((x) => ({
                    value: x.name,
                    label: x.name,
                  })),
                  ...(record?.category &&
                  !refs.categories?.some((x) => x.name === record.category)
                    ? [{ value: record.category, label: record.category }]
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
          </section>

          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
            <h3 className="mb-3 border-b border-outline-variant pb-2 text-balance text-sm font-semibold text-on-surface">
              2. Nguồn cung ứng & Vị trí lưu trữ
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                name="supplierId"
                label="Nhà cung cấp / Hãng sản xuất"
                value={record?.supplierId}
                error={error}
                required
                options={[
                  { value: "", label: "Chọn hoặc bấm + Thêm nhà cung cấp..." },
                  ...refs.suppliers.map((x) => ({ value: x._id, label: x.name })),
                ]}
              />
              <Field
                name="warehouseId"
                label="Vị trí kho lưu trữ"
                value={record?.warehouseId}
                required
                error={error}
                options={[
                  { value: "", label: "Chọn hoặc bấm + Thêm kho lưu trữ..." },
                  ...refs.warehouses.map((x) => ({ value: x._id, label: x.name })),
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

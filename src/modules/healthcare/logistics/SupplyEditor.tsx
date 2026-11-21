import { useState } from "react";
import type {
  Supply,
  LogisticsReferences,
} from "../../../../shared/healthcare-logistics";
import type { HealthcareApi } from "../api";
import { Field, controlClass } from "../ui";
import CatalogMediaFields from "./CatalogMediaFields";
import { LogisticsForm, formValues } from "./LogisticsForm";
import { AttachmentFields } from "./LogisticsFiles";
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
  const [documents, setDocuments] = useState(record?.documents || []);
  const [image, setImage] = useState<File>();
  const [files, setFiles] = useState<File[]>([]);
  const [requiresExpiry, setRequiresExpiry] = useState(record?.requiresExpiry ?? true);
  return (
    <LogisticsForm
      title={record ? "Sửa vật tư" : "Thêm vật tư"}
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
          ...Object.fromEntries(
            Object.entries(v).filter(([key]) => !key.startsWith("attachment-")),
          ),
          minQuantity: Number(v.minQuantity),
          unitPrice: Number(v.unitPrice),
          requiresExpiry,
          expiryDay: requiresExpiry ? v.expiryDay : "",
          active: v.active === "true",
          documents,
          imageUrl: record?.imageUrl || "",
          ...(record ? { revision: record.revision } : {}),
        };
      }}
    >
      {(error) => (
        <>
          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <h3 className="border-b border-outline-variant pb-3 text-sm font-semibold text-on-surface sm:col-span-2">
              1. Thông tin định danh & Phân loại
            </h3>
            {(
              [
                ["name", "Tên vật tư tiêu hao"],
                ["code", "Mã vật tư"],
                ["unit", "Đơn vị tính"],
              ] as const
            ).map(([name, label]) => (
              <Field
                key={name}
                name={name}
                label={label}
                value={record?.[name]}
                required={["code", "name", "unit"].includes(name)}
                error={error}
              />
            ))}
            <Field
              name="category"
              label="Danh mục phân loại"
              value={record?.category}
              options={[
                { value: "", label: "Chưa chọn" },
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
              name="unitPrice"
              label="Đơn giá nhập dự kiến (VNĐ)"
              type="number"
              min={0}
              value={String(record?.unitPrice || 0)}
            />
          </div>
          </section>
          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <h3 className="border-b border-outline-variant pb-3 text-sm font-semibold text-on-surface sm:col-span-2">
              2. Nhà cung cấp & Vị trí lưu kho
            </h3>
            <Field
              name="supplierId"
              label="Nhà cung cấp"
              value={record?.supplierId}
              error={error}
              options={[
                { value: "", label: "Chưa chọn" },
                ...refs.suppliers.map((x) => ({ value: x._id, label: x.name })),
              ]}
            />
            <Field
              name="warehouseLocation"
              label="Vị trí lưu trữ cụ thể"
              value={record?.warehouseLocation}
            />
            {(["warehouseId", "roomId"] as const).map((name) => (
              <Field
                key={name}
                name={name}
                label={name === "warehouseId" ? "Kho lưu trữ" : "Phòng"}
                value={record?.[name]}
                options={[
                  { value: "", label: "Chưa chọn" },
                  ...(name === "warehouseId"
                    ? refs.warehouses
                    : refs.rooms
                  ).map((x) => ({
                    value: x._id,
                    label: x.name,
                  })),
                ]}
              />
            ))}
          </div>
          </section>
          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <h3 className="border-b border-outline-variant pb-3 text-sm font-semibold text-on-surface sm:col-span-2">
              3. Thiết lập tồn kho & Cảnh báo
            </h3>
            <label className="space-y-1 text-sm font-medium">
              Số lượng tồn kho
              <input
                aria-label="Số lượng tồn kho"
                className={controlClass}
                value={record?.quantity || 0}
                readOnly
                type="number"
              />
            </label>
            <p className="text-sm text-on-surface-variant">
              Số tồn thay đổi qua chứng từ kho. Vật tư mới có tồn bằng 0.
            </p>
            <Field
              type="number"
              min={0}
              step="0.001"
              name="minQuantity"
              label="Mức tồn tối thiểu cảnh báo"
              value={String(record?.minQuantity || 0)}
              error={error}
            />
          </div>
          </section>
          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <h3 className="border-b border-outline-variant pb-3 text-sm font-semibold text-on-surface sm:col-span-2">
              4. Thông tin lô & Hạn sử dụng
            </h3>
            <Field
              name="batchNumber"
              label="Số lô sản xuất (Batch/Lot)"
              value={record?.batchNumber}
            />
            <Field
              name="expiryDay"
              label="Hạn sử dụng (HSD)"
              type="date"
              value={record?.expiryDay}
              disabled={!requiresExpiry}
            />
            {(
              [
                ["manufactureDay", "Ngày sản xuất"],
              ] as const
            ).map(([name, label]) => (
              <Field
                key={name}
                name={name}
                label={label}
                type="date"
                value={record?.[name]}
              />
            ))}
            <Field
              name="requiresExpiry"
              label="Theo dõi hạn dùng"
              value={String(requiresExpiry)}
              onSelectChange={(value) => setRequiresExpiry(value === "true")}
              options={[
                { value: "true", label: "Bắt buộc hạn dùng" },
                { value: "false", label: "Không bắt buộc" },
              ]}
            />
            <Field
              name="active"
              label="Trạng thái"
              value={String(record?.active ?? true)}
              options={[
                { value: "true", label: "Đang sử dụng" },
                { value: "false", label: "Ngừng sử dụng" },
              ]}
            />
          </div>
          </section>
          <fieldset className="grid gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:grid-cols-2 sm:p-5">
            <legend className="px-1 text-sm font-semibold text-on-surface">
              5. Kiểm định & Chứng nhận chất lượng
            </legend>
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
            />
          </fieldset>
          <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
          <h3 className="border-b border-outline-variant pb-3 text-sm font-semibold text-on-surface">6. Hình ảnh, tài liệu CO/CQ & Điều kiện bảo quản</h3>
          <CatalogMediaFields
            imageUrl={record?.imageUrl}
            image={image}
            documents={files}
            onImage={setImage}
            onDocuments={setFiles}
          />
          <AttachmentFields documents={documents} onChange={setDocuments} />
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

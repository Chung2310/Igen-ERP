import { useState } from "react";
import { DateInput24 } from "../../../components/common/TimeInput24";
import type {
  Attachment,
  Equipment,
  LogisticsReferences,
} from "../../../../shared/healthcare-logistics";
import { equipmentLabels } from "../../../../shared/healthcare-logistics";
import type { HealthcareApi } from "../api";
import { Field, buttonClass, controlClass } from "../ui";
import { LogisticsForm, formValues } from "./LogisticsForm";
import { AttachmentFields } from "./LogisticsFiles";

export default function EquipmentEditor({
  api,
  record,
  refs,
  onClose,
  onSaved,
}: {
  api: HealthcareApi;
  record?: Equipment;
  refs: LogisticsReferences;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [documents, setDocuments] = useState(record?.documents || []);
  const [cycle, setCycle] = useState(record?.inspectionCycleMonths ?? 12);
  const [lastDay, setLastDay] = useState(record?.lastInspectionDay || "");
  const [nextDay, setNextDay] = useState(record?.nextInspectionDay || "");
  function updateInspection(day: string, months: number) {
    setLastDay(day);
    if (day) {
      const date = new Date(`${day}T00:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() + (months || 12));
      setNextDay(date.toISOString().slice(0, 10));
    }
  }
  const [imageFile, setImageFile] = useState<File>();
  const [reportFile, setReportFile] = useState<File>();
  const [pendingDocuments, setPendingDocuments] = useState<
    { file: File; details: Omit<Attachment, "url"> }[]
  >([]);
  async function upload(
    id: string,
    file: File,
    field?: "image" | "report",
    details?: Omit<Attachment, "url">,
  ) {
    const body = new FormData();
    body.set("file", file);
    if (field) body.set(field, "true");
    if (details) body.set("metadata", JSON.stringify(details));
    await api.json(`/logistics/files/equipment/${id}/attachment`, {
      method: "POST",
      body,
    });
  }
  const fields = [
    ["code", "Mã thiết bị"],
    ["name", "Tên thiết bị"],
    ["category", "Danh mục thiết bị"],
    ["location", "Vị trí"],
    ["manufacturer", "Hãng sản xuất"],
    ["modelNumber", "Ký hiệu Model"],
    ["serialNumber", "Số Seri (Serial No.)"],
    ["originCountry", "Xuất xứ"],
  ] as const;
  return (
    <LogisticsForm
      title={record ? "Sửa thiết bị" : "Thêm thiết bị"}
      maxWidth="max-w-5xl"
      api={api}
      path={`/logistics/equipment${record ? `/${record._id}` : ""}`}
      method={record ? "PATCH" : "POST"}
      onClose={onClose}
      onSaved={onSaved}
      afterSaved={async (result) => {
        const id = (result as Equipment)._id;
        try {
          if (imageFile) await upload(id, imageFile, "image");
          if (reportFile) await upload(id, reportFile, "report");
          for (const { file, details } of pendingDocuments)
            await upload(id, file, undefined, details);
        } catch (error) {
          throw new Error(
            `Thiết bị đã được lưu nhưng chưa tải hết tệp. Mở Hồ sơ để tải lại. ${error instanceof Error ? error.message : ""}`,
          );
        }
      }}
      payload={(data) => {
        const values = formValues(data);
        return {
          ...Object.fromEntries(
            Object.entries(values).filter(([key]) => !key.startsWith("pending-")),
          ),
          imageUrl: record?.imageUrl || "",
          lastInspectionReportUrl: record?.lastInspectionReportUrl || "",
          inspectionCycleMonths: Number(values.inspectionCycleMonths),
          documents,
          ...(record ? { revision: record.revision } : {}),
        };
      }}
    >
      {(error) => (
        <>
          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
            <h3 className="mb-3 border-b border-outline-variant pb-2 text-sm font-semibold text-on-surface">
              Thông tin cơ bản & Phân loại thiết bị
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map(([name, label]) => (
                <Field
                  key={name}
                  name={name}
                  label={label}
                  value={record?.[name] || ""}
                  required={
                    name === "code" || name === "name" || name === "category"
                  }
                  error={error}
                />
              ))}
              <Field
                name="status"
                label="Trạng thái"
                value={record?.status || "available"}
                options={Object.entries(equipmentLabels)
                  .filter(([value]) => !["requested", "in-use"].includes(value))
                  .map(([value, label]) => ({ value, label }))}
              />
              <Field
                name="departmentId"
                label="Phòng ban quản lý"
                value={record?.departmentId}
                options={[
                  { value: "", label: "Chưa phân công" },
                  ...refs.departments.map((x) => ({
                    value: x._id,
                    label: x.name,
                  })),
                ]}
                error={error}
              />
              <Field
                name="roomId"
                label="Vị trí phòng (Chi nhánh)"
                value={record?.roomId}
                options={[
                  { value: "", label: "Chưa phân phòng" },
                  ...refs.rooms.map((x) => ({ value: x._id, label: x.name })),
                ]}
                error={error}
              />
              <Field
                name="riskClassification"
                label="Phân loại mức độ rủi ro (Bộ Y tế)"
                value={record?.riskClassification}
                options={["", "A", "B", "C", "D"].map((value) => ({
                  value,
                  label: value || "Chưa phân loại",
                }))}
              />
              <Field
                name="inspectionCycleMonths"
                label="Chu kỳ kiểm định định kỳ (tháng)"
                type="number"
                min={0}
                max={120}
                value={String(cycle)}
                onChange={(event) => {
                  const months = Number(event.target.value);
                  setCycle(months);
                  updateInspection(lastDay, months);
                }}
                error={error}
              />
              {(
                [
                  ["purchaseDay", "Ngày mua thiết bị"],
                  ["usageStartDay", "Ngày đưa vào sử dụng"],
                ] as const
              ).map(([name, label]) => (
                <Field
                  key={name}
                  type="date"
                  name={name}
                  label={label}
                  value={record?.[name]}
                  error={error}
                />
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
            <h3 className="mb-3 border-b border-outline-variant pb-2 text-sm font-semibold text-on-surface">
              Lịch Kiểm định, Hiệu chuẩn & Bảo trì
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1 text-sm font-medium">
                Ngày kiểm định / hiệu chuẩn / bảo trì gần nhất
                <DateInput24
                  ariaLabel="Ngày kiểm định / hiệu chuẩn / bảo trì gần nhất"
                  value={lastDay}
                  onChange={(value) => updateInspection(value, cycle)}
                />
                <input type="hidden" name="lastInspectionDay" value={lastDay} />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Ngày đến hạn kiểm định tiếp theo
                <DateInput24
                  ariaLabel="Ngày đến hạn kiểm định tiếp theo"
                  value={nextDay}
                  onChange={setNextDay}
                />
                <input type="hidden" name="nextInspectionDay" value={nextDay} />
              </label>
              <Field
                name="lastInspectionResult"
                label="Kết quả thực hiện"
                value={record?.lastInspectionResult || ""}
                options={[
                  { value: "", label: "Chưa kiểm định" },
                  { value: "pass", label: "Đạt" },
                  { value: "fail", label: "Không đạt" },
                  { value: "conditional", label: "Có điều kiện" },
                ]}
              />
              <Field
                name="lastInspectionProvider"
                label="Đơn vị thực hiện"
                value={record?.lastInspectionProvider || ""}
                error={error}
              />
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
            <h3 className="border-b border-outline-variant pb-2 text-sm font-semibold text-on-surface">
              Hình ảnh, Hồ sơ pháp lý & Ghi chú
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-start gap-2.5">
                {record?.imageUrl && (
                  <img
                    src={record.imageUrl}
                    alt={`Ảnh ${record.name}`}
                    className="size-14 shrink-0 rounded-lg border border-outline-variant object-cover"
                  />
                )}
                <FilePicker
                  label="Hình ảnh thiết bị"
                  accept="image/png,image/jpeg"
                  fileName={imageFile?.name}
                  onChange={(files) => setImageFile(files[0])}
                />
              </div>
              <FilePicker
                label="Biên bản kiểm định"
                accept=".pdf,.png,.jpg,.jpeg"
                fileName={reportFile?.name}
                onChange={(files) => setReportFile(files[0])}
              />
              <FilePicker
                label="Tệp hồ sơ pháp lý"
                accept=".pdf,.png,.jpg,.jpeg"
                fileName={pendingDocuments.map(({ file }) => file.name).join(", ")}
                multiple
                onChange={(files) =>
                  setPendingDocuments(
                    files.map((file) => ({
                      file,
                      details: { name: file.name, type: "co_cq" },
                    })),
                  )
                }
              />
            </div>
            <AttachmentFields
              documents={documents}
              onChange={setDocuments}
              equipment
            />
            {pendingDocuments.map(({ file, details }, index) => (
              <fieldset
                key={`${file.name}-${index}`}
                className="grid gap-3 rounded-lg border border-outline-variant p-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                <legend className="px-1 text-xs font-semibold text-on-surface">
                  Hồ sơ mới {index + 1}: {file.name}
                </legend>
                <Field
                  label="Tên tài liệu / văn bản"
                  name={`pending-title-${index}`}
                  value={details.name}
                  required
                  onChange={(event) =>
                    setPendingDocuments((rows) =>
                      rows.map((row, i) =>
                        i === index
                          ? {
                              ...row,
                              details: {
                                ...row.details,
                                name: event.target.value,
                              },
                            }
                          : row,
                      ),
                    )
                  }
                />
                <Field
                  label="Loại hồ sơ"
                  name={`pending-type-${index}`}
                  value={details.type}
                  options={[
                    { value: "co_cq", label: "Giấy chứng nhận CO/CQ" },
                    { value: "invoice", label: "Hóa đơn mua sắm" },
                    { value: "import_license", label: "Giấy phép nhập khẩu" },
                    { value: "circulation_license", label: "Giấy phép lưu hành" },
                    {
                      value: "calibration_cert",
                      label: "Giấy chứng nhận kiểm định",
                    },
                    { value: "manual", label: "Tài liệu kỹ thuật" },
                    { value: "other", label: "Tài liệu khác" },
                  ]}
                  onSelectChange={(value) =>
                    setPendingDocuments((rows) =>
                      rows.map((row, i) =>
                        i === index
                          ? { ...row, details: { ...row.details, type: value } }
                          : row,
                      ),
                    )
                  }
                />
                {(
                  [
                    ["number", "Số văn bản"],
                    ["authority", "Cơ quan cấp"],
                    ["issuedDay", "Ngày cấp"],
                    ["expiryDay", "Ngày hết hạn"],
                    ["notes", "Ghi chú hồ sơ"],
                  ] as const
                ).map(([key, label]) => (
                  <Field
                    key={key}
                    label={label}
                    name={`pending-${key}-${index}`}
                    type={key.endsWith("Day") ? "date" : "text"}
                    value={details[key] || ""}
                    onChange={(event) =>
                      setPendingDocuments((rows) =>
                        rows.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                details: {
                                  ...row.details,
                                  [key]: event.target.value,
                                },
                              }
                            : row,
                        ),
                      )
                    }
                  />
                ))}
              </fieldset>
            ))}
            <label className="block space-y-1 text-sm font-medium">
              Ghi chú
              <textarea
                name="notes"
                defaultValue={record?.notes || ""}
                rows={2}
                className={`${controlClass} !h-auto min-h-16`}
              />
            </label>
          </section>
        </>
      )}
    </LogisticsForm>
  );
}

function FilePicker({
  label,
  accept,
  fileName,
  onChange,
  multiple = false,
}: {
  label: string;
  accept: string;
  fileName?: string;
  onChange: (files: File[]) => void;
  multiple?: boolean;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>
        {label} (
        {accept === "image/png,image/jpeg" ? "PNG/JPEG" : "PDF/PNG/JPEG"}, tối
        đa 3 MB/tệp)
      </span>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="peer sr-only"
        onChange={(event) => onChange(Array.from(event.target.files || []))}
      />
      <span className="flex flex-wrap items-center gap-2">
        <span
          className={`${buttonClass} peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary`}
        >
          Chọn tệp
        </span>
        <span className="max-w-full truncate text-on-surface-variant">
          {fileName || "Chưa chọn tệp"}
        </span>
      </span>
    </label>
  );
}

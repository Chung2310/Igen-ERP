import { EquipmentDelete, BorrowHistory } from "./EquipmentHistory";
import { useState } from "react";
import { TablePagination } from "../../../components/common/TablePagination";
import type { Equipment, Inspection, LogisticsList } from "../../../../shared/healthcare-logistics";
import type { HealthcareApi } from "../api";
import { Cell, Field, Table, Feedback, useHealthcareQuery, dayLabel } from "../ui";
import { LogisticsForm, formValues } from "./LogisticsForm";
import { ErpModal } from "../../../components/common/ErpModal";
import { AttachmentUpload } from "./LogisticsFiles";

export default function EquipmentCompliance({
  record,
  api,
  canManage,
  onClose,
  onSaved,
}: {
  record: Equipment;
  api: HealthcareApi;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [page, setPage] = useState(1);
  const history = useHealthcareQuery<LogisticsList<Inspection>>(
    api,
    `/logistics/inspections?equipmentId=${record._id}&page=${page}`,
  );
  const details = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3">
        <div className="flex min-w-0 items-start gap-3">
          {record.imageUrl && (
            <a href={record.imageUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <img src={record.imageUrl} alt={record.name} className="size-16 rounded-lg border border-outline-variant object-cover" />
            </a>
          )}
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-on-surface">
              <span className="font-mono text-on-surface-variant">{record.code}</span> · {record.name}
            </p>
            <p className="text-xs text-on-surface-variant">
              Kiểm định tiếp theo: <strong className="font-medium text-on-surface">{dayLabel(record.nextInspectionDay)}</strong>
              {record.lastInspectionDay && (
                <>
                  {" · "}Gần nhất: {dayLabel(record.lastInspectionDay)} (
                  {record.lastInspectionResult === "pass"
                    ? "Đạt"
                    : record.lastInspectionResult === "fail"
                      ? "Không đạt"
                      : "Có điều kiện"}
                  {record.lastInspectionProvider ? ` — ${record.lastInspectionProvider}` : ""})
                </>
              )}
            </p>
            {record.lastInspectionReportUrl && (
              <a
                href={record.lastInspectionReportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs font-medium text-primary underline"
              >
                Xem biên bản kiểm định gần nhất
              </a>
            )}
          </div>
        </div>
        {canManage && !["requested", "in-use"].includes(record.status) && (
          <EquipmentDelete api={api} row={record} onSaved={onSaved} />
        )}
      </div>

      <dl className="grid gap-x-4 gap-y-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-sm sm:grid-cols-3">
        {[
          ["Nhà sản xuất", record.manufacturer],
          ["Model", record.modelNumber],
          ["Serial", record.serialNumber],
          ["Xuất xứ", record.originCountry],
          ["Rủi ro", record.riskClassification],
          ["Vị trí", record.location],
          ["Ghi chú", record.notes],
        ].map(([label, value]) => (
          <div key={label} className={label === "Ghi chú" ? "sm:col-span-3" : undefined}>
            <dt className="text-xs text-on-surface-variant">{label}</dt>
            <dd className="text-sm text-on-surface">{value || "—"}</dd>
          </div>
        ))}
      </dl>

      {(record.documents.length > 0 || canManage) && (
        <div className="space-y-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
          {record.documents.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {record.documents.map((doc, i) => (
                <a
                  className="inline-flex items-center rounded-md border border-outline-variant bg-surface-container-low px-2.5 py-1 text-xs text-primary underline hover:bg-surface-container"
                  key={i}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {doc.name} · {doc.type || "Hồ sơ"} {doc.number} {doc.authority}{" "}
                  {doc.expiryDay && `· HSD: ${dayLabel(doc.expiryDay)}`}
                </a>
              ))}
            </div>
          )}
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <AttachmentUpload api={api} kind="equipment" id={record._id} onSaved={onSaved} />
              <AttachmentUpload image api={api} kind="equipment" id={record._id} onSaved={onSaved} />
            </div>
          )}
        </div>
      )}

      <Feedback loading={history.loading} error={history.error} onRetry={history.refresh} />
      {history.data && (
        <Table
          headers={["Ngày", "Nghiệp vụ", "Kết quả", "Đơn vị", "Lần tiếp theo", "Biên bản / Thao tác"]}
          empty={!history.data.items.length ? "Chưa có lịch sử kiểm định." : undefined}
        >
          {history.data.items.map((row) => (
            <tr key={row._id}>
              <Cell>{dayLabel(row.day)}</Cell>
              <Cell>{{ inspection: "Kiểm định", calibration: "Hiệu chuẩn", maintenance: "Bảo dưỡng" }[row.kind]}</Cell>
              <Cell>{{ pass: "Đạt", fail: "Không đạt", conditional: "Có điều kiện" }[row.result]}</Cell>
              <Cell>{row.provider}</Cell>
              <Cell>{dayLabel(row.nextDay)}</Cell>
              <Cell>
                {row.reportUrl && (
                  <a href={row.reportUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    Xem biên bản
                  </a>
                )}
                {row.notes && <p>{row.notes}</p>}
                {canManage && !["requested", "in-use", "retired"].includes(record.status) && (
                  <EquipmentDelete api={api} row={row} inspection onSaved={onSaved} />
                )}
              </Cell>
            </tr>
          ))}
        </Table>
      )}
      <BorrowHistory api={api} equipmentId={record._id} />
      {history.data && history.data.total > 25 && (
        <TablePagination
          appearance="erp"
          currentPage={page}
          totalPages={Math.max(1, Math.ceil(history.data.total / 25))}
          totalItems={history.data.total}
          pageSize={25}
          pageSizeOptions={[25]}
          onPageChange={setPage}
          onPageSizeChange={() => {}}
        />
      )}
    </div>
  );
  if (!canManage || ["requested", "in-use", "retired"].includes(record.status))
    return (
      <ErpModal native title="Hồ sơ thiết bị" onClose={onClose} maxWidth="max-w-4xl">
        {details}
      </ErpModal>
    );
  return (
    <LogisticsForm
      title="Hồ sơ và kiểm định thiết bị"
      maxWidth="max-w-4xl"
      api={api}
      path={`/logistics/equipment/${record._id}/inspections`}
      onClose={onClose}
      onSaved={onSaved}
      payload={formValues}
    >
      {(error) => (
        <>
          {details}
          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
            <h3 className="mb-3 border-b border-outline-variant pb-2 text-sm font-semibold text-on-surface">
              Ghi nhận kiểm định / hiệu chuẩn / bảo dưỡng mới
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field name="day" type="date" label="Ngày thực hiện" required error={error} />
              <Field name="nextDay" type="date" label="Ngày tiếp theo" error={error} />
              <Field
                name="kind"
                label="Nghiệp vụ"
                options={[
                  { value: "inspection", label: "Kiểm định" },
                  { value: "calibration", label: "Hiệu chuẩn" },
                  { value: "maintenance", label: "Bảo dưỡng" },
                ]}
              />
              <Field
                name="result"
                label="Kết quả"
                options={[
                  { value: "pass", label: "Đạt" },
                  { value: "fail", label: "Không đạt" },
                  { value: "conditional", label: "Có điều kiện" },
                ]}
              />
              <Field name="provider" label="Đơn vị thực hiện" error={error} />
              <Field name="reportUrl" type="url" label="Liên kết biên bản HTTPS" error={error} />
              <div className="sm:col-span-2 lg:col-span-3">
                <Field name="notes" label="Ghi chú" error={error} />
              </div>
            </div>
          </section>
        </>
      )}
    </LogisticsForm>
  );
}

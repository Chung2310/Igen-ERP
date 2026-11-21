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
      <p>
        {record.code} · {record.name}
      </p>
      <p>Kiểm định tiếp theo: {dayLabel(record.nextInspectionDay)}</p>
      {record.lastInspectionDay && (
        <p>
          Lần gần nhất: {dayLabel(record.lastInspectionDay)} ·{" "}
          {record.lastInspectionResult === "pass"
            ? "Đạt"
            : record.lastInspectionResult === "fail"
              ? "Không đạt"
              : "Có điều kiện"}{" "}
          · {record.lastInspectionProvider || "Chưa rõ đơn vị"}
        </p>
      )}
      {record.lastInspectionReportUrl && (
        <a
          href={record.lastInspectionReportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
        >
          Xem biên bản kiểm định gần nhất
        </a>
      )}
      {record.imageUrl && (
        <a href={record.imageUrl} target="_blank" rel="noopener noreferrer">
          <img src={record.imageUrl} alt={record.name} className="max-h-60 rounded-lg object-contain" />
        </a>
      )}
      <dl className="grid gap-2 sm:grid-cols-2">
        {[
          ["Nhà sản xuất", record.manufacturer],
          ["Model", record.modelNumber],
          ["Serial", record.serialNumber],
          ["Xuất xứ", record.originCountry],
          ["Rủi ro", record.riskClassification],
          ["Vị trí", record.location],
          ["Ghi chú", record.notes],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-on-surface-variant">{label}</dt>
            <dd>{value || "—"}</dd>
          </div>
        ))}
      </dl>
      {record.documents.map((doc, i) => (
        <a className="block text-primary underline" key={i} href={doc.url} target="_blank" rel="noopener noreferrer">
          {doc.name} · {doc.type || "Hồ sơ"} {doc.number} {doc.authority}{" "}
          {doc.expiryDay && `· Hết hạn: ${dayLabel(doc.expiryDay)}`}
        </a>
      ))}
      {canManage && <AttachmentUpload api={api} kind="equipment" id={record._id} onSaved={onSaved} />}
      {canManage && <AttachmentUpload image api={api} kind="equipment" id={record._id} onSaved={onSaved} />}
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
      {history.data && (
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
      {canManage && !["requested", "in-use"].includes(record.status) && (
        <EquipmentDelete api={api} row={record} onSaved={onSaved} />
      )}
    </div>
  );
  if (!canManage || ["requested", "in-use", "retired"].includes(record.status))
    return (
      <ErpModal native title="Hồ sơ thiết bị" onClose={onClose} maxWidth="max-w-3xl">
        {details}
      </ErpModal>
    );
  return (
    <LogisticsForm
      title="Hồ sơ và kiểm định thiết bị"
      api={api}
      path={`/logistics/equipment/${record._id}/inspections`}
      onClose={onClose}
      onSaved={onSaved}
      payload={formValues}
    >
      {(error) => (
        <>
          {details}
          <div className="grid gap-3 sm:grid-cols-2">
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
            <Field name="notes" label="Ghi chú" error={error} />
          </div>
        </>
      )}
    </LogisticsForm>
  );
}

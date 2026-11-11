import { Pencil } from "lucide-react";
import type { Patient } from "../../../shared/healthcare";
import { ErpModal } from "../../components/common/ErpModal";
import type { HealthcareApi } from "./api";
import { Cell, dayLabel, Feedback, IconActionButton, Table, useHealthcareQuery } from "./ui";

const birthLabel = (patient: Patient) => patient.dateOfBirth ? dayLabel(patient.dateOfBirth) : patient.hospitalProfile?.birthYear || "—";

export default function PatientDetailsModal({ patientId, api, canManage, onClose, onEdit }: {
  patientId: string; api: HealthcareApi; canManage: boolean; onClose: () => void; onEdit: (patient: Patient) => void;
}) {
  const patient = useHealthcareQuery<Patient>(api, `/patients/${patientId}`);
  const record = patient.data;

  return <ErpModal native title={record ? `Hồ sơ bệnh nhân · ${record.code}` : "Hồ sơ bệnh nhân"} maxWidth="max-w-3xl" onClose={onClose}>
    <Feedback loading={patient.loading} error={patient.error} onRetry={patient.refresh} />
    {record && <>
      <Table headers={["Thông tin hồ sơ", "Giá trị"]}>
        {[
          ["Mã bệnh nhân", record.code], ["Họ và tên", record.name], ["Điện thoại", record.phone],
          ["Ngày sinh / năm sinh", birthLabel(record)], ["Giới tính", record.hospitalProfile?.gender],
          ["Điện thoại trong file Excel", record.hospitalProfile?.phoneText], ["Địa chỉ", record.address], ["Ghi chú", record.note],
        ].map(([label, value]) => <tr key={label}><Cell>{label}</Cell><Cell>{value || "—"}</Cell></tr>)}
      </Table>
      {canManage && <div className="flex justify-end border-t border-outline-variant pt-3">
        <IconActionButton label="Sửa hồ sơ bệnh nhân" icon={Pencil} ariaHaspopup onClick={() => onEdit(record)} />
      </div>}
    </>}
  </ErpModal>;
}

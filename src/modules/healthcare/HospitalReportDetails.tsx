import { ErpModal } from "../../components/common/ErpModal";
import { hospitalReportColumns, type HealthcareRecord, type HospitalReportFields, type Visit } from "../../../shared/healthcare";
import type { HealthcareApi } from "./api";
import { Feedback, useHealthcareQuery } from "./ui";

export default function HospitalReportDetails({ visit, api, onClose }: { visit: Visit; api: HealthcareApi; onClose: () => void }) {
  const report = useHealthcareQuery<{ fields: HospitalReportFields; source?: HealthcareRecord["source"] }>(api, `/visits/${visit._id}/report`);
  return <ErpModal native title={`Phiếu khám Excel ${visit.code}`} maxWidth="max-w-3xl" onClose={onClose}>
    <Feedback loading={report.loading} error={report.error} onRetry={report.refresh} />
    {report.data && <>
      {report.data.source?.sheet && <p className="text-pretty text-sm text-on-surface-variant">
        Sheet {report.data.source.sheet} · Dòng {report.data.source.row}
      </p>}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {(Object.keys(hospitalReportColumns) as (keyof HospitalReportFields)[]).map(key => {
          const value = report.data?.fields[key];
          if (!value) return null;
          return <div key={key} className="min-w-0">
            <dt className="font-medium text-on-surface-variant">{hospitalReportColumns[key]}</dt>
            <dd className="whitespace-pre-wrap break-words">{key === "ngay_gio_kham" ? value.replace("T", " ") : value}</dd>
          </div>;
        })}
      </dl>
    </>}
  </ErpModal>;
}

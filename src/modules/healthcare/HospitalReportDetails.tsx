import { ErpModal } from "../../components/common/ErpModal";
import { hospitalReportColumns, type HealthcareRecord, type HospitalReportFields, type Visit } from "../../../shared/healthcare";
import type { HealthcareApi } from "./api";
import { Feedback, useHealthcareQuery } from "./ui";

const wideFields = new Set<keyof HospitalReportFields>([
  "dia_chi", "ly_do_vao_vien", "trieu_chung", "chan_doan", "phuong_phap_dieu_tri", "dich_vu_dieu_tri",
]);

export default function HospitalReportDetails({ visit, api, onClose }: { visit: Visit; api: HealthcareApi; onClose: () => void }) {
  const report = useHealthcareQuery<{ fields: HospitalReportFields; source?: HealthcareRecord["source"] }>(api, `/visits/${visit._id}/report`);
  return <ErpModal native title={`Phiếu khám Excel ${visit.code}`} maxWidth="max-w-5xl" onClose={onClose}>
    <Feedback loading={report.loading} error={report.error} onRetry={report.refresh} />
    {report.data && <>
      {report.data.source?.sheet && <p className="inline-flex rounded-lg bg-surface-container-low px-3 py-2 text-xs font-medium text-on-surface-variant">
        Sheet {report.data.source.sheet} <span className="mx-1.5 text-outline">·</span> Dòng {report.data.source.row}
      </p>}
      <dl className="grid gap-2.5 text-sm sm:grid-cols-2">
        {(Object.keys(hospitalReportColumns) as (keyof HospitalReportFields)[]).map(key => {
          const value = report.data?.fields[key];
          if (!value) return null;
          const displayValue = key === "ngay_gio_kham"
            ? value.replace(/^(\d{4})-(\d{2})-(\d{2})T/, "$3/$2/$1 ")
            : ["ngay_sinh", "ngay_hen_tai_kham"].includes(key) && /^\d{4}-\d{2}-\d{2}$/.test(value)
              ? value.split("-").reverse().join("/")
              : value;
          return <div key={key} className={`min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 ${wideFields.has(key) ? "sm:col-span-2" : ""}`}>
            <dt className="text-xs font-medium text-on-surface-variant">{hospitalReportColumns[key]}</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-5 text-on-surface">{displayValue}</dd>
          </div>;
        })}
      </dl>
    </>}
  </ErpModal>;
}

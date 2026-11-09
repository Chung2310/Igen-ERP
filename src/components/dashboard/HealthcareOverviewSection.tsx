import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import type { HealthcareOverview } from "../../../shared/healthcare";
import { useAuth } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import { healthcareApi } from "../../modules/healthcare/api";
import { healthcareHref } from "../../modules/healthcare/navigation";
import { appointmentLabels, Cell, dayLabel, Feedback, RowLink, StatusBadge, Table, timeLabel, useHealthcareQuery } from "../../modules/healthcare/ui";
import { ErpRefreshButton } from "../common/ErpRefreshButton";
import { OverviewPeriodActions, useOverviewPeriod } from "./OverviewPeriodContext";
import "../../modules/finance/finance-overview.css";

const integer = new Intl.NumberFormat("vi-VN");

export default function HealthcareOverviewSection() {
  const { userProfile } = useAuth();
  const branch = useBranch();
  if (branch.loading) return <div className="finance-chart-card"><Feedback loading /></div>;
  if (!branch.activeBranchId) return <div className="finance-chart-card">
    <Feedback error={branch.error || "Chọn chi nhánh đang hoạt động để xem Tổng quan y tế."} onRetry={branch.error ? branch.retry : undefined} />
  </div>;
  return <HealthcareOverviewContent key={`${userProfile?.uid}:${userProfile?.companyCode}:${branch.activeBranchId}`}
    branchId={branch.activeBranchId} branchName={branch.activeBranch?.name} />;
}

function HealthcareOverviewContent({ branchId, branchName }: { branchId: string; branchName?: string }) {
  const period = useOverviewPeriod();
  const api = useMemo(() => healthcareApi(branchId), [branchId]);
  const path = period ? `/overview?${new URLSearchParams({ from: period.from, to: period.to })}` : "/overview";
  const { data, loading, error, refreshing, refresh } = useHealthcareQuery<HealthcareOverview>(api, path);
  const patientMap = new Map(data?.patientReferences.map(row => [row._id, row]));
  const patientLink = (id: string) => {
    const patient = patientMap.get(id);
    return <RowLink href={healthcareHref({ tab: "patients", patientId: id }, branchId)}>
      {patient ? `${patient.code} · ${patient.name}` : "Mở hồ sơ bệnh nhân"}
    </RowLink>;
  };

  return <section aria-labelledby="healthcare-overview-title" className="space-y-3 text-on-surface">
    <OverviewPeriodActions><ErpRefreshButton loading={refreshing} onClick={refresh} /></OverviewPeriodActions>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 id="healthcare-overview-title" data-typography="section-title" className="text-balance text-lg font-semibold">Tổng quan y tế</h2>
        {branchName && <p className="text-sm text-on-surface-variant">{branchName}</p>}
      </div>
      <a href={healthcareHref({ tab: "patients" }, branchId)} className="inline-flex min-h-9 items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        Mở Quản lý y tế <ArrowRight className="size-4" aria-hidden="true" />
      </a>
    </div>
    {(loading || error) && <div className="finance-chart-card"><Feedback loading={loading} error={error} onRetry={refresh} /></div>}
    {data && <>
      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {([
          ["Tổng bệnh nhân", data.patients],
          [!period || period.selection === "day" ? "Lượt khám hôm nay" : "Lượt khám trong kỳ", data.visitCount],
          ["Lịch hẹn hôm nay", data.appointmentCount],
          ["Việc chăm sóc đến hạn", data.careCount],
        ] as const).map(([label, value]) => value === null ? null : (
          <div key={label} className="finance-chart-card">
            <dt className="text-pretty text-sm text-on-surface-variant">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{integer.format(value)}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-3 xl:grid-cols-2">
        {data.appointmentCount !== null && <section className="finance-chart-card space-y-3">
          <h3 className="text-balance text-sm font-semibold">Lịch hẹn hôm nay</h3>
          <Table headers={["Bệnh nhân", "Giờ hẹn", "Trạng thái"]} emptyKind="calendar" empty={!data.todayAppointments.length ? "Hôm nay chưa có lịch đang chờ." : undefined}>
            {data.todayAppointments.map(row => <tr key={row._id}>
              <Cell>{patientLink(row.patientId)}</Cell>
              <Cell><RowLink href={healthcareHref({ tab: "appointments", recordId: row._id }, branchId)}>{timeLabel(row.startsAt)}</RowLink></Cell>
              <Cell><StatusBadge status={row.status} label={appointmentLabels[row.status]} /></Cell>
            </tr>)}
          </Table>
        </section>}
        {data.careCount !== null && <section className="finance-chart-card space-y-3">
          <h3 className="text-balance text-sm font-semibold">Việc chăm sóc đến hạn</h3>
          <Table headers={["Công việc", "Bệnh nhân", "Hạn xử lý"]} emptyKind="task" empty={!data.dueCare.length ? "Chưa có việc chăm sóc đến hạn." : undefined}>
            {data.dueCare.map(row => <tr key={row._id}>
              <Cell><RowLink href={healthcareHref({ tab: "care", recordId: row._id }, branchId)}>{row.title}</RowLink></Cell>
              <Cell>{patientLink(row.patientId)}</Cell>
              <Cell>{dayLabel(row.dueOn)}</Cell>
            </tr>)}
          </Table>
        </section>}
      </div>
    </>}
  </section>;
}

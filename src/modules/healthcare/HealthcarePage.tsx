import { useMemo, useRef, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { Dropdown } from "../../components/common/Dropdown";
import { HrPageTitle } from "../../components/hr/HrPageTitle";
import { ErpRefreshButton } from "../../components/common/ErpRefreshButton";
import { ModuleNavigation, ModuleNavigationButton } from "../../components/common/ModuleNavigation";
import { primaryCreateButtonClass } from "../../components/common/primaryCreateButton";
import { TableFilterToolbar } from "../../components/common/TableFilterToolbar";
import { TablePagination } from "../../components/common/TablePagination";
import { useAuth } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type { HealthcareTab as Tab } from "../../router/subTabRoutes";
import { emptyDatePeriodFilter, getDatePeriodRange } from "../../utils/datePeriodFilter";
import { cn } from "../student-management/lib/utils";
import type { Appointment, CareTask, CatalogItem, HealthcareList, HealthcarePatientList, HealthcareStaff, ImportKind, Patient, Visit } from "../../../shared/healthcare";
import { healthcareApi } from "./api";
import { healthcareHref, healthcarePath, readHealthcareLocation } from "./navigation";
import HospitalReportDetails from "./HospitalReportDetails";
import ImportPanel from "./ImportPanel";
import RecordEditor, { canCancelRecord, type Editor } from "./RecordEditor";
import {
  appointmentLabels, buttonClass, careLabels, catalogLabels, Cell, dayLabel, Feedback,
  messageOf, panelClass, primaryClass, RowLink, StatusBadge, Table, timeLabel, useHealthcareQuery, visitLabels,
} from "./ui";

const sections = [
  { key: "patients", label: "Bệnh nhân" },
  { key: "visits", label: "Lượt khám" },
  { key: "appointments", label: "Lịch hẹn" },
  { key: "care", label: "Chăm sóc" },
  { key: "settings", label: "Cài đặt danh mục" },
] as const;
type ListRow = Patient | Visit | Appointment | CareTask;
type Withdrawal =
  | { kind: "visits"; record: Visit }
  | { kind: "appointments"; record: Appointment }
  | { kind: "care"; record: CareTask }
  | { kind: "catalog"; record: CatalogItem };
const withdrawalLabels = { visits: "Hủy lượt khám", appointments: "Hủy lịch hẹn", care: "Hủy việc chăm sóc", catalog: "Ngừng sử dụng" };
const canFeature = (has: (permission: string) => boolean, tab: Tab, mode: "read" | "manage") => {
  const feature = tab === "patients" ? "healthcare" : `healthcare-${tab}`;
  return has(`${feature}:${mode}`) || (mode === "read" && has(`${feature}:manage`));
};
const labels = { visits: visitLabels, appointments: appointmentLabels, care: careLabels };
const sectionHeaders = {
  patients: ["Mã bệnh nhân", "Họ và tên", "Điện thoại", "Ngày sinh", "Thao tác"],
  visits: ["Mã lượt khám", "Bệnh nhân", "Ngày khám", "Dịch vụ", "Bác sĩ", "Phòng", "Trạng thái", "Thao tác"],
  appointments: ["Bệnh nhân", "Bắt đầu", "Kết thúc", "Bác sĩ", "Phòng", "Trạng thái", "Thao tác"],
  care: ["Công việc", "Bệnh nhân", "Phụ trách", "Hạn xử lý", "Trạng thái", "Kết quả", "Thao tác"],
};
const dateLabels = { patients: "Ngày tạo hồ sơ", visits: "Ngày khám", appointments: "Ngày hẹn", care: "Hạn xử lý" };
const searchHints = {
  patients: "Tìm mã, tên hoặc số điện thoại bệnh nhân",
  visits: "Tìm mã phiếu, bệnh nhân, bác sĩ, phòng hoặc dịch vụ",
  appointments: "Tìm bệnh nhân theo mã, tên hoặc số điện thoại",
  care: "Tìm tên công việc hoặc bệnh nhân",
};
const birthLabel = (patient: Patient) => patient.dateOfBirth ? dayLabel(patient.dateOfBirth) : patient.hospitalProfile?.birthYear || "—";
const usesCatalog = (tab: Tab) => tab === "visits" || tab === "appointments" || tab === "settings";

export default function HealthcarePage() {
  const { userProfile, hasPermission } = useAuth();
  const branch = useBranch();
  if (branch.loading) return <div className={panelClass}><Feedback loading /></div>;
  if (!branch.activeBranchId) return <div className={panelClass}>
    <HrPageTitle>Quản lý y tế</HrPageTitle>
    <Feedback error={branch.error || "Chọn chi nhánh đang hoạt động để sử dụng Quản lý y tế."} onRetry={branch.error ? branch.retry : undefined} />
  </div>;
  return <HealthcareWorkspace key={`${userProfile?.uid}:${userProfile?.companyCode}:${branch.activeBranchId}`}
    branchId={branch.activeBranchId} branchName={branch.activeBranch?.name} hasPermission={hasPermission} />;
}

export function HealthcareWorkspace({ branchId, branchName, hasPermission }: {
  branchId: string; branchName?: string; hasPermission: (permission: string) => boolean;
}) {
  const api = useMemo(() => healthcareApi(branchId), [branchId]);
  const [location, setLocation] = useState(() =>
    readHealthcareLocation(window.location.search, branchId, tab => canFeature(hasPermission, tab, "read")));
  const [editor, setEditor] = useState<Editor>();
  const [reportVisit, setReportVisit] = useState<Visit>();
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const query = search ? debouncedSearch.trim() : "";
  const [datePeriod, setDatePeriod] = useState(emptyDatePeriodFilter);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [importKind, setImportKind] = useState<ImportKind>();
  const [withdrawal, setWithdrawal] = useState<Withdrawal>();
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState("");
  const [loadCatalog, setLoadCatalog] = useState(() => usesCatalog(location.tab));
  const [loadStaff, setLoadStaff] = useState(() => location.tab === "care");
  const returnFocus = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const { tab, patientId, recordId } = location;
  const patient = useHealthcareQuery<Patient>(api, patientId ? `/patients/${patientId}` : null);
  const catalog = useHealthcareQuery<CatalogItem[]>(api, loadCatalog ? "/catalog" : null);
  const staff = useHealthcareQuery<HealthcareStaff[]>(api, loadStaff && canFeature(hasPermission, "care", "read") ? "/staff" : null);
  const canImport = hasPermission("healthcare-import:manage");
  const canViewImports = canImport || hasPermission("healthcare-import:read");
  const currentImportKind = !patientId && !recordId ? tab === "visits" ? "hospital-report" : tab === "patients" ? tab : undefined : undefined;
  const canManage = canFeature(hasPermission, tab, "manage");
  const clinical = tab === "visits" || tab === "appointments" || tab === "care";
  const hasList = clinical || (tab === "patients" && !patientId);
  const range = getDatePeriodRange(datePeriod);
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (patientId) params.set("patientId", patientId);
  if (recordId) params.set("id", recordId);
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  if (status) params.set("status", status);
  const list = useHealthcareQuery<HealthcareList<Patient> | HealthcarePatientList<ListRow>>(
    api, hasList ? (tab === "patients" || query ? `/${tab}/search` : `/${tab}?${params}`) : null,
    tab === "patients" && !patientId ? JSON.stringify({ q: query, page, pageSize, ...range })
      : clinical && query ? JSON.stringify({ ...Object.fromEntries(params), q: query }) : undefined,
  );
  const rows = list.data?.items || [];
  const references = list.data && "patientReferences" in list.data ? list.data.patientReferences : [];
  const patientMap = new Map(references.map(row => [row._id, row]));
  if (patient.data) patientMap.set(patient.data._id, patient.data);
  const catalogMap = new Map((catalog.data || []).map(row => [row._id, row.name]));
  const staffMap = new Map((staff.data || []).map(row => [row._id, row.name]));
  const directory = tab === "care" ? staff : tab === "visits" || tab === "appointments" ? catalog : undefined;
  const activeQuery = tab === "settings" ? catalog : tab === "patients" && patientId ? patient : list;
  const editorDirectory = editor?.kind === "care" ? staff : editor?.kind === "visits" || editor?.kind === "appointments" ? catalog : undefined;

  function navigate(next: Tab, selected?: string, record?: string) {
    const target = { tab: next, patientId: selected, recordId: record };
    setLocation(target);
    if (content.current) content.current.scrollTop = 0;
    if (window.location.pathname === healthcarePath) {
      window.history.replaceState(window.history.state, "", healthcareHref(target, branchId));
    }
    setEditor(undefined); setReportVisit(undefined); resetFilters(); setNotice("");
    setImportKind(undefined);
    if (usesCatalog(next)) setLoadCatalog(true);
    if (next === "care") setLoadStaff(true);
  }

  function openEditor(value: Editor) {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (value.kind === "care") setLoadStaff(true);
    setEditor(value);
    setNotice("");
  }

  function restoreFocus() {
    const target = returnFocus.current;
    requestAnimationFrame(() => (target?.isConnected ? target : heading.current)?.focus());
  }

  function closeEditor() {
    setEditor(undefined);
    restoreFocus();
  }

  function saved() {
    if (editor?.kind === "catalog") catalog.refresh();
    else if (editor?.kind === tab) activeQuery.refresh();
    closeEditor();
    setNotice("Đã lưu thay đổi.");
  }

  async function confirmWithdrawal() {
    if (!withdrawal || withdrawing) return;
    const { kind, record: { _id, createdAt, updatedAt, source, ...value } } = withdrawal;
    setWithdrawing(true);
    setWithdrawalError("");
    try {
      await api.json(`/${kind}/${_id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...value, ...(kind === "catalog" ? { active: false } : { status: "cancelled" }) }),
      });
      activeQuery.refresh();
      setWithdrawal(undefined);
      setNotice(kind === "catalog" ? "Đã ngừng sử dụng danh mục." : "Đã hủy bản ghi.");
      requestAnimationFrame(() => heading.current?.focus());
    } catch (error) {
      setWithdrawalError(messageOf(error));
    } finally {
      setWithdrawing(false);
    }
  }

  function withdrawalAction(target: Withdrawal) {
    if (!canManage || (target.kind === "catalog" ? !target.record.active : !canCancelRecord(target.kind, target.record.status))) return null;
    return <RowLink onClick={() => { setWithdrawalError(""); setWithdrawal(target); }}>{withdrawalLabels[target.kind]}</RowLink>;
  }

  function resetFilters() {
    setPage(1);
    setSearch("");
    setDatePeriod(emptyDatePeriodFilter());
    setStatus("");
  }

  function patientLink(id: string) {
    const found = patientMap.get(id);
    return <RowLink onClick={() => navigate("patients", id)}>{found ? `${found.code} · ${found.name}` : "Mở hồ sơ bệnh nhân"}</RowLink>;
  }

  function openNew() {
    if (tab === "patients") openEditor({ kind: "patients" });
    if (tab === "settings") openEditor({ kind: "catalog" });
    if (clinical) openEditor({ kind: tab, patient: patient.data } as Editor);
  }

  const tabs = sections.filter(section => canFeature(hasPermission, section.key, "read"));
  const pageTitle = tab === "settings" ? "Danh mục y tế" : sections.find(section => section.key === tab)?.label;
  const createLabel = { patients: "Thêm bệnh nhân", visits: "Ghi lượt khám", appointments: "Đặt lịch hẹn", care: "Tạo việc chăm sóc", settings: "Thêm danh mục" };
  const listHeaders = tab === "settings" ? [] : sectionHeaders[tab];
  const editName = (name: string) => `Sửa ${name}`;
  const showCreate = canManage && (tab !== "patients" || !patientId);

  return <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface text-on-surface">
    <ModuleNavigation label="Nghiệp vụ y tế" activeValue={tab}>
      {tabs.map(({ key, label }) => <ModuleNavigationButton key={key} active={tab === key} onClick={() => navigate(key)}>
        {label}
      </ModuleNavigationButton>)}
    </ModuleNavigation>
    <div ref={content} className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto px-3 pb-3 pt-2 lg:pl-0">
      <header className="space-y-1">
        <HrPageTitle>Quản lý y tế</HrPageTitle>
        {branchName && <p className="text-sm text-on-surface-variant">{branchName}</p>}
      </header>
      {notice && <p role="status" className="rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm">{notice}</p>}
      {editor && <RecordEditor key={`${editor.kind}:${editor.record?._id || "new"}`} editor={editor} api={api}
        catalog={catalog.data || []} staff={staff.data || []} directory={editorDirectory}
        onClose={closeEditor} onSaved={saved} />}
      {reportVisit && <HospitalReportDetails visit={reportVisit} api={api}
        onClose={() => { setReportVisit(undefined); restoreFocus(); }} />}
      {importKind && <ImportPanel api={api} canImport={canImport} initialKind={importKind}
        onClose={() => { setImportKind(undefined); restoreFocus(); }}
        onCommitted={kind => { if (tab === kind || kind === "hospital-report") list.refresh(); }}
        canOpenRecord={kind => canFeature(hasPermission, kind === "patients" ? "patients" : "visits", "read")}
        onOpenRecord={(kind, id) => {
          if (kind === "patients") navigate("patients", id);
          else navigate("visits", undefined, id);
          requestAnimationFrame(() => heading.current?.focus());
        }} />}
      {withdrawal && <ConfirmDialog appearance="erp" native isOpen title={withdrawalLabels[withdrawal.kind]}
        description={withdrawal.kind === "catalog"
          ? `Danh mục ${withdrawal.record.name} sẽ được ẩn khỏi lựa chọn mới. Các bản ghi đã dùng danh mục vẫn giữ liên kết.`
          : "Bản ghi sẽ chuyển sang trạng thái Đã hủy và được giữ trong lịch sử."}
        confirmLabel={withdrawal.kind === "catalog" ? "Ngừng sử dụng" : "Xác nhận hủy"} cancelLabel="Quay lại"
        isSubmitting={withdrawing} error={withdrawalError} onClose={() => setWithdrawal(undefined)} onConfirm={confirmWithdrawal} />}
      <section className={panelClass} aria-labelledby="healthcare-section-title">
        <div className="flex flex-wrap items-center justify-between gap-3" ref={heading} tabIndex={-1}>
          <h3 id="healthcare-section-title" data-typography="section-title" className="text-balance text-lg font-semibold">{pageTitle}</h3>
          <div className="flex flex-wrap gap-2">
            {currentImportKind && canViewImports && <button type="button" className={cn(buttonClass, "min-h-9")} aria-haspopup="dialog"
              onClick={event => { returnFocus.current = event.currentTarget; setImportKind(currentImportKind); }}>
              <Upload size={16} aria-hidden="true" /> {canImport ? "Nhập Excel" : "Mẫu Excel và lịch sử"}
            </button>}
            <ErpRefreshButton loading={activeQuery.refreshing || directory?.refreshing} onClick={() => {
              activeQuery.refresh();
              if (!editor) directory?.refresh();
            }} />
            {showCreate && <button type="button" className={cn(primaryCreateButtonClass, "min-h-9 text-on-primary-fixed")} aria-haspopup="dialog" disabled={Boolean(patientId && !patient.data)} onClick={openNew}><Plus size={16} aria-hidden="true" /> {createLabel[tab]}</button>}
          </div>
        </div>
        {hasList && <TableFilterToolbar
          search={{ value: search, onChange: value => { setSearch(value.slice(0, 100)); setPage(1); },
            placeholder: searchHints[tab], ariaLabel: searchHints[tab], className: "min-w-0" }}
          dateFilter={{ label: dateLabels[tab], value: datePeriod, onChange: value => { setDatePeriod(value); setPage(1); }, compact: true }}
          totalCount={list.data?.total} countLabel="bản ghi"
          hasActiveFilters={Boolean(search || status || datePeriod.mode !== "all")} onResetFilters={resetFilters}>
          {clinical && <Dropdown aria-label="Trạng thái" value={status} onChange={value => { setStatus(value); setPage(1); }}
            variant="filter" options={[{ value: "", label: "Tất cả trạng thái" },
              ...Object.entries(labels[tab]).map(([value, label]) => ({ value, label }))]} />}
        </TableFilterToolbar>}
        {tab === "patients" && patientId && <>
          <button type="button" className={buttonClass} onClick={() => navigate("patients")}>Về danh sách bệnh nhân</button>
          <Feedback loading={patient.loading} error={patient.error} onRetry={patient.refresh} />
          {patient.data && <>
            <div className="space-y-3">
              <h4 className="text-balance text-lg font-semibold">{patient.data.name}</h4>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {[
                  ["Mã bệnh nhân", patient.data.code], ["Điện thoại", patient.data.phone], ["Ngày sinh", birthLabel(patient.data)],
                  ["Địa chỉ", patient.data.address], ["Ghi chú hành chính", patient.data.note],
                  ...(patient.data.hospitalProfile ? [["Giới tính", patient.data.hospitalProfile.gender]] : []),
                  ...(patient.data.hospitalProfile?.phoneText && patient.data.hospitalProfile.phoneText !== patient.data.phone
                    ? [["Điện thoại trong Excel", patient.data.hospitalProfile.phoneText]] : []),
                ].map(([label, value]) => <div key={label}><dt className="font-medium text-on-surface-variant">{label}</dt><dd className="break-words">{value || "—"}</dd></div>)}
              </dl>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManage && <button type="button" className={primaryClass} onClick={() => openEditor({ kind: "patients", record: patient.data })}>Sửa hồ sơ</button>}
              {tabs.filter(section => section.key !== "patients" && section.key !== "settings").map(section =>
                <button key={section.key} type="button" className={buttonClass} onClick={() => navigate(section.key, patientId)}>{section.label} của bệnh nhân</button>)}
            </div>
          </>}
        </>}
        {clinical && (patientId || recordId) && <div className="flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
          <span>{recordId ? "Bản ghi liên quan" : patient.data ? `${patient.data.code} · ${patient.data.name}` : "Hồ sơ bệnh nhân đã chọn"}</span>
          <button type="button" className={buttonClass} onClick={() => navigate(tab)}>Xem tất cả</button>
        </div>}
        {hasList && <>
          <Feedback loading={list.loading} error={list.error} onRetry={list.refresh} />
          {list.data && <Table headers={listHeaders} empty={!rows.length ? "Chưa có dữ liệu phù hợp." : undefined}>
            {tab === "patients" && (rows as Patient[]).map(row => <tr key={row._id}>
              <Cell><RowLink onClick={() => navigate("patients", row._id)}>{row.code}</RowLink></Cell><Cell>{row.name}</Cell><Cell>{row.phone || "—"}</Cell><Cell>{birthLabel(row)}</Cell>
              <Cell>{canManage && <RowLink onClick={() => openEditor({ kind: "patients", record: row })}>{editName(row.code)}</RowLink>}</Cell>
            </tr>)}
            {tab === "visits" && (rows as Visit[]).map(row => <tr key={row._id}>
              <Cell>{row.code}{(row.note || row.paymentNote) && <details className="mt-1 max-w-64 text-xs">
                <summary className="cursor-pointer rounded-sm underline decoration-primary underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary">Xem ghi chú</summary>
                {row.note && <p className="mt-1 break-words">{row.note}</p>}
                {row.paymentNote && <p className="mt-1 break-words">Thanh toán tham khảo — {row.paymentNote}</p>}
              </details>}</Cell><Cell>{patientLink(row.patientId)}</Cell><Cell>{dayLabel(row.visitedOn)}</Cell>
              <Cell>{catalogMap.get(row.serviceId) || (row.report?.service && <p className="line-clamp-2 max-w-48 break-words">{row.report.service}</p>)}</Cell>
              <Cell>{catalogMap.get(row.doctorId) || row.report?.doctor}</Cell><Cell>{catalogMap.get(row.roomId) || row.report?.department}</Cell>
              <Cell><StatusBadge status={row.status} label={visitLabels[row.status]} />{row.report?.sourceStatus && <p className="mt-1 text-xs text-on-surface-variant">{row.report.sourceStatus}</p>}</Cell>
              <Cell><div className="flex flex-wrap gap-x-3 gap-y-2">
                {canManage && <RowLink onClick={() => openEditor({ kind: "visits", record: row, patient: patientMap.get(row.patientId) })}>{editName(row.code)}</RowLink>}
                {row.report && <RowLink onClick={() => {
                  returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                  setReportVisit(row);
                }}>Xem phiếu Excel</RowLink>}
                {row.status !== "cancelled" && canFeature(hasPermission, "appointments", "manage") && patientMap.has(row.patientId) &&
                  <RowLink onClick={() => openEditor({ kind: "appointments", patient: patientMap.get(row.patientId), visit: row })}>Đặt tái khám</RowLink>}
                {withdrawalAction({ kind: "visits", record: row })}
              </div></Cell>
            </tr>)}
            {tab === "appointments" && (rows as Appointment[]).map(row => <tr key={row._id}>
              <Cell>{patientLink(row.patientId)}</Cell><Cell>{timeLabel(row.startsAt)}</Cell><Cell>{timeLabel(row.endsAt)}</Cell>
              <Cell>{catalogMap.get(row.doctorId)}</Cell><Cell>{catalogMap.get(row.roomId)}</Cell><Cell><StatusBadge status={row.status} label={appointmentLabels[row.status]} /></Cell>
              <Cell><div className="flex flex-wrap gap-x-3 gap-y-2">
                {canManage && <RowLink onClick={() => openEditor({ kind: "appointments", record: row, patient: patientMap.get(row.patientId) })}>Sửa lịch</RowLink>}
                {row.visitId && canFeature(hasPermission, "visits", "read") && <RowLink onClick={() => navigate("visits", row.patientId, row.visitId)}>Lượt khám gốc</RowLink>}
                {canFeature(hasPermission, "care", "manage") && patientMap.has(row.patientId) &&
                  <RowLink onClick={() => openEditor({ kind: "care", patient: patientMap.get(row.patientId), appointment: row })}>Giao chăm sóc</RowLink>}
                {withdrawalAction({ kind: "appointments", record: row })}
              </div></Cell>
            </tr>)}
            {tab === "care" && (rows as CareTask[]).map(row => <tr key={row._id}>
              <Cell>{row.title}</Cell><Cell>{patientLink(row.patientId)}</Cell><Cell>{staffMap.get(row.assigneeId) || "Nhân viên đã phân công"}</Cell>
              <Cell>{dayLabel(row.dueOn)}</Cell><Cell><StatusBadge status={row.status} label={careLabels[row.status]} /></Cell><Cell>{row.result && <p className="max-w-64 break-words">{row.result}</p>}</Cell>
              <Cell><div className="flex flex-wrap gap-x-3 gap-y-2">
                {canManage && <RowLink onClick={() => openEditor({ kind: "care", record: row, patient: patientMap.get(row.patientId) })}>Cập nhật công việc</RowLink>}
                {row.appointmentId && canFeature(hasPermission, "appointments", "read") && <RowLink onClick={() => navigate("appointments", row.patientId, row.appointmentId)}>Lịch hẹn gốc</RowLink>}
                {withdrawalAction({ kind: "care", record: row })}
              </div></Cell>
            </tr>)}
          </Table>}
          {list.data && <TablePagination appearance="erp" currentPage={page} pageSize={pageSize} totalItems={list.data.total}
            totalPages={Math.max(1, Math.ceil(list.data.total / pageSize))} onPageChange={setPage} onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100]} />}
        </>}
        {tab === "settings" && <>
          <Feedback loading={catalog.loading} error={catalog.error} onRetry={catalog.refresh} />
          {catalog.data && <Table headers={["Loại", "Mã", "Tên", "Trạng thái", "Thao tác"]} empty={!catalog.data.length ? "Thêm bác sĩ, phòng khám hoặc dịch vụ để sử dụng khi đặt lịch và ghi lượt khám." : undefined}>
            {catalog.data.map(row => <tr key={row._id}><Cell>{catalogLabels[row.kind]}</Cell><Cell>{row.code}</Cell><Cell>{row.name}</Cell>
              <Cell><StatusBadge status={row.active ? "completed" : "inactive"} label={row.active ? "Đang sử dụng" : "Ngừng sử dụng"} /></Cell>
              <Cell><div className="flex flex-wrap gap-x-3 gap-y-2">
                {canManage && <RowLink onClick={() => openEditor({ kind: "catalog", record: row })}>{editName(row.code)}</RowLink>}
                {withdrawalAction({ kind: "catalog", record: row })}
              </div></Cell></tr>)}
          </Table>}
        </>}
        {directory !== editorDirectory && <Feedback error={directory?.error} onRetry={directory?.refresh} />}
      </section>
    </div>
  </div>;
}

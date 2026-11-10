import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, CircleX, Eye, FileText, HeartHandshake, Pencil, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { Dropdown } from "../../components/common/Dropdown";
import { ErpModal } from "../../components/common/ErpModal";
import { ModuleNavigation, ModuleNavigationButton } from "../../components/common/ModuleNavigation";
import { TableFilterToolbar } from "../../components/common/TableFilterToolbar";
import { TablePagination } from "../../components/common/TablePagination";
import { useAuth } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import type { HealthcareTab as Tab } from "../../router/subTabRoutes";
import { emptyDatePeriodFilter, getDatePeriodRange } from "../../utils/datePeriodFilter";
import type { Appointment, CareTask, CatalogItem, HealthcareList, HealthcarePatientList, HealthcareStaff, ImportKind, Patient, Visit } from "../../../shared/healthcare";
import { healthcareApi } from "./api";
import { healthcareHref, healthcarePath, readHealthcareLocation } from "./navigation";
import HospitalReportDetails from "./HospitalReportDetails";
import ImportPanel from "./ImportPanel";
import PatientDetailsModal from "./PatientDetailsModal";
import RecordEditor, { canCancelRecord, type Editor } from "./RecordEditor";
import {
  appointmentLabels, buttonClass, careLabels, catalogLabels, Cell, dayLabel, Feedback, IconActionButton,
  messageOf, panelClass, RowLink, StatusBadge, Table, timeLabel, useHealthcareQuery, visitLabels,
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
type PatientDeleteImpactItem = Pick<Patient, "_id" | "code" | "name" | "phone" | "createdAt"> & {
  visits: number; appointments: number; care: number; hospitalProfile?: { gender?: string };
};
type PatientDeleteResult = { deletedCount: number; deletedVisits: number; deletedAppointments: number; deletedCare: number };
const withdrawalLabels = { visits: "Hủy lượt khám", appointments: "Hủy lịch hẹn", care: "Hủy việc chăm sóc", catalog: "Ngừng sử dụng" };
const canFeature = (has: (permission: string) => boolean, tab: Tab, mode: "read" | "manage") => {
  const feature = tab === "patients" ? "healthcare" : `healthcare-${tab}`;
  return has(`${feature}:${mode}`) || (mode === "read" && has(`${feature}:manage`));
};
const labels = { visits: visitLabels, appointments: appointmentLabels, care: careLabels };
const sectionHeaders = {
  patients: ["Họ và tên", "Ngày tạo hồ sơ", "Ngày sinh", "Giới tính", "Thao tác"],
  visits: ["Mã lượt khám", "Bệnh nhân", "Ngày khám", "Tái khám", "Dịch vụ", "Bác sĩ", "Phòng", "Trạng thái", "Thao tác"],
  appointments: ["Bệnh nhân", "Bắt đầu", "Kết thúc", "Bác sĩ", "Phòng", "Trạng thái", "Thao tác"],
  care: ["Công việc", "Bệnh nhân", "Phụ trách", "Hạn xử lý", "Trạng thái", "Kết quả", "Thao tác"],
};
const sectionTableWidths: Record<keyof typeof sectionHeaders, string[]> = {
  patients: ["290px", "150px", "140px", "120px", "170px"],
  visits: ["150px", "230px", "115px", "115px", "180px", "170px", "160px", "165px", "210px"],
  appointments: ["240px", "190px", "190px", "200px", "180px", "155px", "205px"],
  care: ["240px", "230px", "190px", "150px", "150px", "250px", "200px"],
};
const sectionTableMinWidths: Record<keyof typeof sectionHeaders, string> = {
  patients: "914px", visits: "1495px", appointments: "1360px", care: "1410px",
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
    <Feedback error={branch.error || "Chọn chi nhánh đang hoạt động để sử dụng Quản lý y tế."} onRetry={branch.error ? branch.retry : undefined} />
  </div>;
  return <HealthcareWorkspace key={`${userProfile?.uid}:${userProfile?.companyCode}:${branch.activeBranchId}`}
    branchId={branch.activeBranchId} hasPermission={hasPermission} />;
}

export function HealthcareWorkspace({ branchId, hasPermission }: {
  branchId: string; hasPermission: (permission: string) => boolean;
}) {
  const api = useMemo(() => healthcareApi(branchId), [branchId]);
  const [location, setLocation] = useState(() =>
    readHealthcareLocation(window.location.search, branchId, tab => canFeature(hasPermission, tab, "read")));
  const [editor, setEditor] = useState<Editor>();
  const [patientPreviewId, setPatientPreviewId] = useState<string>();
  const [reportVisit, setReportVisit] = useState<Visit>();
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [datePeriod, setDatePeriod] = useState(emptyDatePeriodFilter);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 1_000);
    return () => clearTimeout(timer);
  }, [search]);
  const [importKind, setImportKind] = useState<ImportKind>();
  const [withdrawal, setWithdrawal] = useState<Withdrawal>();
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState("");
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([]);
  const [deleteCandidateIds, setDeleteCandidateIds] = useState<string[]>([]);
  const [deleteImpact, setDeleteImpact] = useState<PatientDeleteImpactItem[]>();
  const [previewingPatientDelete, setPreviewingPatientDelete] = useState(false);
  const [deletingPatients, setDeletingPatients] = useState(false);
  const [patientDeleteError, setPatientDeleteError] = useState("");
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
  const patientRows = tab === "patients" ? rows as Patient[] : [];
  const patientPageIds = patientRows.map(row => row._id);
  const allPatientRowsSelected = patientPageIds.length > 0 && patientPageIds.every(id => selectedPatientIds.includes(id));
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

  function openPatientPreview(id: string) {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPatientPreviewId(id);
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

  async function previewPatientDeletion(ids: string[]) {
    if (!ids.length || previewingPatientDelete || deletingPatients) return;
    setDeleteCandidateIds(ids);
    setDeleteImpact(undefined);
    setPatientDeleteError("");
    setPreviewingPatientDelete(true);
    try {
      const preview = await api.json<{ items: PatientDeleteImpactItem[] }>("/patients/bulk-delete-preview", {
        method: "POST", body: JSON.stringify({ ids }),
      });
      setDeleteImpact(preview.items);
    } catch (error) {
      setPatientDeleteError(messageOf(error));
    } finally {
      setPreviewingPatientDelete(false);
    }
  }

  async function confirmPatientDeletion() {
    if (!deleteCandidateIds.length || !deleteImpact?.length || deletingPatients) return;
    setDeletingPatients(true);
    setPatientDeleteError("");
    try {
      const result = await api.json<PatientDeleteResult>("/patients/bulk-delete", {
        method: "POST", body: JSON.stringify({ ids: deleteCandidateIds }),
      });
      const removedIds = new Set(deleteCandidateIds);
      setSelectedPatientIds(current => current.filter(id => !removedIds.has(id)));
      list.refresh();
      setDeleteCandidateIds([]);
      setDeleteImpact(undefined);
      setNotice(`Đã xóa ${result.deletedCount} hồ sơ bệnh nhân cùng ${result.deletedVisits} lượt khám, ${result.deletedAppointments} lịch hẹn và ${result.deletedCare} việc chăm sóc liên quan.`);
      requestAnimationFrame(() => heading.current?.focus());
    } catch (error) {
      setPatientDeleteError(messageOf(error));
    } finally {
      setDeletingPatients(false);
    }
  }

  function withdrawalAction(target: Withdrawal) {
    if (!canManage || (target.kind === "catalog" ? !target.record.active : !canCancelRecord(target.kind, target.record.status))) return null;
    return <IconActionButton label={withdrawalLabels[target.kind]} icon={CircleX} tone="danger" ariaHaspopup
      onClick={() => { setWithdrawalError(""); setWithdrawal(target); }} />;
  }

  function resetFilters() {
    setPage(1);
    setSearch("");
    setQuery("");
    setDatePeriod(emptyDatePeriodFilter());
    setStatus("");
  }

  function patientLink(id: string) {
    const found = patientMap.get(id);
    return <div className="min-w-48">
      <RowLink onClick={() => openPatientPreview(id)}>{found?.name || "Mở hồ sơ bệnh nhân"}</RowLink>
      {found && <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-on-surface-variant">
        <span className="rounded bg-surface-container px-1.5 py-0.5">{found.code}</span>
        {found.phone && <><span aria-hidden="true">•</span><span>{found.phone}</span></>}
      </div>}
    </div>;
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
  const showCreate = canManage && (tab !== "patients" || !patientId);

  return <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface text-on-surface">
    <ModuleNavigation label="Nghiệp vụ y tế" activeValue={tab}>
      {tabs.map(({ key, label }) => <ModuleNavigationButton key={key} active={tab === key} onClick={() => navigate(key)}>
        {label}
      </ModuleNavigationButton>)}
    </ModuleNavigation>
    <div ref={content} className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto px-3 pb-3 pt-2 lg:pl-0">
      {notice && <p role="status" className="rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm">{notice}</p>}
      {editor && <RecordEditor key={`${editor.kind}:${editor.record?._id || "new"}`} editor={editor} api={api}
        catalog={catalog.data || []} staff={staff.data || []} directory={editorDirectory}
        onClose={closeEditor} onSaved={saved} />}
      {patientPreviewId && <PatientDetailsModal patientId={patientPreviewId} api={api} canManage={canFeature(hasPermission, "patients", "manage")}
        onClose={() => { setPatientPreviewId(undefined); restoreFocus(); }}
        onEdit={record => { setPatientPreviewId(undefined); setEditor({ kind: "patients", record }); setNotice(""); }} />}
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
      {deleteCandidateIds.length > 0 && <ErpModal native title={deleteCandidateIds.length === 1 ? "Kiểm tra xóa hồ sơ bệnh nhân" : `Kiểm tra xóa ${deleteCandidateIds.length} hồ sơ bệnh nhân`}
        onClose={() => {
          if (deletingPatients) return;
          setDeleteCandidateIds([]); setDeleteImpact(undefined); setPatientDeleteError(""); restoreFocus();
        }} closeDisabled={deletingPatients} maxWidth="max-w-3xl">
        <div className="space-y-3">
          <p className="text-sm leading-6 text-on-surface-variant">Xác nhận sẽ xóa vĩnh viễn hồ sơ đã chọn cùng lượt khám, lịch hẹn và việc chăm sóc liên quan trong chi nhánh.</p>
          {previewingPatientDelete && <Feedback loading />}
          {patientDeleteError && <Feedback error={patientDeleteError} />}
          {deleteImpact && <>
            <p className="text-sm font-medium">Ảnh hưởng: {deleteImpact.length} hồ sơ, {deleteImpact.reduce((sum, row) => sum + row.visits, 0)} lượt khám, {deleteImpact.reduce((sum, row) => sum + row.appointments, 0)} lịch hẹn, {deleteImpact.reduce((sum, row) => sum + row.care, 0)} việc chăm sóc.</p>
            <Table headers={["Bệnh nhân", "Lượt khám", "Lịch hẹn", "Chăm sóc"]}>
              {deleteImpact.map(row => <tr key={row._id}>
                <Cell><span className="font-medium">{row.name}</span><span className="mt-1 block text-xs text-on-surface-variant">{row.code}{row.phone ? ` · ${row.phone}` : ""}</span></Cell>
                <Cell align="center">{row.visits}</Cell><Cell align="center">{row.appointments}</Cell><Cell align="center">{row.care}</Cell>
              </tr>)}
            </Table>
          </>}
          <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant pt-3">
            <button type="button" className={buttonClass} disabled={deletingPatients} onClick={() => {
              setDeleteCandidateIds([]); setDeleteImpact(undefined); setPatientDeleteError(""); restoreFocus();
            }}>Giữ lại</button>
            <button type="button" className={`${buttonClass} border-error/30 text-error hover:bg-error-container/30`}
              disabled={previewingPatientDelete || deletingPatients || !deleteImpact?.length}
              onClick={() => void confirmPatientDeletion()}>
              {deletingPatients ? "Đang xóa…" : `Xóa ${deleteImpact?.length || 0} hồ sơ`}
            </button>
          </div>
        </div>
      </ErpModal>}
      {withdrawal && <ConfirmDialog appearance="erp" native isOpen title={withdrawalLabels[withdrawal.kind]}
        description={withdrawal.kind === "catalog"
          ? `Danh mục ${withdrawal.record.name} sẽ được ẩn khỏi lựa chọn mới. Các bản ghi đã dùng danh mục vẫn giữ liên kết.`
          : "Bản ghi sẽ chuyển sang trạng thái Đã hủy và được giữ trong lịch sử."}
        confirmLabel={withdrawal.kind === "catalog" ? "Ngừng sử dụng" : "Xác nhận hủy"} cancelLabel="Quay lại"
        isSubmitting={withdrawing} error={withdrawalError} onClose={() => setWithdrawal(undefined)} onConfirm={confirmWithdrawal} />}
      <section className={panelClass} aria-labelledby="healthcare-section-title">
        <div className="flex flex-wrap items-center justify-between gap-3" ref={heading} tabIndex={-1}>
          <h3 id="healthcare-section-title" data-typography="section-title" className="text-balance text-lg font-semibold">{pageTitle}</h3>
          <div className="flex items-center gap-2">
            {tab === "patients" && !patientId && canManage && selectedPatientIds.length > 0 && <>
              <span className="rounded-lg bg-surface-container px-2.5 py-1.5 text-xs font-medium text-on-surface-variant">Đã chọn {selectedPatientIds.length}</span>
              <IconActionButton label={`Xóa hàng loạt (${selectedPatientIds.length})`} icon={Trash2} tone="danger" ariaHaspopup
                disabled={previewingPatientDelete || deletingPatients}
                onClick={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; void previewPatientDeletion(selectedPatientIds); }} />
            </>}
            {currentImportKind && canViewImports && <IconActionButton label={canImport ? "Nhập Excel" : "Mẫu Excel và lịch sử"} icon={Upload} ariaHaspopup
              onClick={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setImportKind(currentImportKind); }} />}
            <IconActionButton label={activeQuery.refreshing || directory?.refreshing ? "Đang làm mới" : "Làm mới"} icon={RefreshCw}
              disabled={activeQuery.refreshing || directory?.refreshing} onClick={() => {
              activeQuery.refresh();
              if (!editor) directory?.refresh();
            }} />
            {showCreate && <IconActionButton label={createLabel[tab]} icon={Plus} ariaHaspopup disabled={Boolean(patientId && !patient.data)} onClick={openNew} />}
          </div>
        </div>
        {hasList && <TableFilterToolbar
          search={{ value: search, onChange: value => { setSearch(value.slice(0, 100)); },
            placeholder: searchHints[tab], ariaLabel: searchHints[tab], className: "min-w-0" }}
          dateFilter={{ label: dateLabels[tab], value: datePeriod, onChange: value => { setDatePeriod(value); setPage(1); }, compact: true }}
          totalCount={list.data?.total} countLabel="bản ghi"
          hasActiveFilters={Boolean(search || status || datePeriod.mode !== "all")} onResetFilters={resetFilters}>
          {clinical && <Dropdown aria-label="Trạng thái" value={status} onChange={value => { setStatus(value); setPage(1); }}
            variant="filter" options={[{ value: "", label: "Tất cả trạng thái" },
              ...Object.entries(labels[tab]).map(([value, label]) => ({ value, label }))]} />}
        </TableFilterToolbar>}
        {tab === "patients" && selectedPatientIds.length >= 500 && <p role="status" className="text-xs text-on-surface-variant">Mỗi lượt xóa hỗ trợ tối đa 500 hồ sơ.</p>}
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
              {canManage && <IconActionButton label="Sửa hồ sơ bệnh nhân" icon={Pencil} ariaHaspopup
                onClick={() => openEditor({ kind: "patients", record: patient.data! })} />}
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
          {list.data && <Table headers={listHeaders}
            columnWidths={tab === "settings" ? ["150px", "180px", "300px", "160px", "150px"] : sectionTableWidths[tab]}
            minWidth={tab === "settings" ? "940px" : sectionTableMinWidths[tab]}
            selectAll={tab === "patients" && canManage ? {
              checked: allPatientRowsSelected,
              disabled: selectedPatientIds.length >= 500 && !allPatientRowsSelected,
              label: "Chọn tất cả hồ sơ bệnh nhân trên trang này",
              onChange: checked => setSelectedPatientIds(current => checked
                ? [...new Set([...current, ...patientPageIds])].slice(0, 500)
                : current.filter(id => !patientPageIds.includes(id))),
            } : undefined}
            empty={!rows.length ? "Chưa có dữ liệu phù hợp." : undefined}>
            {tab === "patients" && (rows as Patient[]).map(row => <tr key={row._id}
              className={selectedPatientIds.includes(row._id) ? "bg-primary-container/20" : "transition-colors hover:bg-surface-container-low/40"}>
              {canManage && <td className="w-10 px-4 py-2.5 align-top">
                <input type="checkbox" checked={selectedPatientIds.includes(row._id)} aria-label={`Chọn hồ sơ ${row.code}, ${row.name}`}
                  disabled={selectedPatientIds.length >= 500 && !selectedPatientIds.includes(row._id)}
                  onChange={event => setSelectedPatientIds(current => {
                    if (!event.target.checked) return current.filter(id => id !== row._id);
                    if (current.includes(row._id) || current.length >= 500) return current;
                    return [...current, row._id];
                  })}
                  className="size-4 accent-primary disabled:cursor-not-allowed" />
              </td>}
              <Cell><div className="min-w-48">
                <RowLink onClick={() => openPatientPreview(row._id)}>{row.name}</RowLink>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-on-surface-variant">
                  <span>{row.phone || "Chưa có số điện thoại"}</span><span aria-hidden="true">•</span>
                  <span className="rounded bg-surface-container px-1.5 py-0.5">{row.code}</span>
                </div>
              </div></Cell>
              <Cell align="center" className="whitespace-nowrap">{dayLabel(row.createdAt.slice(0, 10))}</Cell><Cell align="center" className="whitespace-nowrap">{birthLabel(row)}</Cell><Cell>{row.hospitalProfile?.gender || "—"}</Cell>
              <Cell align="right"><div className="flex items-center justify-end gap-2">
                {canManage && <IconActionButton label={`Sửa hồ sơ ${row.code}`} icon={Pencil} ariaHaspopup onClick={() => openEditor({ kind: "patients", record: row })} />}
                <IconActionButton label={`Xem hồ sơ ${row.code}`} icon={Eye} ariaHaspopup onClick={() => openPatientPreview(row._id)} />
                {canManage && <IconActionButton label={`Xóa hồ sơ ${row.code}`} icon={Trash2} tone="danger" ariaHaspopup
                  disabled={previewingPatientDelete || deletingPatients} onClick={() => {
                    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                    void previewPatientDeletion([row._id]);
                  }} />}
              </div></Cell>
            </tr>)}
            {tab === "visits" && (rows as Visit[]).map(row => <tr key={row._id} className="transition-colors hover:bg-surface-container-low/40">
              <Cell>{row.code}{(row.note || row.paymentNote) && <details className="mt-1 max-w-64 text-xs">
                <summary className="cursor-pointer rounded-sm underline decoration-primary underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary">Xem ghi chú</summary>
                {row.note && <p className="mt-1 break-words">{row.note}</p>}
                {row.paymentNote && <p className="mt-1 break-words">Thanh toán tham khảo — {row.paymentNote}</p>}
              </details>}</Cell><Cell>{patientLink(row.patientId)}</Cell><Cell align="center" className="whitespace-nowrap">{dayLabel(row.visitedOn)}</Cell><Cell align="center" className="whitespace-nowrap">{dayLabel(row.report?.followUpOn || "")}</Cell>
              <Cell className="break-words">{catalogMap.get(row.serviceId) || (row.report?.service && <p className="line-clamp-2 max-w-full break-words">{row.report.service}</p>)}</Cell>
              <Cell className="break-words">{catalogMap.get(row.doctorId) || row.doctorName || row.report?.doctor || "—"}</Cell><Cell className="break-words">{catalogMap.get(row.roomId) || row.report?.department}</Cell>
              <Cell align="center"><StatusBadge status={row.status} label={visitLabels[row.status]} />{row.report?.sourceStatus && <p className="mt-1 text-xs text-on-surface-variant">{row.report.sourceStatus}</p>}</Cell>
              <Cell align="right"><div className="flex items-center justify-end gap-2">
                {canManage && <IconActionButton label={`Sửa lượt khám ${row.code}`} icon={Pencil} ariaHaspopup onClick={() => openEditor({ kind: "visits", record: row, patient: patientMap.get(row.patientId) })} />}
                {row.report && <IconActionButton label="Xem phiếu Excel" icon={Eye} ariaHaspopup onClick={() => {
                  returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                  setReportVisit(row);
                }} />}
                {row.status !== "cancelled" && canFeature(hasPermission, "appointments", "manage") && patientMap.has(row.patientId) &&
                  <IconActionButton label="Đặt tái khám" icon={CalendarPlus} ariaHaspopup onClick={() => openEditor({ kind: "appointments", patient: patientMap.get(row.patientId), visit: row })} />}
                {canFeature(hasPermission, "care", "manage") && patientMap.has(row.patientId) &&
                  <IconActionButton label="Tạo việc chăm sóc từ lượt khám" icon={HeartHandshake} ariaHaspopup onClick={() => openEditor({ kind: "care", patient: patientMap.get(row.patientId), visit: row })} />}
                {withdrawalAction({ kind: "visits", record: row })}
              </div></Cell>
            </tr>)}
            {tab === "appointments" && (rows as Appointment[]).map(row => <tr key={row._id} className="transition-colors hover:bg-surface-container-low/40">
              <Cell>{patientLink(row.patientId)}</Cell><Cell align="center" className="whitespace-nowrap">{timeLabel(row.startsAt)}</Cell><Cell align="center" className="whitespace-nowrap">{timeLabel(row.endsAt)}</Cell>
              <Cell>{catalogMap.get(row.doctorId) || row.doctorName || "—"}</Cell><Cell>{catalogMap.get(row.roomId) || "—"}</Cell><Cell align="center"><StatusBadge status={row.status} label={appointmentLabels[row.status]} /></Cell>
              <Cell align="right"><div className="flex items-center justify-end gap-2">
                {canManage && <IconActionButton label="Sửa lịch hẹn" icon={Pencil} ariaHaspopup onClick={() => openEditor({ kind: "appointments", record: row, patient: patientMap.get(row.patientId) })} />}
                {row.visitId && canFeature(hasPermission, "visits", "read") && <IconActionButton label="Mở lượt khám gốc" icon={FileText} onClick={() => navigate("visits", row.patientId, row.visitId)} />}
                {canFeature(hasPermission, "care", "manage") && patientMap.has(row.patientId) &&
                  <IconActionButton label="Giao việc chăm sóc" icon={HeartHandshake} ariaHaspopup onClick={() => openEditor({ kind: "care", patient: patientMap.get(row.patientId), appointment: row })} />}
                {withdrawalAction({ kind: "appointments", record: row })}
              </div></Cell>
            </tr>)}
            {tab === "care" && (rows as CareTask[]).map(row => <tr key={row._id} className="transition-colors hover:bg-surface-container-low/40">
              <Cell>{row.title}</Cell><Cell>{patientLink(row.patientId)}</Cell><Cell>{staffMap.get(row.assigneeId) || "Nhân viên đã phân công"}</Cell>
              <Cell align="center">{dayLabel(row.dueOn)}</Cell><Cell align="center"><StatusBadge status={row.status} label={careLabels[row.status]} /></Cell><Cell>{row.result && <p className="max-w-64 break-words">{row.result}</p>}</Cell>
              <Cell align="right"><div className="flex items-center justify-end gap-2">
                {canManage && <IconActionButton label="Cập nhật công việc" icon={Pencil} ariaHaspopup onClick={() => openEditor({ kind: "care", record: row, patient: patientMap.get(row.patientId) })} />}
                {row.appointmentId && canFeature(hasPermission, "appointments", "read") && <IconActionButton label="Mở lịch hẹn gốc" icon={CalendarPlus} onClick={() => navigate("appointments", row.patientId, row.appointmentId)} />}
                {row.visitId && canFeature(hasPermission, "visits", "read") && <IconActionButton label="Mở lượt khám gốc" icon={FileText} onClick={() => navigate("visits", row.patientId, row.visitId)} />}
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
          {catalog.data && <Table headers={["Loại", "Mã", "Tên", "Trạng thái", "Thao tác"]}
            columnWidths={["150px", "180px", "300px", "160px", "150px"]} minWidth="940px"
            empty={!catalog.data.length ? "Thêm bác sĩ, phòng khám hoặc dịch vụ để sử dụng khi đặt lịch và ghi lượt khám." : undefined}>
            {catalog.data.map(row => <tr key={row._id} className="transition-colors hover:bg-surface-container-low/40"><Cell><span className="rounded bg-surface-container px-1.5 py-0.5 text-xs">{catalogLabels[row.kind]}</span></Cell><Cell><span className="font-medium">{row.code}</span></Cell><Cell>{row.name}</Cell>
              <Cell align="center"><StatusBadge status={row.active ? "completed" : "inactive"} label={row.active ? "Đang sử dụng" : "Ngừng sử dụng"} /></Cell>
              <Cell align="right"><div className="flex items-center justify-end gap-2">
                {canManage && <IconActionButton label={`Sửa danh mục ${row.code}`} icon={Pencil} ariaHaspopup onClick={() => openEditor({ kind: "catalog", record: row })} />}
                {withdrawalAction({ kind: "catalog", record: row })}
              </div></Cell></tr>)}
          </Table>}
        </>}
        {directory !== editorDirectory && <Feedback error={directory?.error} onRetry={directory?.refresh} />}
      </section>
    </div>
  </div>;
}

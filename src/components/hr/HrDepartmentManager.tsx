import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from "react";
import { Building2, Check, LayoutGrid, List, Loader2, Pencil, Plus, Search, Trash2, Users, UserRoundX, X } from "lucide-react";
import { HrEmptyIllustration } from "./HrEmptyIllustration";
import { toast } from "../../pages/Toast";
import { hrDepartmentService, type HrDepartment, type HrDepartmentInput } from "../../services/hrDepartmentService";
import { cn } from "../../modules/student-management/lib/utils";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { StyledSelect } from "../common/StyledSelect";
import { primaryCreateButtonClass } from "../common/primaryCreateButton";
import { HrStatusBadge } from "./HrStatusBadge";
import "./HrDepartmentManager.css";

const fieldClass = "min-h-9 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const closeButtonClass = "flex size-8 shrink-0 items-center justify-center rounded-full bg-error text-on-error shadow-xs transition-transform hover:bg-error/90 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error disabled:cursor-not-allowed disabled:opacity-50";

function DepartmentStatusBadge({ active }: { active: boolean }) {
  return <HrStatusBadge tone={active ? "info" : "neutral"}>{active ? "Đang hoạt động" : "Ngừng hoạt động"}</HrStatusBadge>;
}

type Props = {
  companyCode: string;
  departments: HrDepartment[];
  managers: Array<{ id: string; name: string }>;
  managersLoading?: boolean;
  managerError?: string;
  onClose?: () => void;
  onChanged: (refreshUsers?: boolean) => Promise<void>;
  presentation?: "dialog" | "inline";
  canManage?: boolean;
};

function ManagerFrame({
  inline,
  busy,
  onClose,
  label,
  initialFocusRef,
  children,
}: {
  inline: boolean;
  busy: boolean;
  onClose: () => void;
  label: string;
  initialFocusRef: RefObject<HTMLInputElement | null>;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (inline) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    initialFocusRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      trigger?.focus();
    };
  }, [inline, initialFocusRef]);

  if (inline) return <div className="w-full">{children}</div>;

  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
      className="fixed inset-0 m-0 flex h-full w-full max-h-none max-w-none items-center justify-center overflow-y-auto border-0 bg-transparent p-4 backdrop:bg-inverse-surface/50 backdrop:backdrop-blur-sm"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
    >
      {children}
    </dialog>
  );
}

function DepartmentFormFields({
  idPrefix,
  nameRef,
  name,
  code,
  managerUid,
  description,
  sortOrder,
  isActive,
  managers,
  managersLoading,
  managerError,
  onNameChange,
  onNameKeyDown,
  onCodeChange,
  onManagerChange,
  onDescriptionChange,
  onSortOrderChange,
  onActiveChange,
}: {
  idPrefix: "new-hr-department" | "edit-hr-department";
  nameRef: RefObject<HTMLInputElement | null>;
  name: string;
  code: string;
  managerUid: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  managers: Array<{ id: string; name: string }>;
  managersLoading: boolean;
  managerError: string;
  onNameChange: (value: string) => void;
  onNameKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onCodeChange: (value: string) => void;
  onManagerChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSortOrderChange: (value: number) => void;
  onActiveChange: (value: boolean) => void;
}) {
  return (
    <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
      <label htmlFor={`${idPrefix}-name`} className="space-y-2 text-sm text-on-surface-variant sm:col-span-2">
        <span>Tên phòng ban</span>
        <input
          ref={nameRef}
          id={`${idPrefix}-name`}
          value={name}
          maxLength={100}
          onChange={(event) => onNameChange(event.target.value)}
          onKeyDown={onNameKeyDown}
          placeholder="Ví dụ: Phòng kinh doanh"
          className={fieldClass}
        />
      </label>
      <label htmlFor={`${idPrefix}-code`} className="space-y-2 text-sm text-on-surface-variant">
        <span>Mã phòng ban</span>
        <input
          id={`${idPrefix}-code`}
          value={code}
          maxLength={30}
          onChange={(event) => onCodeChange(event.target.value.toUpperCase())}
          placeholder="VD: KINH_DOANH"
          className={fieldClass}
        />
      </label>
      <div className="space-y-2">
        <span className="block text-sm text-on-surface-variant">Người quản lý (không bắt buộc)</span>
        <StyledSelect
          appearance="erp"
          ariaLabel="Người quản lý (không bắt buộc)"
          describedBy={`${idPrefix}-manager-help`}
          value={managerUid}
          onChange={onManagerChange}
          disabled={managersLoading}
          options={[{ value: "", label: managersLoading ? "Đang tải nhân sự..." : managers.length ? "Chưa chọn" : "Chưa có nhân sự trong doanh nghiệp" }, ...managers.map((manager) => ({ value: manager.id, label: manager.name }))]}
          className="h-9 min-h-9 border-outline-variant focus-visible:outline-2 focus-visible:outline-primary"
        />
        <p id={`${idPrefix}-manager-help`} role={managerError ? "alert" : "status"} className="text-xs text-on-surface-variant">
          {managerError || (managersLoading ? "Đang tải danh sách nhân sự..." : managers.length ? "Có thể để trống và phân công sau." : "Có thể tạo phòng ban trước rồi phân công sau.")}
        </p>
      </div>
      <label htmlFor={`${idPrefix}-description`} className="space-y-2 text-sm text-on-surface-variant sm:col-span-2">
        <span>Mô tả</span>
        <input
          id={`${idPrefix}-description`}
          value={description}
          maxLength={500}
          onChange={(event) => onDescriptionChange(event.target.value)}
          className={fieldClass}
        />
      </label>
      <label htmlFor={`${idPrefix}-sort-order`} className="space-y-2 text-sm text-on-surface-variant">
        <span>Thứ tự hiển thị</span>
        <input
          id={`${idPrefix}-sort-order`}
          type="number"
          min={0}
          max={9999}
          value={sortOrder}
          onChange={(event) => onSortOrderChange(Number(event.target.value))}
          className={fieldClass}
        />
      </label>
      <label htmlFor={`${idPrefix}-active`} className="flex min-h-10 items-center gap-2 text-sm text-on-surface-variant">
        <input
          id={`${idPrefix}-active`}
          type="checkbox"
          checked={isActive}
          onChange={(event) => onActiveChange(event.target.checked)}
          className="size-4 accent-primary"
        />
        Đang hoạt động
      </label>
    </div>
  );
}

export function HrDepartmentManager({ companyCode, departments, managers, managersLoading = false, managerError = "", onClose = () => undefined, onChanged, presentation = "dialog", canManage = true }: Props) {
  const inline = presentation === "inline";
  const nameInputRef = useRef<HTMLInputElement>(null);
  const editNameInputRef = useRef<HTMLInputElement>(null);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newManagerUid, setNewManagerUid] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSortOrder, setNewSortOrder] = useState(0);
  const [newActive, setNewActive] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCode, setEditingCode] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingManagerUid, setEditingManagerUid] = useState("");
  const [editingSortOrder, setEditingSortOrder] = useState(0);
  const [editingActive, setEditingActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<HrDepartment | null>(null);
  const normalizeSearch = (value: string) => value.trim().toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  const filteredDepartments = departments.filter(department =>
    (normalizeSearch(department.name).includes(normalizeSearch(search)) || normalizeSearch(department.code || "").includes(normalizeSearch(search)))
    && (statusFilter === "all" || (statusFilter === "active" ? department.isActive !== false : department.isActive === false))
  );
  const stats = {
    total: departments.length,
    active: departments.filter(department => department.isActive !== false).length,
    employees: departments.reduce((sum, department) => sum + department.employeeCount, 0),
    withoutManager: departments.filter(department => !department.managerUid).length,
  };
  const startEdit = (department: HrDepartment) => {
    setEditingId(department.id); setEditingName(department.name); setEditingCode(department.code || "");
    setEditingDescription(department.description || ""); setEditingManagerUid(department.managerUid || "");
    setEditingSortOrder(department.sortOrder || 0); setEditingActive(department.isActive !== false);
  };
  const actions = (department: HrDepartment, compact = false) => canManage && (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" aria-label={`Sửa ${department.name}`} title="Sửa phòng ban" onClick={() => startEdit(department)} disabled={busy} className={cn("flex items-center justify-center rounded-lg text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50", compact ? "size-8" : "size-10")}><Pencil className="size-4" aria-hidden="true" /></button>
      <button type="button" aria-label={`Xóa ${department.name}`} title="Xóa phòng ban" onClick={() => setPendingDelete(department)} disabled={busy} className={cn("flex items-center justify-center rounded-lg text-error hover:bg-error-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50", compact ? "size-8" : "size-10")}><Trash2 className="size-4" aria-hidden="true" /></button>
    </div>
  );
  const add = async () => {
    const name = newName.trim();
    if (!name) return toast.warning("Vui lòng nhập tên phòng ban.");
    setBusy(true);
    try {
      const input: HrDepartmentInput = {
        name,
        code: newCode.trim(),
        description: newDescription.trim(),
        sortOrder: newSortOrder,
        isActive: newActive,
        ...(newManagerUid ? { managerUid: newManagerUid } : {}),
      };
      await hrDepartmentService.create(companyCode, input);
      setNewName("");
      setNewCode(""); setNewManagerUid(""); setNewDescription(""); setNewSortOrder(0); setNewActive(true);
      await onChanged();
      toast.success("Đã thêm phòng ban.");
      if (inline) setIsAddOpen(false);
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(false); }
  };

  const rename = async (id: string) => {
    const name = editingName.trim();
    if (!name) return toast.warning("Vui lòng nhập tên phòng ban.");
    setBusy(true);
    try {
      const input: HrDepartmentInput = { name, code: editingCode.trim(), description: editingDescription.trim(), managerUid: editingManagerUid, sortOrder: editingSortOrder, isActive: editingActive };
      await hrDepartmentService.rename(companyCode, id, input);
      setEditingId(null);
      await onChanged(true);
      toast.success("Đã đổi tên phòng ban.");
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await hrDepartmentService.remove(companyCode, pendingDelete.id);
      setPendingDelete(null);
      await onChanged(true);
      toast.success("Đã xóa phòng ban.");
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(false); }
  };

  const createForm = (
    <DepartmentFormFields
      idPrefix="new-hr-department"
      nameRef={nameInputRef}
      name={newName}
      code={newCode}
      managerUid={newManagerUid}
      description={newDescription}
      sortOrder={newSortOrder}
      isActive={newActive}
      managers={managers}
      managersLoading={managersLoading}
      managerError={managerError}
      onNameChange={setNewName}
      onNameKeyDown={(event) => { if (event.key === "Enter") void add(); }}
      onCodeChange={setNewCode}
      onManagerChange={setNewManagerUid}
      onDescriptionChange={setNewDescription}
      onSortOrderChange={setNewSortOrder}
      onActiveChange={setNewActive}
    />
  );

  return (
    <>
      <ManagerFrame inline={inline} busy={busy} onClose={onClose} label="Quản lý phòng ban" initialFocusRef={nameInputRef}>
        <div className={cn("flex w-full flex-col", inline ? "gap-5" : "max-h-[calc(100dvh-2rem)] max-w-5xl overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-xl")}>
          <header className={cn("flex flex-col gap-4", inline ? "sm:flex-row sm:items-center sm:justify-between" : "border-b border-outline-variant px-5 py-4 sm:flex-row sm:items-center sm:justify-between")}>
            {!inline && (
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="mt-0.5 h-5 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container" aria-hidden="true"><Building2 className="size-4" /></span>
                <h2 className="text-balance text-sm font-medium text-on-surface">Quản lý phòng ban</h2>
              </div>
            )}

            {inline && canManage ? (
              <button type="button" onClick={() => setIsAddOpen(true)} className={cn(primaryCreateButtonClass, "ml-auto")}><Plus className="size-4 stroke-[2.5]" aria-hidden="true" /> Thêm phòng ban</button>
            ) : !inline && <button type="button" aria-label="Đóng" onClick={onClose} disabled={busy} className={closeButtonClass} data-erp-modal-close><X className="size-4 stroke-[2.5]" aria-hidden="true" /></button>}
          </header>

          <div className={cn("min-h-0 overflow-y-auto", inline ? "space-y-4" : "grid gap-4 p-4 md:grid-cols-2 md:gap-5")}>
            {!inline && canManage && <div className="min-w-0 space-y-3">
              {createForm}
              <div className="flex justify-end"><button type="button" onClick={() => void add()} disabled={busy || !newName.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><Plus className="size-4" aria-hidden="true" /> Thêm phòng ban</button></div>
            </div>}

            <section aria-label="Danh sách phòng ban" className={cn("min-w-0 space-y-4", !inline && !canManage && "md:col-span-2")}>
              {inline && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: "Tổng phòng ban", value: stats.total, Icon: Building2, tone: "total" },
                  { label: "Đang hoạt động", value: stats.active, Icon: Check, tone: "active" },
                  { label: "Tổng nhân sự", value: stats.employees, Icon: Users, tone: "employees" },
                  { label: "Chưa có quản lý", value: stats.withoutManager, Icon: UserRoundX, tone: "without-manager" },
                ].map(({ label, value, Icon, tone }) => <div key={label} className={cn("hr-department-stat-card flex min-w-0 items-center justify-between gap-3 rounded-xl p-3 text-on-primary", `hr-department-stat-card--${tone}`)}>
                  <div className="min-w-0"><p className="truncate text-xs font-medium" title={label}>{label}</p><p className="tabular-nums text-xl font-semibold leading-tight">{value}</p></div>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-on-primary/15"><Icon className="size-5" aria-hidden="true" /></span>
                </div>)}
              </div>}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {departments.length > 0 && <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <label className="relative min-w-44 flex-1 sm:max-w-xl">
                    <span className="sr-only">Tìm phòng ban</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
                    <input type="search" placeholder="Tìm tên hoặc mã phòng ban..." value={search} onChange={event => setSearch(event.target.value)} className={cn(fieldClass, "pl-9")} />
                  </label>
                  <StyledSelect appearance="erp" ariaLabel="Lọc trạng thái phòng ban" value={statusFilter} onChange={(value) => setStatusFilter(value as typeof statusFilter)} options={[{ value: "all", label: "Tất cả trạng thái" }, { value: "active", label: "Đang hoạt động" }, { value: "inactive", label: "Ngừng hoạt động" }]} className="h-9 min-h-9 w-44 border-outline-variant focus-visible:outline-2 focus-visible:outline-primary" />
                  <div role="group" aria-label="Kiểu hiển thị" className="flex h-9 rounded-lg bg-surface-container-low">
                    <button type="button" aria-label="Xem dạng lưới" aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")} className={cn("flex size-9 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-primary", viewMode === "grid" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container")}><LayoutGrid className="size-4" aria-hidden="true" /></button>
                    <button type="button" aria-label="Xem dạng bảng" aria-pressed={viewMode === "table"} onClick={() => setViewMode("table")} className={cn("flex size-9 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-primary", viewMode === "table" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container")}><List className="size-4" aria-hidden="true" /></button>
                  </div>
                </div>}
                <span className="ml-auto whitespace-nowrap tabular-nums text-xs text-on-surface-variant">{filteredDepartments.length}/{departments.length} phòng ban</span>
              </div>
              {departments.length === 0 && <div className="flex flex-col items-center rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-8 text-center text-pretty text-sm text-on-surface-variant"><HrEmptyIllustration kind="department" /><p className="mt-1">Chưa có phòng ban.{canManage ? " Hãy thêm phòng ban đầu tiên." : ""}</p></div>}
              {departments.length > 0 && filteredDepartments.length === 0 && <div className="flex flex-col items-center rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-8 text-center text-pretty text-sm text-on-surface-variant"><HrEmptyIllustration kind="search" /><p className="mt-1">Không tìm thấy phòng ban phù hợp. Hãy đổi từ khóa hoặc bộ lọc.</p></div>}
              {filteredDepartments.length > 0 && (viewMode === "grid" ? (
                <ul className={cn("grid gap-3", inline && "grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))]")}>
                  {filteredDepartments.map(department => <li key={department.id} className="flex min-w-0 flex-col gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
                    <div className="flex items-start gap-2.5"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container"><Building2 className="size-4.5" aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-on-surface" title={department.name}>{department.name}</p><p className="truncate text-xs text-on-surface-variant" title={department.code || undefined}>{department.code || "Chưa có mã"}</p></div></div>
                    <p className="truncate text-xs text-on-surface-variant" title={`${department.employeeCount} nhân sự · ${department.managerName ? `Quản lý: ${department.managerName}` : "Chưa có quản lý"}`}>{department.employeeCount} nhân sự · {department.managerName ? `Quản lý: ${department.managerName}` : "Chưa có quản lý"}</p>
                    {department.description && <p className="line-clamp-2 text-xs text-on-surface-variant">{department.description}</p>}
                    <div className="mt-auto flex items-center justify-between gap-1.5"><DepartmentStatusBadge active={department.isActive !== false} />{actions(department, true)}</div>
                  </li>)}
                </ul>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest"><table className="min-w-full text-left text-sm"><thead className="bg-surface-container-low text-on-surface-variant"><tr><th scope="col" className="p-3 font-medium">Phòng ban</th><th scope="col" className="p-3 font-medium">Nhân sự</th><th scope="col" className="p-3 font-medium">Quản lý</th><th scope="col" className="p-3 font-medium">Trạng thái</th>{canManage && <th scope="col" className="p-3 font-medium">Thao tác</th>}</tr></thead><tbody className="divide-y divide-outline-variant">{filteredDepartments.map(department => <tr key={department.id}><th scope="row" className="p-3 font-medium text-on-surface"><span className="block max-w-48 truncate" title={department.name}>{department.name}</span>{department.code && <span className="block max-w-48 truncate text-xs font-normal text-on-surface-variant" title={department.code}>{department.code}</span>}</th><td className="p-3 tabular-nums">{department.employeeCount}</td><td className="p-3"><span className="block max-w-48 truncate" title={department.managerName || undefined}>{department.managerName || "Chưa có"}</span></td><td className="p-3"><DepartmentStatusBadge active={department.isActive !== false} /></td>{canManage && <td className="p-3">{actions(department)}</td>}</tr>)}</tbody></table></div>
              ))}
            </section>
          </div>
          {busy && <div role="status" className="flex items-center justify-center gap-2 border-t border-outline-variant py-2 text-xs text-on-surface-variant"><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Đang cập nhật...</div>}
        </div>
      </ManagerFrame>
      {editingId && (
        <ManagerFrame inline={false} busy={busy} onClose={() => setEditingId(null)} label="Sửa phòng ban" initialFocusRef={editNameInputRef}>
          <div className="flex max-h-[min(680px,calc(100dvh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-outline-variant px-5 py-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="h-5 w-1 rounded-full bg-primary" aria-hidden="true" />
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container" aria-hidden="true"><Building2 className="size-4" /></span>
                <h2 className="text-balance text-sm font-medium text-on-surface">Sửa phòng ban</h2>
              </div>
              <button type="button" aria-label="Đóng" onClick={() => setEditingId(null)} disabled={busy} className={closeButtonClass} data-erp-modal-close><X className="size-4 stroke-[2.5]" aria-hidden="true" /></button>
            </div>
            <div className="min-h-0 overflow-y-auto p-5">
              <DepartmentFormFields
                idPrefix="edit-hr-department"
                nameRef={editNameInputRef}
                name={editingName}
                code={editingCode}
                managerUid={editingManagerUid}
                description={editingDescription}
                sortOrder={editingSortOrder}
                isActive={editingActive}
                managers={managers}
                managersLoading={managersLoading}
                managerError={managerError}
                onNameChange={setEditingName}
                onNameKeyDown={(event) => { if (event.key === "Enter" && editingId) void rename(editingId); }}
                onCodeChange={setEditingCode}
                onManagerChange={setEditingManagerUid}
                onDescriptionChange={setEditingDescription}
                onSortOrderChange={setEditingSortOrder}
                onActiveChange={setEditingActive}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-outline-variant px-5 py-3">
              <button type="button" onClick={() => setEditingId(null)} disabled={busy} className="rounded-xl px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Hủy</button>
              <button type="button" onClick={() => { if (editingId) void rename(editingId); }} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><Check className="size-4" aria-hidden="true" /> Lưu thay đổi</button>
            </div>
            {busy && <div role="status" className="flex items-center justify-center gap-2 border-t border-outline-variant py-2 text-xs text-on-surface-variant"><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Đang cập nhật...</div>}
          </div>
        </ManagerFrame>
      )}
      {inline && isAddOpen && (
        <ManagerFrame inline={false} busy={busy} onClose={() => setIsAddOpen(false)} label="Thêm phòng ban" initialFocusRef={nameInputRef}>
          <div className="flex max-h-[min(680px,calc(100dvh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-outline-variant px-5 py-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="h-5 w-1 rounded-full bg-primary" aria-hidden="true" />
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container" aria-hidden="true"><Building2 className="size-4" /></span>
                <h2 className="text-balance text-sm font-medium text-on-surface">Thêm phòng ban</h2>
              </div>
              <button type="button" aria-label="Đóng" onClick={() => setIsAddOpen(false)} disabled={busy} className={closeButtonClass} data-erp-modal-close><X className="size-4 stroke-[2.5]" aria-hidden="true" /></button>
            </div>
            <div className="min-h-0 overflow-y-auto p-5">{createForm}</div>
            <div className="flex justify-end border-t border-outline-variant px-5 py-3">
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsAddOpen(false)} disabled={busy} className="rounded-xl px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Hủy</button>
                <button type="button" onClick={() => void add()} disabled={busy || !newName.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><Plus className="size-4" aria-hidden="true" /> Thêm phòng ban</button>
              </div>
            </div>
            {busy && <div role="status" className="flex items-center justify-center gap-2 border-t border-outline-variant py-2 text-xs text-on-surface-variant"><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Đang cập nhật...</div>}
          </div>
        </ManagerFrame>
      )}
      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="Xóa phòng ban"
        description={pendingDelete ? pendingDelete.employeeCount > 0
          ? `Phòng ban “${pendingDelete.name}” đang có ${pendingDelete.employeeCount} nhân sự. Nếu tiếp tục, nhân sự sẽ được gỡ khỏi phòng ban này. Bạn có muốn xóa không?`
          : `Bạn muốn xóa phòng ban “${pendingDelete.name}”?`
          : ""}
        confirmLabel="Xóa phòng ban"
        tone="danger"
        isSubmitting={busy}
        onClose={() => { if (!busy) setPendingDelete(null); }}
        onConfirm={remove}
      />
    </>
  );
}

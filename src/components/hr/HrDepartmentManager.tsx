import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from "react";
import { Building2, Check, LayoutGrid, List, Loader2, Pencil, Plus, Search, Trash2, Users, UserRoundX, X } from "lucide-react";
import { toast } from "../../pages/Toast";
import { hrDepartmentService, type HrDepartment, type HrDepartmentInput } from "../../services/hrDepartmentService";
import { cn } from "../../modules/student-management/lib/utils";
import { ConfirmDialog } from "../common/ConfirmDialog";

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
    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
      <label htmlFor={`${idPrefix}-name`} className="space-y-1 text-sm text-on-surface-variant sm:col-span-2">
        <span>Tên phòng ban</span>
        <input
          ref={nameRef}
          id={`${idPrefix}-name`}
          value={name}
          maxLength={100}
          onChange={(event) => onNameChange(event.target.value)}
          onKeyDown={onNameKeyDown}
          placeholder="Ví dụ: Phòng kinh doanh"
          className="min-h-10 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-primary"
        />
      </label>
      <label htmlFor={`${idPrefix}-code`} className="space-y-1 text-sm text-on-surface-variant">
        <span>Mã phòng ban</span>
        <input
          id={`${idPrefix}-code`}
          value={code}
          maxLength={30}
          onChange={(event) => onCodeChange(event.target.value.toUpperCase())}
          placeholder="VD: KINH_DOANH"
          className="min-h-10 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-primary"
        />
      </label>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-manager`} className="block text-sm text-on-surface-variant">Người quản lý (không bắt buộc)</label>
        <select
          id={`${idPrefix}-manager`}
          aria-describedby={`${idPrefix}-manager-help`}
          value={managerUid}
          onChange={(event) => onManagerChange(event.target.value)}
          disabled={managersLoading}
          className="min-h-10 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-70"
        >
          <option value="">{managersLoading ? "Đang tải nhân sự..." : managers.length ? "Chưa chọn" : "Chưa có nhân sự trong doanh nghiệp"}</option>
          {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}
        </select>
        <p id={`${idPrefix}-manager-help`} role={managerError ? "alert" : "status"} className="text-xs text-on-surface-variant">
          {managerError || (managersLoading ? "Đang tải danh sách nhân sự..." : managers.length ? "Có thể để trống và phân công sau." : "Có thể tạo phòng ban trước rồi phân công sau.")}
        </p>
      </div>
      <label htmlFor={`${idPrefix}-description`} className="space-y-1 text-sm text-on-surface-variant sm:col-span-2">
        <span>Mô tả</span>
        <input
          id={`${idPrefix}-description`}
          value={description}
          maxLength={500}
          onChange={(event) => onDescriptionChange(event.target.value)}
          className="min-h-10 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
        />
      </label>
      <label htmlFor={`${idPrefix}-sort-order`} className="space-y-1 text-sm text-on-surface-variant">
        <span>Thứ tự hiển thị</span>
        <input
          id={`${idPrefix}-sort-order`}
          type="number"
          min={0}
          max={9999}
          value={sortOrder}
          onChange={(event) => onSortOrderChange(Number(event.target.value))}
          className="min-h-10 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
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
  const actions = (department: HrDepartment) => canManage && (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" aria-label={`Sửa ${department.name}`} title="Sửa phòng ban" onClick={() => startEdit(department)} disabled={busy} className="flex size-10 items-center justify-center rounded-lg text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><Pencil className="size-4" aria-hidden="true" /></button>
      <button type="button" aria-label={`Xóa ${department.name}`} title="Xóa phòng ban" onClick={() => setPendingDelete(department)} disabled={busy} className="flex size-10 items-center justify-center rounded-lg text-error hover:bg-error-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><Trash2 className="size-4" aria-hidden="true" /></button>
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
        <div className={cn("flex w-full flex-col", inline ? "gap-5" : "max-h-[min(680px,calc(100dvh-2rem))] max-w-xl overflow-hidden rounded-2xl border border-outline-variant bg-surface shadow-xl")}>
          <header className={cn("flex flex-col gap-4", inline ? "sm:flex-row sm:items-center sm:justify-between" : "border-b border-outline-variant px-5 py-4 sm:flex-row sm:items-center sm:justify-between")}>
            <div className={cn("flex min-w-0 items-center gap-2.5", inline && "items-start")}>
              <span className="mt-0.5 h-5 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className={cn("text-balance text-on-surface", inline ? "text-xl font-semibold" : "text-base font-medium")}>Quản lý phòng ban</h2>
              </div>
            </div>

            {inline && canManage ? (
              <button type="button" onClick={() => setIsAddOpen(true)} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><Plus className="size-4" aria-hidden="true" /> Thêm phòng ban</button>
            ) : !inline && <button type="button" aria-label="Đóng" onClick={onClose} disabled={busy} className="flex size-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><X className="size-4" aria-hidden="true" /></button>}
          </header>

          <div className={cn("min-h-0 overflow-y-auto", inline ? "space-y-4" : "p-5", !inline && "max-h-[min(560px,calc(100dvh-10rem))]")}>
            {!inline && canManage && createForm}
            {!inline && canManage && <div className="mt-4 flex justify-end"><button type="button" onClick={() => void add()} disabled={busy || !newName.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><Plus className="size-4" aria-hidden="true" /> Thêm phòng ban</button></div>}

            <section aria-label="Danh sách phòng ban" className={cn("space-y-4", !inline && "mt-6")}>
              {inline && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: "Tổng phòng ban", value: stats.total, Icon: Building2 },
                  { label: "Đang hoạt động", value: stats.active, Icon: Check },
                  { label: "Tổng nhân sự", value: stats.employees, Icon: Users },
                  { label: "Chưa có quản lý", value: stats.withoutManager, Icon: UserRoundX },
                ].map(({ label, value, Icon }) => <div key={label} className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container"><Icon className="size-5" aria-hidden="true" /></span>
                  <div><p className="text-pretty text-xs text-on-surface-variant">{label}</p><p className="text-lg font-semibold tabular-nums text-on-surface">{value}</p></div>
                </div>)}
              </div>}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className={cn("text-balance text-on-surface", inline ? "text-lg font-semibold" : "text-sm font-medium")}>Danh sách phòng ban</h3>
                <span className="tabular-nums text-xs text-on-surface-variant">{filteredDepartments.length}/{departments.length} phòng ban</span>
              </div>
              {departments.length > 0 && <div className="flex flex-wrap items-center gap-2">
                <label className="relative min-w-44 flex-1 sm:max-w-xl">
                  <span className="sr-only">Tìm phòng ban</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
                  <input type="search" placeholder="Tìm tên hoặc mã phòng ban..." value={search} onChange={event => setSearch(event.target.value)} className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-primary" />
                </label>
                <label className="sr-only" htmlFor="department-status-filter">Lọc trạng thái phòng ban</label>
                <select id="department-status-filter" value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="min-h-11 rounded-lg border border-outline bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary">
                  <option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option>
                </select>
                <div role="group" aria-label="Kiểu hiển thị" className="flex rounded-lg border border-outline p-0.5">
                  <button type="button" aria-label="Xem dạng lưới" aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")} className={cn("flex size-10 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-primary", viewMode === "grid" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-low")}><LayoutGrid className="size-4" aria-hidden="true" /></button>
                  <button type="button" aria-label="Xem dạng bảng" aria-pressed={viewMode === "table"} onClick={() => setViewMode("table")} className={cn("flex size-10 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-primary", viewMode === "table" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-low")}><List className="size-4" aria-hidden="true" /></button>
                </div>
              </div>}
              {departments.length === 0 && <p className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-8 text-center text-pretty text-sm text-on-surface-variant">Chưa có phòng ban.{canManage ? " Hãy thêm phòng ban đầu tiên." : ""}</p>}
              {departments.length > 0 && filteredDepartments.length === 0 && <p className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-8 text-center text-pretty text-sm text-on-surface-variant">Không tìm thấy phòng ban phù hợp. Hãy đổi từ khóa hoặc bộ lọc.</p>}
              {filteredDepartments.length > 0 && (viewMode === "grid" ? (
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredDepartments.map(department => <li key={department.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                    <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container"><Building2 className="size-5" aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold text-on-surface">{department.name}</p><p className="text-xs text-on-surface-variant">{department.code || "Chưa có mã"}</p></div></div>
                    <p className="text-pretty text-sm text-on-surface-variant">{department.employeeCount} nhân sự · {department.managerName ? `Quản lý: ${department.managerName}` : "Chưa có quản lý"}</p>
                    {department.description && <p className="text-pretty text-sm text-on-surface-variant">{department.description}</p>}
                    <div className="mt-auto flex items-center justify-between gap-2"><span className="text-xs text-on-surface-variant">{department.isActive === false ? "Ngừng hoạt động" : "Đang hoạt động"}</span>{actions(department)}</div>
                  </li>)}
                </ul>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest"><table className="min-w-full text-left text-sm"><thead className="bg-surface-container-low text-on-surface-variant"><tr><th scope="col" className="p-3 font-medium">Phòng ban</th><th scope="col" className="p-3 font-medium">Nhân sự</th><th scope="col" className="p-3 font-medium">Quản lý</th><th scope="col" className="p-3 font-medium">Trạng thái</th>{canManage && <th scope="col" className="p-3 font-medium">Thao tác</th>}</tr></thead><tbody className="divide-y divide-outline-variant">{filteredDepartments.map(department => <tr key={department.id}><th scope="row" className="p-3 font-medium text-on-surface">{department.name}{department.code && <span className="block text-xs font-normal text-on-surface-variant">{department.code}</span>}</th><td className="p-3 tabular-nums">{department.employeeCount}</td><td className="p-3">{department.managerName || "Chưa có"}</td><td className="p-3">{department.isActive === false ? "Ngừng hoạt động" : "Đang hoạt động"}</td>{canManage && <td className="p-3">{actions(department)}</td>}</tr>)}</tbody></table></div>
              ))}
            </section>
          </div>
          {busy && <div role="status" className="flex items-center justify-center gap-2 border-t border-outline-variant py-2 text-xs text-on-surface-variant"><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Đang cập nhật...</div>}
        </div>
      </ManagerFrame>
      {editingId && (
        <ManagerFrame inline={false} busy={busy} onClose={() => setEditingId(null)} label="Sửa phòng ban" initialFocusRef={editNameInputRef}>
          <div className="flex max-h-[min(680px,calc(100dvh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-outline-variant px-5 py-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="h-5 w-1 rounded-full bg-primary" aria-hidden="true" />
                <Building2 className="size-4 text-primary" aria-hidden="true" />
                <h2 className="text-balance text-base font-medium text-on-surface">Sửa phòng ban</h2>
              </div>
              <button type="button" aria-label="Đóng" onClick={() => setEditingId(null)} disabled={busy} className="flex size-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><X className="size-4" aria-hidden="true" /></button>
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
          <div className="flex max-h-[min(680px,calc(100dvh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-outline-variant px-5 py-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="h-5 w-1 rounded-full bg-primary" aria-hidden="true" />
                <Building2 className="size-4 text-primary" aria-hidden="true" />
                <h2 className="text-balance text-base font-medium text-on-surface">Thêm phòng ban</h2>
              </div>
              <button type="button" aria-label="Đóng" onClick={() => setIsAddOpen(false)} disabled={busy} className="flex size-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><X className="size-4" aria-hidden="true" /></button>
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

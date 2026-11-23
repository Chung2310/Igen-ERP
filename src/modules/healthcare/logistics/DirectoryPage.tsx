import { useRef, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { DirectoryKind, DirectoryRecord, LogisticsList } from "../../../../shared/healthcare-logistics";
import type { HealthcareApi } from "../api";
import { cn } from "../../student-management/lib/utils";
import { Field, Feedback, Cell, Table, useHealthcareQuery } from "../ui";
import { Dropdown } from "../../../components/common/Dropdown";
import { ErpRefreshButton } from "../../../components/common/ErpRefreshButton";
import { primaryCreateButtonClass } from "../../../components/common/primaryCreateButton";
import { TableFilterToolbar } from "../../../components/common/TableFilterToolbar";
import { TablePagination } from "../../../components/common/TablePagination";
import { HrStatusBadge } from "../../../components/hr/HrStatusBadge";
import { LogisticsForm, formValues } from "./LogisticsForm";

const labels = { suppliers: "Nhà cung cấp", warehouses: "Kho lưu trữ", categories: "Phân loại" };

const surfacePanelClass = "flex min-w-0 flex-1 flex-col gap-3";

const rowActionClass =
  "inline-flex min-h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

export default function DirectoryPage({
  api,
  kind,
  canManage,
  onChanged,
}: {
  api: HealthcareApi;
  kind: DirectoryKind;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("all");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<{ row?: DirectoryRecord }>();
  const focus = useRef<HTMLElement | null>(null);
  const query = useHealthcareQuery<LogisticsList<DirectoryRecord>>(
    api,
    `/logistics/directories/${kind}?page=${page}&q=${encodeURIComponent(search)}&active=${active}`,
  );
  function close() {
    setEditor(undefined);
    requestAnimationFrame(() => focus.current?.focus());
  }
  const fields =
    kind === "suppliers"
      ? [
          ["contactPerson", "Người liên hệ"],
          ["phone", "Điện thoại"],
          ["email", "Email"],
          ["address", "Địa chỉ"],
          ["taxCode", "Mã số thuế"],
        ]
      : kind === "warehouses"
        ? [
            ["location", "Vị trí kho"],
            ["managerName", "Người phụ trách"],
            ["managerPhone", "Điện thoại phụ trách"],
          ]
        : [];
  const hasActiveFilters = Boolean(search.trim() || active !== "all");
  return (
    <div className={surfacePanelClass}>
      <TableFilterToolbar
        appearance="plain"
        search={{
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
          placeholder: `Tìm mã hoặc tên ${labels[kind].toLocaleLowerCase("vi")}`,
          ariaLabel: "Tìm kiếm danh mục",
          className: "min-w-0",
        }}
        totalCount={query.data ? query.data.total : undefined}
        countLabel="danh mục"
        hasActiveFilters={hasActiveFilters}
        onResetFilters={() => {
          setSearch("");
          setActive("all");
          setPage(1);
        }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ErpRefreshButton loading={query.refreshing} onClick={query.refresh} />
            {canManage && (
              <button
                type="button"
                className={cn(primaryCreateButtonClass, "min-h-9")}
                onClick={() => {
                  focus.current = document.activeElement as HTMLElement;
                  setEditor({});
                }}
              >
                <Plus className="size-3.5 stroke-[2.5]" aria-hidden="true" />
                Thêm {labels[kind].toLocaleLowerCase("vi")}
              </button>
            )}
          </div>
        }
      >
        <Dropdown
          aria-label="Trạng thái danh mục"
          variant="filter"
          value={active}
          onChange={(value) => {
            setActive(value);
            setPage(1);
          }}
          options={[
            { value: "all", label: "Tất cả trạng thái" },
            { value: "true", label: "Đang sử dụng" },
            { value: "false", label: "Ngừng sử dụng" },
          ]}
        />
      </TableFilterToolbar>

      <Feedback loading={query.loading} error={query.error} onRetry={query.refresh} />
      {query.data && (
        <>
          <Table
            headers={["Mã", "Tên", "Liên hệ / Vị trí", "Trạng thái", "Thao tác"]}
            empty={!query.data.items.length ? "Chưa có danh mục phù hợp." : undefined}
          >
            {query.data.items.map((row) => (
              <tr key={row._id}>
                <Cell className="whitespace-nowrap">
                  <span className="inline-flex rounded bg-surface-container px-2 py-0.5 text-xs font-medium text-on-surface-variant">
                    {row.code}
                  </span>
                </Cell>
                <Cell className="font-medium text-on-surface">{row.name}</Cell>
                <Cell>
                  {kind === "suppliers"
                    ? [row.contactPerson, row.phone].filter(Boolean).join(" · ") || "—"
                    : row.location || row.notes || "—"}
                </Cell>
                <Cell className="whitespace-nowrap">
                  <HrStatusBadge dot tone={row.active ? "success" : "neutral"}>
                    {row.active ? "Đang sử dụng" : "Ngừng sử dụng"}
                  </HrStatusBadge>
                </Cell>
                <Cell align="right">
                  {canManage && row.editable ? (
                    <button
                      type="button"
                      className={rowActionClass}
                      onClick={() => {
                        focus.current = document.activeElement as HTMLElement;
                        setEditor({ row });
                      }}
                    >
                      <Pencil className="size-3.5 text-on-surface-variant" aria-hidden="true" />
                      Sửa
                    </button>
                  ) : !row.editable ? (
                    <span className="text-xs text-on-surface-variant">Danh mục ERP dùng chung</span>
                  ) : null}
                </Cell>
              </tr>
            ))}
          </Table>
          <div className="sticky bottom-0 z-20 -mx-3 -mb-3 mt-auto sm:-mx-4 sm:-mb-4">
            <TablePagination
              appearance="erp"
              className="rounded-b-lg"
              currentPage={page}
              totalPages={Math.max(1, Math.ceil(query.data.total / 25))}
              pageSize={25}
              totalItems={query.data.total}
              onPageChange={setPage}
              onPageSizeChange={() => {}}
              pageSizeOptions={[25]}
            />
          </div>
        </>
      )}
      {editor && (
        <LogisticsForm
          title={`${editor.row ? "Sửa" : "Thêm"} ${labels[kind].toLocaleLowerCase("vi")}`}
          api={api}
          path={`/logistics/directories/${kind}${editor.row ? `/${editor.row._id}` : ""}`}
          method={editor.row ? "PATCH" : "POST"}
          onClose={close}
          onSaved={() => {
            close();
            query.refresh();
            onChanged();
          }}
          payload={(data) => ({
            ...formValues(data),
            active: data.get("active") === "true",
            ...(editor.row ? { revision: editor.row.revision } : {}),
          })}
        >
          {(error) => (
            <div className="grid gap-3 sm:grid-cols-2">
              {[["code", "Mã"], ["name", "Tên"], ...fields, ["notes", "Ghi chú"]].map(([name, label]) => (
                <Field
                  key={name}
                  name={name}
                  label={label}
                  value={String(editor.row?.[name as keyof DirectoryRecord] || "")}
                  required={name === "code" || name === "name"}
                  type={name === "email" ? "email" : "text"}
                  error={error}
                />
              ))}
              <Field
                name="active"
                label="Trạng thái"
                value={String(editor.row?.active ?? true)}
                options={[
                  { value: "true", label: "Đang sử dụng" },
                  { value: "false", label: "Ngừng sử dụng" },
                ]}
              />
            </div>
          )}
        </LogisticsForm>
      )}
    </div>
  );
}

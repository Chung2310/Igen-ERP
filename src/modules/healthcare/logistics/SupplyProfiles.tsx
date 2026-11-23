import { useRef, useState } from "react";
import { Plus, Settings2, Trash2 } from "lucide-react";
import type { Supply, LogisticsList } from "../../../../shared/healthcare-logistics";
import type { HealthcareApi } from "../api";
import { Field, Table, Cell, Feedback, buttonClass, useHealthcareQuery } from "../ui";
import { ErpRefreshButton } from "../../../components/common/ErpRefreshButton";
import { TableFilterToolbar } from "../../../components/common/TableFilterToolbar";
import { TablePagination } from "../../../components/common/TablePagination";
import { HrStatusBadge } from "../../../components/hr/HrStatusBadge";
import { LogisticsForm } from "./LogisticsForm";

const surfacePanelClass = "flex min-w-0 flex-1 flex-col gap-3";

const rowActionClass =
  "inline-flex min-h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

export default function SupplyProfiles({ api, canManage }: { api: HealthcareApi; canManage: boolean }) {
  const focus = useRef<HTMLElement | null>(null);
  function close() {
    setRecord(undefined);
    requestAnimationFrame(() => focus.current?.focus());
  }
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [record, setRecord] = useState<Supply>();
  const list = useHealthcareQuery<LogisticsList<Supply>>(
    api,
    `/logistics/supplies?q=${encodeURIComponent(q)}&page=${page}`,
  );
  return (
    <div className={surfacePanelClass}>
      <TableFilterToolbar
        appearance="plain"
        search={{
          value: q,
          onChange: (value) => {
            setQ(value);
            setPage(1);
          },
          placeholder: "Tìm mã hoặc tên vật tư",
          ariaLabel: "Tìm vật tư",
          className: "min-w-0",
        }}
        totalCount={list.data ? list.data.total : undefined}
        countLabel="vật tư"
        hasActiveFilters={Boolean(q.trim())}
        onResetFilters={() => {
          setQ("");
          setPage(1);
        }}
        actions={<ErpRefreshButton loading={list.refreshing} onClick={list.refresh} />}
      />
      <Feedback loading={list.loading} error={list.error} onRetry={list.refresh} />
      {list.data && (
        <>
          <Table
            headers={["Vật tư", "Đơn vị cơ sở", "Theo dõi", "Quy đổi", "Thao tác"]}
            empty={!list.data.items.length ? "Chưa có vật tư để cấu hình quy đổi." : undefined}
          >
            {list.data.items.map((row) => (
              <tr key={row._id}>
                <Cell>
                  <span className="block font-medium text-on-surface">{row.name}</span>
                  <span className="mt-0.5 inline-block rounded bg-surface-container px-1.5 py-0.5 text-xs text-on-surface-variant">
                    {row.code}
                  </span>
                </Cell>
                <Cell className="whitespace-nowrap">{row.unit}</Cell>
                <Cell className="whitespace-nowrap">
                  <HrStatusBadge tone={row.trackingMode === "none" ? "neutral" : "info"} className="normal-case">
                    {row.trackingMode === "none" ? "Không theo lô" : "Theo lô"}
                  </HrStatusBadge>
                </Cell>
                <Cell>
                  {row.conversions?.length ? (
                    row.conversions.map((c) => `1 ${c.unit} = ${c.factor} ${row.unit}`).join("; ")
                  ) : (
                    <span className="text-xs text-on-surface-variant">Chưa khai báo</span>
                  )}
                </Cell>
                <Cell align="right">
                  {canManage && (
                    <button
                      type="button"
                      className={rowActionClass}
                      onClick={() => {
                        focus.current = document.activeElement as HTMLElement;
                        setRecord(row);
                      }}
                    >
                      <Settings2 className="size-3.5 text-on-surface-variant" aria-hidden="true" />
                      Cấu hình
                    </button>
                  )}
                </Cell>
              </tr>
            ))}
          </Table>
          <div className="sticky bottom-0 z-20 -mx-3 -mb-3 mt-auto sm:-mx-4 sm:-mb-4">
            <TablePagination
              appearance="erp"
              className="rounded-b-lg"
              currentPage={page}
              totalPages={Math.max(1, Math.ceil(list.data.total / 25))}
              totalItems={list.data.total}
              pageSize={25}
              pageSizeOptions={[25]}
              onPageChange={setPage}
              onPageSizeChange={() => {}}
            />
          </div>
        </>
      )}
      {record && (
        <ProfileEditor
          key={record._id}
          api={api}
          record={record}
          onClose={close}
          onSaved={() => {
            close();
            list.refresh();
          }}
        />
      )}
    </div>
  );
}

function ProfileEditor({
  api,
  record,
  onClose,
  onSaved,
}: {
  api: HealthcareApi;
  record: Supply;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState(record.conversions || []);
  return (
    <LogisticsForm
      title={`Quy đổi · ${record.name}`}
      maxWidth="max-w-2xl"
      api={api}
      path={`/logistics/profiles/${record._id}`}
      method="PUT"
      onClose={onClose}
      onSaved={onSaved}
      payload={(data) => ({
        revision: record.revision,
        precision: Number(data.get("precision")),
        trackingMode: data.get("trackingMode"),
        requiresExpiry: data.get("requiresExpiry") === "true",
        conversions: rows,
      })}
    >
      {(error) => (
        <>
          <p className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
            Đơn vị cơ sở: <strong className="font-semibold text-on-surface">{record.unit}</strong> · Cấu hình không được đổi khi vật tư đã phát sinh chứng từ.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              name="precision"
              label="Số chữ số thập phân"
              type="number"
              min={0}
              max={6}
              value={String(record.precision ?? 3)}
              error={error}
            />
            <Field
              name="trackingMode"
              label="Cách theo dõi"
              value={record.trackingMode || "lot"}
              options={[
                { value: "lot", label: "Theo lô" },
                { value: "none", label: "Không theo lô" },
              ]}
            />
            <Field
              name="requiresExpiry"
              label="Hạn dùng"
              value={String(record.requiresExpiry)}
              options={[
                { value: "true", label: "Bắt buộc" },
                { value: "false", label: "Không bắt buộc" },
              ]}
            />
          </div>
          <section className="space-y-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant pb-2">
              <h3 className="text-sm font-semibold text-on-surface">
                Đơn vị quy đổi {rows.length > 0 && <span className="font-normal text-on-surface-variant">({rows.length})</span>}
              </h3>
              <button
                type="button"
                className={`${buttonClass} !min-h-8 !px-2.5 !py-1 text-xs`}
                disabled={rows.length >= 20}
                onClick={() => setRows((v) => [...v, { unit: "", factor: "1" }])}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Thêm đơn vị quy đổi
              </button>
            </div>
            {rows.length === 0 ? (
              <p className="py-2 text-xs text-on-surface-variant">
                Chưa có đơn vị quy đổi (ví dụ: 1 Thùng = 20 {record.unit}). Bấm <strong>Thêm đơn vị quy đổi</strong> để khai báo.
              </p>
            ) : (
              <div className="space-y-2.5">
                {rows.map((row, index) => (
                  <div key={index} className="space-y-1">
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2.5">
                      <Field
                        name={`unit-${index}`}
                        label={`Đơn vị quy đổi ${index + 1}`}
                        placeholder="VD: Hộp, Thùng..."
                        value={row.unit}
                        required
                        onChange={(e) => setRows((v) => v.map((r, i) => (i === index ? { ...r, unit: e.target.value } : r)))}
                      />
                      <Field
                        name={`factor-${index}`}
                        label={`Số ${record.unit} trong 1 đơn vị`}
                        value={row.factor}
                        required
                        inputMode="decimal"
                        onChange={(e) => setRows((v) => v.map((r, i) => (i === index ? { ...r, factor: e.target.value } : r)))}
                      />
                      <button
                        type="button"
                        aria-label={`Bỏ đơn vị ${index + 1}`}
                        title={`Bỏ đơn vị ${index + 1}`}
                        className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-error/30 bg-surface-container-lowest text-error transition-colors hover:bg-error-container/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        onClick={() => setRows((v) => v.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                    {row.unit.trim() && row.factor && (
                      <p className="text-xs tabular-nums text-on-surface-variant">
                        1 <strong className="font-medium text-on-surface">{row.unit.trim()}</strong> = <strong className="font-medium text-primary">{row.factor}</strong> {record.unit}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </LogisticsForm>
  );
}
